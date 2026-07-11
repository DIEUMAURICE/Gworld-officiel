import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://franime.fr';
const CATALOG_URL = `${BASE_URL}/recherche?order=A-Z`;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

/*
 * Limites par exécution.
 *
 * MAX_CATALOG_PAGES=0 signifie toutes les pages.
 * MAX_ANIMES=20 signifie 20 animes traités par run.
 * MAX_EPISODES_PER_ANIME=0 signifie tous les épisodes.
 *
 * Le catalogue complet est découvert à chaque run, mais seulement
 * un lot d'animes est traité afin de ne pas dépasser les 45 minutes.
 */
const MAX_CATALOG_PAGES = Number(
  process.env.MAX_CATALOG_PAGES || 0
);

const MAX_ANIMES = Number(
  process.env.MAX_ANIMES || 20
);

const MAX_EPISODES_PER_ANIME = Number(
  process.env.MAX_EPISODES_PER_ANIME || 0
);

const MANUAL_START_INDEX =
  process.env.START_INDEX !== undefined
    ? Number(process.env.START_INDEX)
    : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY est manquant'
  );
}

const db = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

function normalize(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAnimeUrl(value) {
  try {
    const url = new URL(value, BASE_URL);

    return (
      url.origin === BASE_URL &&
      url.pathname.startsWith('/anime/')
    );
  } catch {
    return false;
  }
}

function normalizeAnimeUrl(value) {
  try {
    const source = new URL(value, BASE_URL);

    if (!isAnimeUrl(source.href)) return null;

    const result = new URL(
      `${source.origin}${source.pathname}`
    );

    const animeId =
      source.searchParams.get('anime_id');

    if (animeId) {
      result.searchParams.set('anime_id', animeId);
    }

    return result.href;
  } catch {
    return null;
  }
}

function getAnimeSlug(value) {
  try {
    return new URL(value)
      .pathname
      .split('/')
      .filter(Boolean)
      .pop();
  } catch {
    return null;
  }
}

function createEpisodeUrl(
  animeUrl,
  season,
  episode,
  language
) {
  const source = new URL(animeUrl);
  const result = new URL(
    `${source.origin}${source.pathname}`
  );

  /*
   * Ordre stable des paramètres pour éviter les doublons.
   */
  result.searchParams.set('s', String(season));
  result.searchParams.set('ep', String(episode));
  result.searchParams.set('lang', language);

  const animeId =
    source.searchParams.get('anime_id');

  if (animeId) {
    result.searchParams.set('anime_id', animeId);
  }

  return result.href;
}

function absoluteUrl(value) {
  if (!value) return null;

  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return null;
  }
}

function sendvidEmbedFromValue(value) {
  if (!value) return null;

  const decoded = String(value)
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&/g, '&');

  const match = decoded.match(
    /(?:https?:)?\/\/(?:www\.)?sendvid\.com\/(?:embed\/)?([A-Za-z0-9_-]{5,40})/i
  );

  if (!match) return null;

  return `https://sendvid.com/embed/${match[1]}`;
}

function findSendvidCodes(value) {
  const text = String(value || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&/g, '&');

  const codes = new Set();

  /*
   * URL Sendvid complète.
   */
  for (
    const match of text.matchAll(
      /(?:https?:)?\/\/(?:www\.)?sendvid\.com\/(?:embed\/)?([A-Za-z0-9_-]{5,40})/gi
    )
  ) {
    codes.add(match[1]);
  }

  /*
   * Réponse JSON du type:
   * {"player":"sendvid","code":"stq3x7j"}
   */
  for (
    const match of text.matchAll(
      /sendvid[\s\S]{0,160}?"(?:code|id|slug|key)"\s*:\s*"([A-Za-z0-9_-]{5,40})"/gi
    )
  ) {
    codes.add(match[1]);
  }

  /*
   * Réponse JSON avec l'ordre inverse:
   * {"code":"stq3x7j","player":"sendvid"}
   */
  for (
    const match of text.matchAll(
      /"(?:code|id|slug|key)"\s*:\s*"([A-Za-z0-9_-]{5,40})"[\s\S]{0,160}?sendvid/gi
    )
  ) {
    codes.add(match[1]);
  }

  return [...codes];
}

async function openPage(page, url) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForLoadState('networkidle', {
    timeout: 12000
  }).catch(() => {});

  await page.waitForTimeout(2000);
}

async function dismissDialogs(page) {
  const patterns = [
    /j['’]ai compris/i,
    /^accepter$/i,
    /^continuer$/i,
    /^confirmer$/i,
    /^fermer$/i
  ];

  for (const pattern of patterns) {
    const candidates = page
      .locator('button, [role="button"]')
      .filter({ hasText: pattern });

    const count =
      await candidates.count().catch(() => 0);

    for (let index = 0; index < count; index++) {
      const candidate = candidates.nth(index);

      if (
        await candidate
          .isVisible()
          .catch(() => false)
      ) {
        await candidate
          .click({ force: true })
          .catch(() => {});

        await page.waitForTimeout(300);
      }
    }
  }
}

async function scrollUntilStable(page) {
  let previousCount = -1;
  let stablePasses = 0;

  for (let pass = 0; pass < 20; pass++) {
    const count = await page
      .locator('a[href*="/anime/"]')
      .count()
      .catch(() => 0);

    if (count === previousCount) {
      stablePasses++;
    } else {
      stablePasses = 0;
      previousCount = count;
    }

    if (stablePasses >= 3) break;

    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(500);
  }
}

async function collectCatalog(page) {
  const animeMap = new Map();
  let pageNumber = 1;
  let consecutiveEmptyPages = 0;

  while (true) {
    if (
      MAX_CATALOG_PAGES > 0 &&
      pageNumber > MAX_CATALOG_PAGES
    ) {
      break;
    }

    const catalogPage =
      `${CATALOG_URL}&page=${pageNumber}`;

    console.log(`Catalogue: ${catalogPage}`);

    try {
      await openPage(page, catalogPage);
      await dismissDialogs(page);
      await scrollUntilStable(page);

      const links = await page
        .locator('a[href*="/anime/"]')
        .evaluateAll(nodes =>
          nodes.map(node => ({
            href:
              node.href ||
              node.getAttribute('href') ||
              '',
            text:
              node.textContent?.trim() || '',
            image:
              node.querySelector('img')?.src || ''
          }))
        )
        .catch(() => []);

      let newOnPage = 0;

      for (const item of links) {
        const url = normalizeAnimeUrl(item.href);

        if (!url) continue;

        const slug = getAnimeSlug(url);

        if (!slug || animeMap.has(url)) continue;

        animeMap.set(url, {
          url,
          slug,
          catalogTitle: normalize(item.text),
          catalogPoster: absoluteUrl(item.image)
        });

        newOnPage++;
      }

      console.log(
        `Page ${pageNumber}: ${newOnPage} nouveaux animes`
      );

      if (newOnPage === 0) {
        consecutiveEmptyPages++;
      } else {
        consecutiveEmptyPages = 0;
      }

      /*
       * Deux pages vides consécutives indiquent la fin.
       */
      if (consecutiveEmptyPages >= 2) break;

      pageNumber++;
    } catch (error) {
      console.error(
        `Erreur catalogue page ${pageNumber}:`,
        error.message
      );

      consecutiveEmptyPages++;

      if (consecutiveEmptyPages >= 2) break;

      pageNumber++;
    }
  }

  const result = [...animeMap.values()]
    .sort((first, second) =>
      first.slug.localeCompare(
        second.slug,
        'fr',
        { sensitivity: 'base' }
      )
    );

  console.log(
    `${result.length} fiches anime découvertes au total`
  );

  return result;
}

function selectAutomaticBatch(catalog) {
  if (!catalog.length) return [];

  if (
    !MAX_ANIMES ||
    MAX_ANIMES >= catalog.length
  ) {
    return catalog;
  }

  /*
   * Un nouveau lot est automatiquement choisi toutes les 6 heures.
   * Le catalogue entier est donc couvert progressivement de A à Z.
   */
  const sixHourSlot = Math.floor(
    Date.now() / (6 * 60 * 60 * 1000)
  );

  const batchCount = Math.ceil(
    catalog.length / MAX_ANIMES
  );

  const start =
    MANUAL_START_INDEX !== null
      ? Math.max(0, MANUAL_START_INDEX)
      : (sixHourSlot % batchCount) * MAX_ANIMES;

  const batch = catalog.slice(
    start,
    start + MAX_ANIMES
  );

  console.log(
    `Lot traité: index ${start} à ` +
    `${start + batch.length - 1}`
  );

  return batch;
}

async function clickLoadEpisodes(page) {
  const button = page
    .locator('button, [role="button"]')
    .filter({
      hasText: /charger les informations des épisodes/i
    })
    .first();

  if (
    await button
      .isVisible()
      .catch(() => false)
  ) {
    await button
      .click({ force: true })
      .catch(() => {});

    await page.waitForTimeout(2000);
  }
}

async function extractAnimeMetadata(page, fallback) {
  return page.evaluate(fallbackData => {
    const title =
      document.querySelector('h1')
        ?.textContent?.trim() ||
      fallbackData.catalogTitle ||
      fallbackData.slug;

    const images = [
      ...document.querySelectorAll(
        'main img, article img, img'
      )
    ];

    const poster =
      images.find(image =>
        /poster|affiche|cover/i.test(
          `${image.alt || ''} ${image.src || ''}`
        )
      ) ||
      images.find(image =>
        image.naturalHeight > image.naturalWidth
      ) ||
      null;

    const descriptionHeading = [
      ...document.querySelectorAll('h2,h3')
    ].find(node =>
      /description|synopsis/i.test(
        node.textContent || ''
      )
    );

    const description =
      descriptionHeading
        ?.nextElementSibling
        ?.textContent
        ?.trim() || '';

    return {
      title,
      poster:
        poster?.src ||
        fallbackData.catalogPoster ||
        '',
      description
    };
  }, fallback);
}

async function detectSeasons(page) {
  const texts = await page
    .locator(
      'button, a, option, [role="button"], [role="tab"], label'
    )
    .allTextContents()
    .catch(() => []);

  const seasons = new Set();

  for (const textValue of texts) {
    const text = normalize(textValue);

    const match = text.match(
      /^Saison\s+(\d+)$/i
    );

    if (match) {
      seasons.add(Number(match[1]));
    }
  }

  /*
   * Une fiche avec une seule saison peut ne pas avoir de sélecteur.
   */
  if (!seasons.size) {
    seasons.add(1);
  }

  return [...seasons].sort((a, b) => a - b);
}

async function detectLanguages(page) {
  const bodyText = normalize(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  );

  const languages = [];

  if (/\bVOSTFR\b/i.test(bodyText)) {
    languages.push('vo');
  }

  if (/\bVF\b/i.test(bodyText)) {
    languages.push('vf');
  }

  if (!languages.length) {
    languages.push('vo');
  }

  return languages;
}

async function detectEpisodeNumbers(
  page,
  anime,
  season,
  language
) {
  const seasonUrl = createEpisodeUrl(
    anime.url,
    season,
    '',
    language
  );

  console.log(
    `Liste épisodes: ${seasonUrl}`
  );

  await openPage(page, seasonUrl);
  await dismissDialogs(page);
  await clickLoadEpisodes(page);

  /*
   * Scroll pour les listes chargées progressivement.
   */
  for (let pass = 0; pass < 12; pass++) {
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(350);
  }

  const episodes = new Set();

  /*
   * Première source fiable: les href contenant ep=.
   */
  const hrefs = await page
    .locator('a[href*="ep="]')
    .evaluateAll(nodes =>
      nodes.map(node =>
        node.href ||
        node.getAttribute('href') ||
        ''
      )
    )
    .catch(() => []);

  for (const href of hrefs) {
    try {
      const episodeUrl = new URL(
        href,
        BASE_URL
      );

      const episode = Number(
        episodeUrl.searchParams.get('ep')
      );

      const urlSeason = Number(
        episodeUrl.searchParams.get('s') || season
      );

      const urlLanguage =
        episodeUrl.searchParams.get('lang') ||
        language;

      if (
        Number.isInteger(episode) &&
        episode > 0 &&
        urlSeason === season &&
        urlLanguage === language
      ) {
        episodes.add(episode);
      }
    } catch {
      // URL incorrecte ignorée.
    }
  }

  /*
   * Deuxième source fiable: éléments dont le texte exact est
   * "Épisode 1", "Épisode 2", etc.
   *
   * Contrairement à l'ancien script, on n'analyse jamais tout
   * le HTML avec une regex vague. Cela évite le faux s=999.
   */
  const visibleTexts = await page
    .locator(
      'button, a, [role="button"], [role="option"], li'
    )
    .allTextContents()
    .catch(() => []);

  for (const textValue of visibleTexts) {
    const text = normalize(textValue);

    const match = text.match(
      /^Épisode\s+(\d+)$/i
    );

    if (match) {
      episodes.add(Number(match[1]));
    }
  }

  let result = [...episodes]
    .filter(
      number =>
        Number.isInteger(number) &&
        number > 0 &&
        number < 10000
    )
    .sort((a, b) => a - b);

  if (MAX_EPISODES_PER_ANIME > 0) {
    /*
     * On traite les épisodes les plus récents si une limite existe.
     */
    result = result.slice(
      -MAX_EPISODES_PER_ANIME
    );
  }

  return result;
}

async function revealPlayerSelection(page) {
  const readerControls = page
    .locator(
      'button, [role="button"], [role="combobox"]'
    )
    .filter({
      hasText: /lecteur/i
    });

  const count =
    await readerControls.count().catch(() => 0);

  for (let index = 0; index < count; index++) {
    const control = readerControls.nth(index);

    if (
      await control
        .isVisible()
        .catch(() => false)
    ) {
      await control
        .click({ force: true })
        .catch(() => {});

      await page.waitForTimeout(500);
    }
  }
}

async function selectSendvid(page) {
  let selected = false;

  await revealPlayerSelection(page);

  /*
   * Cas d'un select HTML.
   */
  const selects = page.locator('select');
  const selectCount =
    await selects.count().catch(() => 0);

  for (let index = 0; index < selectCount; index++) {
    const select = selects.nth(index);

    const value = await select
      .evaluate(node => {
        const option = [...node.options].find(item =>
          /sendvid/i.test(
            item.textContent || ''
          )
        );

        return option?.value || null;
      })
      .catch(() => null);

    if (value !== null) {
      await select
        .selectOption(value)
        .catch(() => {});

      selected = true;
      await page.waitForTimeout(1000);
    }
  }

  /*
   * Cas d'un bouton, onglet, menu ou lien.
   */
  const candidates = page
    .locator(
      'button, a, [role="button"], [role="tab"], ' +
      '[role="option"], label, li'
    )
    .filter({
      hasText: /sendvid/i
    });

  const count =
    await candidates.count().catch(() => 0);

  for (let index = 0; index < count; index++) {
    const candidate = candidates.nth(index);

    if (
      !(await candidate
        .isVisible()
        .catch(() => false))
    ) {
      continue;
    }

    await candidate
      .scrollIntoViewIfNeeded()
      .catch(() => {});

    await candidate
      .click({
        force: true,
        timeout: 5000
      })
      .catch(() => {});

    selected = true;
    await page.waitForTimeout(1200);
  }

  return selected;
}

async function startVideo(page) {
  const watchButtons = page
    .locator('button, [role="button"], a')
    .filter({
      hasText:
        /regarder l['’]épisode|lancer la vidéo|lecture|play/i
    });

  const count =
    await watchButtons.count().catch(() => 0);

  for (let index = 0; index < count; index++) {
    const button = watchButtons.nth(index);

    if (
      await button
        .isVisible()
        .catch(() => false)
    ) {
      await button
        .click({ force: true })
        .catch(() => {});

      await page.waitForTimeout(1200);
    }
  }

  /*
   * Tentative sur les boutons Play sans texte.
   */
  const playButtons = page.locator(
    'button[aria-label*="play" i], ' +
    'button[title*="play" i], ' +
    '[class*="play" i]'
  );

  const playCount =
    await playButtons.count().catch(() => 0);

  for (let index = 0; index < playCount; index++) {
    const button = playButtons.nth(index);

    if (
      await button
        .isVisible()
        .catch(() => false)
    ) {
      await button
        .click({ force: true })
        .catch(() => {});

      await page.waitForTimeout(800);
    }
  }
}

async function extractSendvid(
  page,
  episodeUrl
) {
  const codes = new Set();

  const capture = value => {
    const embed = sendvidEmbedFromValue(value);

    if (embed) {
      const code = embed
        .split('/')
        .filter(Boolean)
        .pop();

      if (code) codes.add(code);
    }

    for (const code of findSendvidCodes(value)) {
      codes.add(code);
    }
  };

  const onRequest = request => {
    capture(request.url());
    capture(request.postData() || '');
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
      const body = await response
        .text()
        .catch(() => '');

      if (body && body.length < 8_000_000) {
        capture(body);
      }
    }
  };

  const onFrame = frame => {
    capture(frame.url());
  };

  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('framenavigated', onFrame);

  try {
    console.log(`Épisode: ${episodeUrl}`);

    await openPage(page, episodeUrl);
    await dismissDialogs(page);

    /*
     * Franime affiche FILEMOON par défaut.
     * On ouvre le sélecteur puis choisit Sendvid.
     */
    const selected = await selectSendvid(page);

    if (!selected) {
      console.log(
        `Sendvid non proposé: ${episodeUrl}`
      );

      return null;
    }

    /*
     * L'URL ou le code peut n'apparaître qu'après lecture.
     */
    await startVideo(page);
    await page.waitForTimeout(3500);

    /*
     * Certains changements de lecteur reconstruisent l'interface.
     */
    await selectSendvid(page);
    await startVideo(page);
    await page.waitForTimeout(2500);

    capture(await page.content());

    const iframeSources = await page
      .locator('iframe')
      .evaluateAll(nodes =>
        nodes.map(node =>
          node.src ||
          node.getAttribute('src') ||
          ''
        )
      )
      .catch(() => []);

    iframeSources.forEach(capture);

    for (const frame of page.frames()) {
      capture(frame.url());

      const frameContent = await frame
        .content()
        .catch(() => '');

      capture(frameContent);
    }

    const code = [...codes][0];

    if (!code) {
      console.log(
        `Code Sendvid introuvable: ${episodeUrl}`
      );

      return null;
    }

    return {
      code,
      embedUrl:
        `https://sendvid.com/embed/${code}`,
      publicUrl:
        `https://sendvid.com/${code}`
    };
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('framenavigated', onFrame);
  }
}

async function findExistingEpisode(record) {
  const { data, error } = await db
    .from('auto_episodes')
    .select('id, embed_url')
    .eq('anime_slug', record.anime_slug)
    .eq('season_number', record.season_number)
    .eq('episode_number', record.episode_number)
    .eq('language', record.language)
    .limit(1);

  if (error) throw error;

  return data?.[0] || null;
}

async function saveEpisode(record) {
  const existing =
    await findExistingEpisode(record);

  if (existing) {
    const { error } = await db
      .from('auto_episodes')
      .update({
        source_page: record.source_page,
        anime_title: record.anime_title,
        embed_url: record.embed_url,
        poster_url: record.poster_url,
        description: record.description,
        published: true,
        checked_at: record.checked_at
      })
      .eq('id', existing.id);

    if (error) throw error;

    return existing.embed_url === record.embed_url
      ? 'unchanged'
      : 'updated';
  }

  const { error } = await db
    .from('auto_episodes')
    .insert(record);

  if (error) throw error;

  return 'inserted';
}

async function processAnime(page, anime) {
  console.log(`\n=== ${anime.slug} ===`);
  console.log(`Fiche: ${anime.url}`);

  await openPage(page, anime.url);
  await dismissDialogs(page);
  await clickLoadEpisodes(page);

  const metadata = await extractAnimeMetadata(
    page,
    anime
  );

  const seasons = await detectSeasons(page);
  const languages = await detectLanguages(page);

  console.log(
    `Titre: ${metadata.title}`
  );

  console.log(
    `Saisons: ${seasons.join(', ')}`
  );

  console.log(
    `Langues: ${languages.join(', ')}`
  );

  const episodeUrls = [];

  for (const language of languages) {
    for (const season of seasons) {
      const episodes =
        await detectEpisodeNumbers(
          page,
          anime,
          season,
          language
        );

      console.log(
        `${language.toUpperCase()} saison ${season}: ` +
        `${episodes.length} épisodes`
      );

      for (const episode of episodes) {
        episodeUrls.push({
          url: createEpisodeUrl(
            anime.url,
            season,
            episode,
            language
          ),
          season,
          episode,
          language
        });
      }
    }
  }

  return {
    metadata,
    episodeUrls
  };
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
      'Mozilla/5.0 (X11; Linux x86_64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/126.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.setDefaultTimeout(20000);

  let discovered = 0;
  let examined = 0;
  let saved = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const catalog = await collectCatalog(page);

    discovered = catalog.length;

    if (!catalog.length) {
      throw new Error(
        'Aucun anime trouvé dans le catalogue A à Z'
      );
    }

    const batch = selectAutomaticBatch(catalog);

    for (const anime of batch) {
      try {
        const result =
          await processAnime(page, anime);

        for (const episode of result.episodeUrls) {
          examined++;

          try {
            const sendvid =
              await extractSendvid(
                page,
                episode.url
              );

            if (!sendvid) {
              skipped++;
              continue;
            }

            const record = {
              source: 'franime',
              source_page: episode.url,
              anime_slug: anime.slug,
              anime_title:
                result.metadata.title ||
                anime.catalogTitle ||
                anime.slug,
              season_number: episode.season,
              episode_number: episode.episode,
              language:
                episode.language === 'vf'
                  ? 'VF'
                  : 'VOSTFR',
              embed_url: sendvid.embedUrl,
              poster_url:
                absoluteUrl(
                  result.metadata.poster
                ),
              description:
                result.metadata.description ||
                null,
              published: true,
              checked_at:
                new Date().toISOString()
            };

            const action =
              await saveEpisode(record);

            if (action === 'inserted') {
              saved++;

              console.log(
                `NOUVEAU: ${record.anime_title} ` +
                `S${record.season_number}` +
                `E${record.episode_number} ` +
                `${record.language} ` +
                `${record.embed_url}`
              );
            } else if (action === 'updated') {
              updated++;

              console.log(
                `MIS À JOUR: ${record.anime_title} ` +
                `S${record.season_number}` +
                `E${record.episode_number} ` +
                `${record.language}`
              );
            } else {
              unchanged++;

              console.log(
                `DÉJÀ PRÉSENT: ${record.anime_title} ` +
                `S${record.season_number}` +
                `E${record.episode_number} ` +
                `${record.language}`
              );
            }
          } catch (error) {
            failed++;

            console.error(
              `Erreur épisode ${episode.url}:`,
              error.message
            );
          }
        }
      } catch (error) {
        failed++;

        console.error(
          `Erreur anime ${anime.url}:`,
          error.message
        );
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    discovered,
    saved,
    skipped: skipped + unchanged,
    failed,
    finished_at: new Date().toISOString()
  };

  const { error: runError } = await db
    .from('sync_runs')
    .insert(summary);

  if (runError) {
    console.error(
      `Résumé non enregistré: ${runError.message}`
    );
  }

  console.log('\n=== RÉSUMÉ ===');

  console.log(
    JSON.stringify(
      {
        catalog_animes: discovered,
        episodes_examined: examined,
        inserted: saved,
        updated,
        unchanged,
        without_sendvid: skipped,
        failed
      },
      null,
      2
    )
  );

  /*
   * 0 nouveau n'est pas une erreur si les épisodes étaient
   * déjà présents. Le workflow échoue seulement s'il n'a pu
   * examiner aucun épisode ou si tout a réellement cassé.
   */
  if (examined === 0) {
    throw new Error(
      'Aucun épisode réel détecté dans le lot'
    );
  }

  if (
    saved === 0 &&
    updated === 0 &&
    unchanged === 0 &&
    failed > 0
  ) {
    throw new Error(
      'Aucun épisode importé ou vérifié'
    );
  }
}

main().catch(error => {
  console.error(
    `ERREUR FATALE: ${error.message}`
  );

  process.exit(1);
});
