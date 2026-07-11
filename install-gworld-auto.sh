#!/usr/bin/env bash
set -euo pipefail

# G-WORLD automation installer
# Run from the repository root: bash install-gworld-auto.sh

mkdir -p scripts .github/workflows supabase

cat > scripts/sync-franime.mjs <<'JS'
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SOURCE = 'https://franime.fr';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalize = value => (value || '').replace(/\s+/g, ' ').trim();
const absolute = value => {
  try { return new URL(value, SOURCE).href; } catch { return null; }
};
const isAnimePage = value => {
  try {
    const url = new URL(value, SOURCE);
    return url.origin === SOURCE && url.pathname.startsWith('/anime/');
  } catch { return false; }
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function collectAnimeUrls(page) {
  const found = new Set();
  for (const start of [`${SOURCE}/`, `${SOURCE}/recherche`, `${SOURCE}/calendrier`]) {
    await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let pass = 0; pass < 14; pass++) {
      const links = await page.locator('a[href*="/anime/"]').evaluateAll(nodes => nodes.map(a => a.href));
      links.filter(isAnimePage).forEach(link => {
        const url = new URL(link);
        url.searchParams.delete('ep');
        found.add(url.href);
      });
      await page.mouse.wheel(0, 2400);
      await sleep(450);
    }
  }
  return [...found].slice(0, Number(process.env.MAX_ANIMES || 120));
}

async function collectEpisodeUrls(page, animeUrl) {
  await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  const data = await page.evaluate(() => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    const image = document.querySelector('main img, article img, img[alt*="poster" i]');
    const descriptionHeading = [...document.querySelectorAll('h2,h3')]
      .find(node => /description|synopsis/i.test(node.textContent || ''));
    const description = descriptionHeading?.nextElementSibling?.textContent?.trim() || '';
    return {
      title: text('h1'),
      description,
      poster: image?.src || '',
      links: [...document.querySelectorAll('a[href*="ep="]')].map(a => a.href)
    };
  });

  const links = [...new Set(data.links.filter(isAnimePage))];
  links.sort((a, b) => {
    const ua = new URL(a), ub = new URL(b);
    return Number(ub.searchParams.get('s') || 1) - Number(ua.searchParams.get('s') || 1)
      || Number(ub.searchParams.get('ep') || 0) - Number(ua.searchParams.get('ep') || 0);
  });
  return { ...data, links: links.slice(0, Number(process.env.MAX_EPISODES_PER_ANIME || 4)) };
}

async function extractEpisode(page, episodeUrl, anime) {
  await page.goto(episodeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const sensitive = page.getByText(/j'ai compris/i).first();
  if (await sensitive.isVisible().catch(() => false)) await sensitive.click().catch(() => {});

  const watch = page.getByText(/regarder l['’]épisode/i).first();
  if (await watch.isVisible().catch(() => false)) await watch.click().catch(() => {});

  await page.waitForTimeout(1200);
  let iframe = await page.locator('iframe[src*="sendvid.com/embed/"]').first().getAttribute('src').catch(() => null);
  if (!iframe) {
    const html = await page.content();
    iframe = html.match(/(?:https?:)?\/\/sendvid\.com\/embed\/[a-zA-Z0-9_-]+/i)?.[0] || null;
  }
  if (!iframe) return null;
  if (iframe.startsWith('//')) iframe = `https:${iframe}`;
  if (!/^https:\/\/sendvid\.com\/embed\/[a-zA-Z0-9_-]+/i.test(iframe)) return null;

  const url = new URL(episodeUrl);
  const season = Number(url.searchParams.get('s') || 1);
  const episode = Number(url.searchParams.get('ep') || 0);
  const language = url.searchParams.get('lang') === 'vf' ? 'VF' : 'VOSTFR';
  const pageTitle = normalize(await page.title());
  const title = normalize(anime.title || pageTitle.split(/S\d+|EP\d+/i)[0]);

  return {
    source: 'franime',
    source_page: episodeUrl,
    anime_slug: url.pathname.split('/').filter(Boolean).pop(),
    anime_title: title,
    season_number: season,
    episode_number: episode,
    language,
    embed_url: iframe,
    poster_url: anime.poster || null,
    description: anime.description || null,
    published: true,
    checked_at: new Date().toISOString()
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'GWorldAuthorizedSync/1.0 (+https://gworld-officiel.vercel.app)'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  let discovered = 0, saved = 0, skipped = 0, failed = 0;
  try {
    const animeUrls = await collectAnimeUrls(page);
    discovered = animeUrls.length;
    console.log(`Found ${discovered} anime pages`);

    for (const animeUrl of animeUrls) {
      try {
        const anime = await collectEpisodeUrls(page, animeUrl);
        for (const episodeUrl of anime.links) {
          try {
            const record = await extractEpisode(page, episodeUrl, anime);
            if (!record) { skipped++; continue; }
            const { error } = await db.from('auto_episodes').upsert(record, { onConflict: 'source_page' });
            if (error) throw error;
            saved++;
            console.log(`Saved ${record.anime_title} S${record.season_number}E${record.episode_number} ${record.language}`);
          } catch (error) {
            failed++;
            console.error(`Episode failed: ${episodeUrl}`, error.message);
          }
        }
      } catch (error) {
        failed++;
        console.error(`Anime failed: ${animeUrl}`, error.message);
      }
    }
  } finally {
    await browser.close();
  }

  const summary = { discovered, saved, skipped, failed, finished_at: new Date().toISOString() };
  await db.from('sync_runs').insert(summary).catch(() => {});
  console.log(JSON.stringify(summary));
  if (failed > 20 && saved === 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
JS

cat > .github/workflows/sync-franime.yml <<'YAML'
name: Sync authorized Franime episodes

on:
  schedule:
    - cron: '17 */6 * * *'
  workflow_dispatch:

concurrency:
  group: gworld-franime-sync
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install runtime
        run: |
          npm install --no-save playwright@1.53.1 @supabase/supabase-js@2.50.2
          npx playwright install --with-deps chromium
      - name: Import new Sendvid players
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          MAX_ANIMES: '120'
          MAX_EPISODES_PER_ANIME: '4'
        run: node scripts/sync-franime.mjs
YAML

cat > supabase/gworld-auto.sql <<'SQL'
create table if not exists public.auto_episodes (
  id bigint generated by default as identity primary key,
  source text not null default 'franime',
  source_page text not null unique,
  anime_slug text not null,
  anime_title text not null,
  season_number integer not null check (season_number > 0),
  episode_number integer not null check (episode_number >= 0),
  language text not null check (language in ('VF','VOSTFR')),
  embed_url text not null check (embed_url ~ '^https://sendvid.com/embed/[A-Za-z0-9_-]+'),
  poster_url text,
  description text,
  published boolean not null default true,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists auto_episodes_recent_idx
  on public.auto_episodes (created_at desc)
  where published = true;

create table if not exists public.sync_runs (
  id bigint generated by default as identity primary key,
  discovered integer not null default 0,
  saved integer not null default 0,
  skipped integer not null default 0,
  failed integer not null default 0,
  finished_at timestamptz not null default now()
);

alter table public.auto_episodes enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "Public can read published auto episodes" on public.auto_episodes;
create policy "Public can read published auto episodes"
  on public.auto_episodes for select
  using (published = true);

revoke all on public.sync_runs from anon, authenticated;
grant select on public.auto_episodes to anon, authenticated;
SQL

cat > gworld-auto.css <<'CSS'
.auto-release-section{margin:0 0 3rem}.auto-release-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.25rem}.auto-release-head h2{font-size:clamp(1.35rem,2vw,2rem);letter-spacing:-.035em}.auto-release-head p{color:var(--text2);font-size:.82rem}.auto-release-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1px;background:var(--glass-border);border:1px solid var(--glass-border);border-radius:18px;overflow:hidden}.auto-release{display:grid;grid-template-columns:82px 1fr;gap:1rem;min-height:128px;padding:1rem;background:var(--bg2);cursor:pointer;text-align:left;transition:transform .22s cubic-bezier(.16,1,.3,1),background .15s}.auto-release:hover{background:var(--bg3);transform:translateY(-2px)}.auto-release:focus-visible{outline:3px solid var(--primary);outline-offset:-3px}.auto-release img{width:82px;height:112px;object-fit:cover;border-radius:8px;background:var(--bg3)}.auto-release-copy{min-width:0;display:flex;flex-direction:column;justify-content:center}.auto-release-kicker{color:var(--primary-light);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.auto-release-title{margin:.35rem 0;font-size:.95rem;font-weight:800;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.auto-release-meta{color:var(--text2);font-size:.75rem}.auto-empty{padding:2rem;background:var(--bg2);color:var(--text2);text-align:center}.auto-player{width:min(960px,calc(100vw - 2rem));padding:0;border:1px solid var(--glass-border);border-radius:18px;background:var(--bg2);color:var(--text);overflow:hidden}.auto-player::backdrop{background:rgba(5,4,12,.88)}.auto-player-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem}.auto-player-title{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.auto-player-close{width:44px;height:44px;border-radius:50%;background:var(--bg3);font-size:1.2rem}.auto-player-frame{display:block;width:100%;aspect-ratio:16/9;border:0;background:oklch(8% .008 290)}@media(max-width:600px){.auto-release-grid{display:block}.auto-release{border-bottom:1px solid var(--glass-border)}.auto-release-head{align-items:start;flex-direction:column}}
CSS

cat > gworld-auto.js <<'JS'
(() => {
  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const validEmbed = value => /^https:\/\/sendvid\.com\/embed\/[A-Za-z0-9_-]+/.test(value || '');

  async function init() {
    if (typeof db === 'undefined') return;
    const anchor = document.querySelector('.hero-banner, .stats-bar, main .section');
    if (!anchor) return;

    const section = document.createElement('section');
    section.className = 'auto-release-section';
    section.innerHTML = '<div class="auto-release-head"><div><h2>Dernières sorties</h2><p>Mises à jour automatiquement toutes les 6 heures</p></div></div><div class="auto-release-grid"><div class="auto-empty">Chargement des derniers épisodes…</div></div>';
    anchor.insertAdjacentElement('afterend', section);

    const dialog = document.createElement('dialog');
    dialog.className = 'auto-player';
    dialog.innerHTML = '<div class="auto-player-bar"><strong class="auto-player-title"></strong><button class="auto-player-close" aria-label="Fermer">×</button></div><iframe class="auto-player-frame" allowfullscreen referrerpolicy="no-referrer"></iframe>';
    document.body.append(dialog);
    const frame = dialog.querySelector('iframe');
    dialog.querySelector('.auto-player-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { frame.src = 'about:blank'; });

    const { data, error } = await db.from('auto_episodes')
      .select('anime_title,season_number,episode_number,language,embed_url,poster_url,created_at')
      .eq('published', true).order('created_at', { ascending: false }).limit(12);

    const grid = section.querySelector('.auto-release-grid');
    if (error || !data?.length) {
      grid.innerHTML = '<div class="auto-empty">Aucune sortie automatique pour le moment.</div>';
      return;
    }

    grid.innerHTML = data.filter(item => validEmbed(item.embed_url)).map((item, index) => `
      <button class="auto-release" data-index="${index}">
        <img src="${escapeHtml(item.poster_url || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <span class="auto-release-copy">
          <span class="auto-release-kicker">Nouveau · ${escapeHtml(item.language)}</span>
          <span class="auto-release-title">${escapeHtml(item.anime_title)}</span>
          <span class="auto-release-meta">Saison ${Number(item.season_number)} · Épisode ${Number(item.episode_number)}</span>
        </span>
      </button>`).join('');

    grid.addEventListener('click', event => {
      const button = event.target.closest('.auto-release');
      if (!button) return;
      const item = data[Number(button.dataset.index)];
      if (!item || !validEmbed(item.embed_url)) return;
      dialog.querySelector('.auto-player-title').textContent = `${item.anime_title} · S${item.season_number}E${item.episode_number}`;
      frame.src = item.embed_url;
      dialog.showModal();
    });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
JS

python3 - <<'PY'
from pathlib import Path
path = Path('index.html')
text = path.read_text(encoding='utf-8')
css = '<link rel="stylesheet" href="/gworld-auto.css">'
js = '<script src="/gworld-auto.js" defer></script>'
if css not in text:
    text = text.replace('</head>', f'  {css}\n</head>', 1)
if js not in text:
    text = text.replace('</body>', f'  {js}\n</body>', 1)
path.write_text(text, encoding='utf-8')
PY

cat <<'TXT'

G-WORLD automation files installed.

Next steps:
1. Run supabase/gworld-auto.sql once in the Supabase SQL Editor.
2. In GitHub repository Settings > Secrets and variables > Actions, add:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
3. Commit and push the generated files.
4. Open Actions > Sync authorized Franime episodes > Run workflow.

The service-role key must stay in GitHub Secrets. Never put it in index.html.
TXT
