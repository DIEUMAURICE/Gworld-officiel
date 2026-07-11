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
