import axios from 'axios';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import fs from 'fs/promises'; // pour sauvegarde locale (optionnel)

// ============================================================
// Configuration
// ============================================================
const BASE_URL = 'https://franime.fr';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
const MAX_SAISONS = 20;
const DELAY_BETWEEN_REQUESTS = 1000; // ms
const OUTPUT_FILE = './data/franime-sync.json'; // sauvegarde locale

// ============================================================
// 1. Catalogue paginé (A-Z) avec Puppeteer
// ============================================================
async function fetchAllAnimeSlugs() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  
  const slugs = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = `${BASE_URL}/recherche?order=A-Z&page=${currentPage}`;
    console.log(`📄 Scraping catalogue page ${currentPage} : ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const pageSlugs = await page.$$eval('a[href^="/anime/"]', (links) => {
        return links
          .map(a => a.getAttribute('href'))
          .filter(href => href && !href.includes('?'))
          .map(href => href.split('/').pop())
          .filter(Boolean);
      });

      slugs.push(...pageSlugs);
      console.log(`   Trouvé ${pageSlugs.length} animes sur cette page`);

      // Vérifier la présence d'une page suivante
      const nextLink = await page.$('a[rel="next"], .pagination a:contains("Suivant")');
      if (nextLink && currentPage < 50) {
        currentPage++;
      } else {
        hasNextPage = false;
      }
    } catch (err) {
      console.error(`Erreur sur la page ${currentPage}:`, err.message);
      hasNextPage = false;
    }
  }

  await browser.close();
  const uniqueSlugs = [...new Set(slugs)];
  console.log(`✅ Total animes découverts : ${uniqueSlugs.length}`);
  return uniqueSlugs;
}

// ============================================================
// 2. Récupérer anime_id pour un slug donné
// ============================================================
async function getAnimeId(slug) {
  const url = `${BASE_URL}/anime/${slug}`;
  try {
    const html = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } }).then(r => r.data);
    const $ = cheerio.load(html);

    let id = $('input[name="anime_id"]').val();
    if (!id) id = $('[data-anime-id]').data('anime-id');
    if (!id) {
      const epLink = $('a[href*="anime_id="]').first().attr('href');
      if (epLink) {
        const params = new URLSearchParams(epLink.split('?')[1]);
        id = params.get('anime_id');
      }
    }
    return id || null;
  } catch (err) {
    console.warn(`   ⚠️ Impossible de récupérer l'anime_id pour ${slug}:`, err.message);
    return null;
  }
}

// ============================================================
// 3. Récupérer la liste des épisodes pour (langue, saison)
// ============================================================
async function getEpisodesForSeason(slug, animeId, lang, season) {
  const url = `${BASE_URL}/anime/${slug}?s=${season}&ep=&lang=${lang}&anime_id=${animeId}`;
  try {
    const html = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } }).then(r => r.data);
    const $ = cheerio.load(html);
    const episodes = [];
    $('a[href*="?ep="]').each((i, el) => {
      const href = $(el).attr('href');
      const params = new URLSearchParams(href.split('?')[1]);
      const ep = params.get('ep');
      if (ep) episodes.push(ep);
    });
    return episodes;
  } catch (err) {
    return [];
  }
}

// ============================================================
// 4. Extraire le code Sendvid d'une page d'épisode (fallback Puppeteer)
// ============================================================
async function getSendvidCode(episodeUrl) {
  // Essai simple avec axios + cheerio
  try {
    const html = await axios.get(episodeUrl, { headers: { 'User-Agent': USER_AGENT } }).then(r => r.data);
    const $ = cheerio.load(html);
    const iframe = $('iframe[src*="sendvid.com/embed/"]');
    if (iframe.length) {
      const src = iframe.attr('src');
      const match = src.match(/sendvid\.com\/embed\/([a-zA-Z0-9]+)/);
      if (match) return match[1];
    }
    const scriptMatch = html.match(/sendvid\.com\/embed\/([a-zA-Z0-9]+)/);
    if (scriptMatch) return scriptMatch[1];
  } catch (e) {
    // ignore
  }

  // Fallback Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  try {
    await page.goto(episodeUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('iframe[src*="sendvid.com/embed/"]', { timeout: 10000 });
    const src = await page.$eval('iframe[src*="sendvid.com/embed/"]', el => el.src);
    await browser.close();
    const match = src.match(/sendvid\.com\/embed\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch (err) {
    await browser.close();
    return null;
  }
}

// ============================================================
// 5. Traiter un anime complet (exploration et sauvegarde)
// ============================================================
async function processAnime(slug, results) {
  console.log(`\n🔍 Traitement de : ${slug}`);
  const animeId = await getAnimeId(slug);
  if (!animeId) {
    console.log(`   ❌ anime_id introuvable pour ${slug}, on passe.`);
    return;
  }
  console.log(`   anime_id = ${animeId}`);

  const languages = ['vo', 'vf'];
  let totalEpisodes = 0;
  const animeData = { slug, animeId, episodes: [] };

  for (const lang of languages) {
    let season = 1;
    let found = true;
    while (found && season <= MAX_SAISONS) {
      const episodes = await getEpisodesForSeason(slug, animeId, lang, season);
      if (episodes.length === 0) {
        found = false;
        break;
      }
      console.log(`   📺 Saison ${season}, langue ${lang} : ${episodes.length} épisodes`);
      totalEpisodes += episodes.length;

      for (const ep of episodes) {
        const epUrl = `${BASE_URL}/anime/${slug}?s=${season}&ep=${ep}&lang=${lang}&anime_id=${animeId}`;
        console.log(`      Épisode ${ep} (${lang})...`);
        const code = await getSendvidCode(epUrl);
        if (code) {
          console.log(`         ✅ Sendvid code : ${code}`);
          animeData.episodes.push({
            season,
            episode: ep,
            lang,
            sendvidCode: code,
            embedUrl: `//sendvid.com/embed/${code}`,
            iframe: `<iframe width="560" height="315" src="//sendvid.com/embed/${code}" frameborder="0" allowfullscreen></iframe>`
          });
        } else {
          console.log(`         ❌ Aucun Sendvid trouvé`);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      season++;
    }
  }
  console.log(`   ✅ Total épisodes traités : ${totalEpisodes}`);
  if (animeData.episodes.length > 0) {
    results.push(animeData);
  }
}

// ============================================================
// 6. Sauvegarde des résultats
// ============================================================
async function saveResults(results) {
  try {
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`💾 Résultats sauvegardés dans ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Erreur lors de la sauvegarde :', err.message);
  }
}

// ============================================================
// 7. Fonction principale
// ============================================================
async function syncFranime(limit = 0) {
  console.log('🚀 Début de la synchronisation Franime...');
  const slugs = await fetchAllAnimeSlugs();

  if (limit > 0) {
    slugs.splice(limit);
    console.log(`⚠️ Limité à ${limit} animes pour ce test.`);
  }

  const results = [];
  for (const slug of slugs) {
    await processAnime(slug, results);
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS));
  }

  await saveResults(results);

  console.log(`\n🏁 Synchronisation terminée. ${results.length} animes avec Sendvid trouvés.`);
  return {
    totalAnimes: slugs.length,
    animesWithSendvid: results.length,
    totalEpisodes: results.reduce((acc, a) => acc + a.episodes.length, 0)
  };
}

// ============================================================
// 8. Exécution avec argument limit (ex: node sync-franime.mjs 3)
// ============================================================
const args = process.argv.slice(2);
const limit = args.length > 0 ? parseInt(args[0], 10) : 0;

syncFranime(limit)
  .then(summary => {
    console.log('📊 Résumé :', summary);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur fatale :', err);
    process.exit(1);
  });
