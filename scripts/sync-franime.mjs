import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SOURCE = 'https://franime.fr';
const MAX_ANIMES = Number(process.env.MAX_ANIMES || 30);
const MAX_EPISODES = Number(process.env.MAX_EPISODES_PER_ANIME || 4);
const MAX_LIST_PAGES = Number(process.env.MAX_LIST_PAGES || 6);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manque dans GitHub Secrets'
  );
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function absolute(value, base = SOURCE) {
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

function isAnimePage(value) {
  try {
    const url = new URL(value, SOURCE);

    return (
      url.origin === SOURCE &&
      url.pathname.startsWith('/anime/') &&
      url.pathname.split('/').filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}

function normalizeEpisodeUrl(value) {
  try {
    const url = new URL(value, SOURCE);

    if (!isAnimePage(url.href)) return null;

    url.hash = '';

    if (!url.searchParams.has('s')) {
      url.searchParams.set('s', '1');
    }

    if (!url.searchParams.has('lang')) {
      url.searchParams.set('lang', 'vo');
    }

    return url.href;
  } catch {
    return null;
  }
}

function normalizeSendvid(value) {
  if (!value) return null;

  let decoded = String(value)
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&/g, '&');

  if (decoded.startsWith('//')) {
    decoded = `https:${decoded}`;
  }

  const match = decoded.match(
    /https?:\/\/(?:www\.)?sendvid\.com\/(?:embed\/)?([A-Za-z0-9_-]{5,})/i
  );

  if (!match) return null;

  return `https://sendvid.com/embed/${match[1]}`;
}

function extractSendvidUrls(text) {
  const found = new Set();

  const normalizedText = String(text || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&/g, '&');

  const matches = normalizedText.matchAll(
    /(?:https?:)?\/\/(?:www\.)?sendvid\.com\/(?:embed\/)?[A-Za-z0-9_-]{5,}/gi
  );

  for (const match of matches) {
    const embed = normalizeSendvid(match[0]);
    if (embed) found.add(embed);
  }

  return [...found];
}

async function gotoHydrated(page, url) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForLoadState('networkidle', {
    timeout: 12000
  }).catch(() => {});

  await page.waitForTimeout(2500);
}

async function dismissDialogs(page) {
  const patterns = [
    /j['’]ai compris/i,
    /accepter/i,
    /continuer/i,
    /fermer/i,
    /confirmer/i
  ];

  for (const pattern of patterns) {
    const buttons = page.getByRole('button', { name: pattern });

    const count = await buttons.count().catch(() => 0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);

      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  }
}

async function scrollPage(page) {
  for (let pass = 0; pass < 10; pass++) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(450);
  }

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function collectAnimeUrls(page) {
  const found = new Set();

  const starts = [
    `${SOURCE}/`,
    `${SOURCE}/calendrier`
  ];

  for (let number = 0; number < MAX_LIST_PAGES; number++) {
    starts.push(
      `${SOURCE}/recherche?search=&type=TOUT&format=TOUT&status=TOUT&ordre=Date&page=${number}`
    );
  }

  for (const start of starts) {
    console.log(`Catalogue: ${start}`);

    try {
      await gotoHydrated(page, start);
      await dismissDialogs(page);
      await scrollPage(page);

      const links = await page
        .locator('a[href*="/anime/"]')
        .evaluateAll(nodes =>
          nodes
            .map(node => node.href)
            .filter(Boolean)
        )
        .catch(() => []);

      for (const link of links) {
        if (!isAnimePage(link)) continue;

        const url = new URL(link);
        url.search = '';
        url.hash = '';

        found.add(url.href);
      }
    } catch (error) {
      console.error(`Catalogue inaccessible: ${start}`, error.message);
    }

    if (found.size >= MAX_ANIMES) break;
  }

  const result = [...found].slice(0, MAX_ANIMES);

  console.log(`${result.length} fiches anime découvertes`);

  return result;
}

async function collectEpisodeUrls(page, animeUrl) {
  const apiBodies = [];

  const responseListener = async response => {
    const contentType = response.headers()['content-type'] || '';
    const responseUrl = response.url();

    if (
      responseUrl.includes('api.franime.fr') &&
      contentType.includes('application/json')
    ) {
      const body = await response.text().catch(() => '');

      if (body && body.length < 20_000_000) {
        apiBodies.push(body);
      }
    }
  };

  page.on('response', responseListener);

  try {
    await gotoHydrated(page, animeUrl);
    await dismissDialogs(page);

    const metadata = await page.evaluate(() => {
      const text = selector =>
        document.querySelector(selector)?.textContent?.trim() || '';

      const poster =
        document.querySelector(
          'main img[src*="kitsu"], main img, article img, img[alt*="poster" i]'
        ) || null;

      const descriptionHeading = [...document.querySelectorAll('h2,h3')]
        .find(node => /description|synopsis/i.test(node.textContent || ''));

      return {
        title: text('h1') || document.title,
        poster: poster?.src || '',
        description:
          descriptionHeading?.nextElementSibling?.textContent?.trim() || ''
      };
    });

    const found = new Set();

    const domLinks = await page
      .locator('a[href*="ep="]')
      .evaluateAll(nodes =>
        nodes
          .map(node => node.href)
          .filter(Boolean)
      )
      .catch(() => []);

    for (const link of domLinks) {
      const normalized = normalizeEpisodeUrl(link);
      if (normalized) found.add(normalized);
    }

    /*
     * Franime charge parfois les épisodes dans du JSON et non dans des liens.
     * On relève ici les numéros de saisons et d’épisodes présents dans les
     * réponses réseau, sans nécessiter de clé API.
     */
    const combinedText = [
      await page.content().catch(() => ''),
      ...apiBodies
    ].join('\n');

    const seasonNumbers = new Set();
    const episodeNumbers = new Set();

    for (const match of combinedText.matchAll(
      /(?:saison|season|s)[^0-9]{0,12}([0-9]{1,3})/gi
    )) {
      seasonNumbers.add(Number(match[1]));
    }

    for (const match of combinedText.matchAll(
      /(?:épisode|episode|ep)[^0-9]{0,12}([0-9]{1,4})/gi
    )) {
      episodeNumbers.add(Number(match[1]));
    }

    if (!seasonNumbers.size) {
      seasonNumbers.add(1);
    }

    /*
     * Si les boutons utilisent JavaScript et n'ont aucun href, on récupère
     * les nombres visibles dans les boutons d'épisodes.
     */
    const visibleEpisodes = await page
      .locator('button, [role="button"], option')
      .evaluateAll(nodes => {
        const numbers = [];

        for (const node of nodes) {
          const text = (node.textContent || '').trim();
          const match = text.match(
            /(?:épisode|episode|ep)?\s*([0-9]{1,4})/i
          );

          if (match && /épisode|episode|ep/i.test(text)) {
            numbers.push(Number(match[1]));
          }
        }

        return numbers;
      })
      .catch(() => []);

    visibleEpisodes.forEach(number => episodeNumbers.add(number));

    /*
     * On ne fabrique des URL que si Franime a réellement exposé des numéros.
     * Les épisodes les plus élevés sont traités en premier.
     */
    const seasons = [...seasonNumbers]
      .filter(number => Number.isInteger(number) && number > 0)
      .sort((a, b) => b - a);

    const episodes = [...episodeNumbers]
      .filter(number => Number.isInteger(number) && number >= 0)
      .sort((a, b) => b - a);

    for (const season of seasons) {
      for (const episode of episodes) {
        for (const lang of ['vo', 'vf']) {
          const url = new URL(animeUrl);
          url.searchParams.set('s', String(season));
          url.searchParams.set('ep', String(episode));
          url.searchParams.set('lang', lang);

          found.add(url.href);
        }
      }
    }

    const sorted = [...found].sort((a, b) => {
      const first = new URL(a);
      const second = new URL(b);

      return (
        Number(second.searchParams.get('s') || 1) -
          Number(first.searchParams.get('s') || 1) ||
        Number(second.searchParams.get('ep') || 0) -
          Number(first.searchParams.get('ep') || 0)
      );
    });

    return {
      ...metadata,
      title: normalize(metadata.title)
        .replace(/\s*[-|]\s*FRAnime.*$/i, '')
        .trim(),
      links: sorted.slice(0, MAX_EPISODES * 2)
    };
  } finally {
    page.off('response', responseListener);
  }
}

async function chooseSendvidPlayer(page) {
  /*
   * Cas 1 : Sendvid est proposé dans un select.
   */
  const selects = page.locator('select');
  const selectCount = await selects.count().catch(() => 0);

  for (let i = 0; i < selectCount; i++) {
    const select = selects.nth(i);

    const optionValue = await select.evaluate(node => {
      const option = [...node.options].find(item =>
        /sendvid/i.test(item.textContent || '')
      );

      return option?.value || null;
    }).catch(() => null);

    if (optionValue) {
      await select.selectOption(optionValue).catch(() => {});
      await page.waitForTimeout(1200);
    }
  }

  /*
   * Cas 2 : Sendvid est un bouton, un onglet, un lien ou un texte cliquable.
   */
  const candidates = page.locator(
    'button, a, [role="button"], [role="tab"], label, li'
  ).filter({
    hasText: /sendvid/i
  });

  const count = await candidates.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);

    if (!(await candidate.isVisible().catch(() => false))) continue;

    await candidate
      .scrollIntoViewIfNeeded()
      .catch(() => {});

    await candidate
      .click({ force: true, timeout: 4000 })
      .catch(() => {});

    await page.waitForTimeout(1500);
  }
}

async function extractEpisode(page, episodeUrl, anime) {
  const sendvidUrls = new Set();

  const capture = value => {
    const direct = normalizeSendvid(value);

    if (direct) {
      sendvidUrls.add(direct);
    }

    for (const embed of extractSendvidUrls(value)) {
      sendvidUrls.add(embed);
    }
  };

  const requestListener = request => {
    capture(request.url());
    capture(request.postData() || '');
  };

  const responseListener = async response => {
    capture(response.url());

    const contentType = response.headers()['content-type'] || '';

    if (
      contentType.includes('json') ||
      contentType.includes('text') ||
      response.url().includes('franime')
    ) {
      const body = await response.text().catch(() => '');

      if (body && body.length < 5_000_000) {
        capture(body);
      }
    }
  };

  const frameListener = frame => {
    capture(frame.url());
  };

  page.on('request', requestListener);
  page.on('response', responseListener);
  page.on('framenavigated', frameListener);

  try {
    console.log(`Épisode: ${episodeUrl}`);

    await gotoHydrated(page, episodeUrl);
    await dismissDialogs(page);

    const watchButtons = page.getByText(
      /regarder l['’]épisode|lancer la vidéo|lecture/i
    );

    const watchCount = await watchButtons.count().catch(() => 0);

    for (let i = 0; i < watchCount; i++) {
      const button = watchButtons.nth(i);

      if (await button.isVisible().catch(() => false)) {
        await button.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    await chooseSendvidPlayer(page);
    await page.waitForTimeout(3500);

    /*
     * Vérification des iframes du document principal et des sous-frames.
     */
    for (const frame of page.frames()) {
      capture(frame.url());

      const sources = await frame
        .locator('iframe')
        .evaluateAll(nodes =>
          nodes.map(node => node.src || node.getAttribute('src') || '')
        )
        .catch(() => []);

      sources.forEach(capture);

      const html = await frame.content().catch(() => '');
      capture(html);
    }

    capture(await page.content());

    const iframe = [...sendvidUrls][0] || null;

    if (!iframe) {
      console.log(`Aucun lecteur Sendvid: ${episodeUrl}`);
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
      pageTitle.split(/\s+(?:Saison|Season|S)\s*\d+/i)[0]
    ).replace(/\s*[-|]\s*FRAnime.*$/i, '');

    return {
      source: 'franime',
      source_page: url.href,
      anime_slug: url.pathname.split('/').filter(Boolean).pop(),
      anime_title: title || 'Anime sans titre',
      season_number: season > 0 ? season : 1,
      episode_number: episode >= 0 ? episode : 0,
      language,
      embed_url: iframe,
      poster_url: absolute(anime.poster, SOURCE),
      description: anime.description || null,
      published: true,
      checked_at: new Date().toISOString()
    };
  } finally {
    page.off('request', requestListener);
    page.off('response', responseListener);
    page.off('framenavigated', frameListener);
  }
}

async function saveRecord(record) {
  const { error } = await db
    .from('auto_episodes')
    .upsert(record, {
      onConflict: 'source_page'
    });

  if (error) throw error;
}

async function saveSummary(summary) {
  const { error } = await db
    .from('sync_runs')
    .insert(summary);

  if (error) {
    console.error(
      `Impossible d'enregistrer le résumé: ${error.message}`
    );
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: {
      width: 1440,
      height: 1000
    },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.setDefaultTimeout(20000);

  let discovered = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const animeUrls = await collectAnimeUrls(page);
    discovered = animeUrls.length;

    if (discovered === 0) {
      throw new Error(
        'Aucune fiche anime découverte. Franime a probablement changé son interface.'
      );
    }

    for (const animeUrl of animeUrls) {
      try {
        const anime = await collectEpisodeUrls(page, animeUrl);

        if (!anime.links.length) {
          skipped++;
          console.log(`Aucun épisode découvert: ${animeUrl}`);
          continue;
        }

        for (const episodeUrl of anime.links) {
          try {
            const record = await extractEpisode(
              page,
              episodeUrl,
              anime
            );

            if (!record) {
              skipped++;
              continue;
            }

            await saveRecord(record);
            saved++;

            console.log(
              `Sauvegardé: ${record.anime_title} ` +
              `S${record.season_number}E${record.episode_number} ` +
              `${record.language} ${record.embed_url}`
            );

            /*
             * Une URL VF et une URL VOSTFR sont comptées séparément.
             */
            if (saved >= MAX_ANIMES * MAX_EPISODES) {
              break;
            }
          } catch (error) {
            failed++;
            console.error(
              `Échec épisode ${episodeUrl}: ${error.message}`
            );
          }
        }
      } catch (error) {
        failed++;
        console.error(
          `Échec anime ${animeUrl}: ${error.message}`
        );
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    discovered,
    saved,
    skipped,
    failed,
    finished_at: new Date().toISOString()
  };

  await saveSummary(summary);

  console.log('RÉSUMÉ');
  console.log(JSON.stringify(summary, null, 2));

  /*
   * Important : GitHub ne doit plus afficher vert quand rien n'a été importé.
   */
  if (saved === 0) {
    throw new Error(
      `Synchronisation terminée sans import: ` +
      `${discovered} animes, ${skipped} ignorés, ${failed} erreurs`
    );
  }
}

main().catch(error => {
  console.error(`ERREUR FATALE: ${error.message}`);
  process.exit(1);
});
