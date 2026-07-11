import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { parse } from 'node-html-parser';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FRANIME_BASE = 'https://franime.fr';
const FRANIME_ANIMES = `${FRANIME_BASE}/animes`;

function normalize(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/gi, '')
    .trim();
}

async function extractEpisode(page, episodeUrl, anime) {
  const sendvidUrls = new Set();

  function capture(value) {
    if (!value) return;

    const decoded = String(value)
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&');

    const matches = decoded.matchAll(
      /(?:https?:)?\/\/(?:www\.)?sendvid\.com\/(?:embed\/)?([A-Za-z0-9_-]{5,})/gi
    );

    for (const match of matches) {
      sendvidUrls.add(
        `https://sendvid.com/embed/${match[1]}`
      );
    }
  }

  const onRequest = request => {
    capture(request.url());
    capture(request.postData());
  };

  const onResponse = async response => {
    capture(response.url());

    const contentType =
      response.headers()['content-type'] || '';

    if (
      contentType.includes('json') ||
      contentType.includes('text') ||
      response.url().includes('franime')
    ) {
      const body = await response.text().catch(() => '');

      if (body.length < 5_000_000) {
        capture(body);
      }
    }
  };

  const onFrame = frame => capture(frame.url());

  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('framenavigated', onFrame);

  try {
    console.log(`Ouverture: ${episodeUrl}`);

    await page.goto(episodeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForLoadState('networkidle', {
      timeout: 15000
    }).catch(() => {});

    await page.waitForTimeout(2500);

    const consentButtons = page.getByText(
      /j['’]ai compris|accepter|continuer/i
    );

    const consentCount = await consentButtons
      .count()
      .catch(() => 0);

    for (let index = 0; index < consentCount; index++) {
      const button = consentButtons.nth(index);

      if (await button.isVisible().catch(() => false)) {
        await button.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    const watchButtons = page.getByText(
      /regarder l['’]épisode|lancer la vidéo|lecture/i
    );

    const watchCount = await watchButtons
      .count()
      .catch(() => 0);

    for (let index = 0; index < watchCount; index++) {
      const button = watchButtons.nth(index);

      if (await button.isVisible().catch(() => false)) {
        await button.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    const selects = page.locator('select');
    const selectCount = await selects.count().catch(() => 0);

    for (let index = 0; index < selectCount; index++) {
      const select = selects.nth(index);

      const optionValue = await select.evaluate(node => {
        const option = [...node.options].find(item =>
          /sendvid/i.test(item.textContent || '')
        );

        return option?.value || null;
      }).catch(() => null);

      if (optionValue) {
        await select.selectOption(optionValue).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    const sendvidButtons = page
      .locator(
        'button, a, [role="button"], [role="tab"], label, li'
      )
      .filter({ hasText: /sendvid/i });

    const sendvidButtonCount = await sendvidButtons
      .count()
      .catch(() => 0);

    for (
      let index = 0;
      index < sendvidButtonCount;
      index++
    ) {
      const button = sendvidButtons.nth(index);

      if (!(await button.isVisible().catch(() => false))) {
        continue;
      }

      await button
        .scrollIntoViewIfNeeded()
        .catch(() => {});

      await button
        .click({
          force: true,
          timeout: 5000
        })
        .catch(() => {});

      await page.waitForTimeout(1800);
    }

    await page.waitForTimeout(3500);

    capture(await page.content());

    const iframeSources = await page
      .locator('iframe')
      .evaluateAll(nodes =>
        nodes.map(node =>
          node.src || node.getAttribute('src') || ''
        )
      )
      .catch(() => []);

    iframeSources.forEach(capture);

    for (const frame of page.frames()) {
      capture(frame.url());
      capture(await frame.content().catch(() => ''));
    }

    const embedUrl = [...sendvidUrls][0];

    if (!embedUrl) {
      console.log(`Aucun Sendvid trouvé: ${episodeUrl}`);
      return null;
    }

    const url = new URL(episodeUrl);
    const season = Number(url.searchParams.get('s') || 1);
    const episode = Number(url.searchParams.get('ep') || 0);

    const language =
      url.searchParams.get('lang')?.toLowerCase() === 'vf'
        ? 'VF'
        : 'VOSTFR';

    const pageTitle = normalize(await page.title());

    const title = normalize(
      anime.title ||
      pageTitle.split(/S\d+|EP\d+/i)[0]
    );

    return {
      source: 'franime',
      source_page: episodeUrl,
      anime_slug: url.pathname
        .split('/')
        .filter(Boolean)
        .pop(),
      anime_title: title || 'Anime sans titre',
      season_number: season > 0 ? season : 1,
      episode_number: episode >= 0 ? episode : 0,
      language,
      embed_url: embedUrl,
      poster_url: anime.poster || null,
      description: anime.description || null,
      published: true,
      checked_at: new Date().toISOString()
    };
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('framenavigated', onFrame);
  }
}

async function scrapeAnimes(page) {
  console.log(`Scraping ${FRANIME_ANIMES}...`);
  await page.goto(FRANIME_ANIMES, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  const content = await page.content();
  const root = parse(content);

  const items = root.querySelectorAll('.anime-card');
  const animes = [];

  for (const item of items) {
    const link = item.querySelector('a');
    const href = link?.getAttribute('href');
    const title = link?.textContent.trim();
    const poster = item.querySelector('img')?.getAttribute('src');

    if (href) {
      animes.push({
        slug: href.split('/').filter(Boolean).pop(),
        title,
        poster: poster?.startsWith('http') ? poster : `${FRANIME_BASE}${poster || ''}`,
        url: href.startsWith('http') ? href : `${FRANIME_BASE}${href}`
      });
    }
  }

  console.log(`Trouvé ${animes.length} animes`);
  return animes;
}

async function scrapeEpisodesForAnime(page, anime) {
  const url = anime.url;
  console.log(`Scraping ${url}...`);

  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  const content = await page.content();
  const root = parse(content);

  const episodeLinks = root.querySelectorAll('.episode-link');
  const episodes = [];

  for (const link of episodeLinks) {
    const href = link.getAttribute('href');
    const season = link.getAttribute('data-season') || '1';
    const episode = link.getAttribute('data-episode') || '0';
    const lang = link.getAttribute('data-lang') || 'vf';

    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${FRANIME_BASE}${href}`;
      episodes.push({
        url: fullUrl,
        season: parseInt(season),
        episode: parseInt(episode),
        language: lang.toLowerCase() === 'vf' ? 'VF' : 'VOSTFR'
      });
    }
  }

  return episodes;
}

async function main() {
  const browser = await puppeteer
    .use(StealthPlugin())
    .launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const animes = await scrapeAnimes(page);
  let discovered = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const anime of animes) {
    console.log(`\n--- ${anime.title} ---`);

    const episodes = await scrapeEpisodesForAnime(page, anime);

    for (const episode of episodes) {
      discovered++;

      try {
        const existing = await supabase
          .from('auto_episodes')
          .select('id')
          .eq('source_page', episode.url)
          .maybeSingle();

        if (existing.data) {
          console.log(`↷ Déjà existant: ${episode.url}`);
          skipped++;
          continue;
        }

        const result = await extractEpisode(page, episode.url, anime);

        if (!result) {
          console.log(`✗ Aucun embed: ${episode.url}`);
          failed++;
          continue;
        }

        const { error } = await supabase
          .from('auto_episodes')
          .insert(result);

        if (error) {
          console.error(`✗ Erreur insertion: ${episode.url}`, error);
          failed++;
        } else {
          console.log(`✓ Sauvegardé: ${result.embed_url}`);
          saved++;
        }
      } catch (err) {
        console.error(`✗ Exception: ${episode.url}`, err);
        failed++;
      }
    }
  }

  await browser.close();

  console.log('\n--- Résumé ---');
  console.log(`Découverts: ${discovered}`);
  console.log(`Sauvegardés: ${saved}`);
  console.log(`Ignorés: ${skipped}`);
  console.log(`Erreurs: ${failed}`);

  // NOUVEAU TEST
  if (saved === 0) {
    throw new Error(
      `Zéro import: ${discovered} animes découverts, ` +
      `${skipped} ignorés, ${failed} erreurs`
    );
  }

  // Insérer une ligne dans sync_runs
  await supabase.from('sync_runs').insert({
    discovered,
    saved,
    skipped,
    failed
  });
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
