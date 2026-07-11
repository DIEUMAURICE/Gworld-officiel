#!/usr/bin/env bash
set -euo pipefail

# G-WORLD UI + Admin upgrade
# Run from repository root AFTER install-gworld-auto.sh:
#   bash upgrade-gworld-ui-admin.sh

PUBLIC_FILE="index.html"
ADMIN_FILE="gworld-admin-supabase.html"

for file in "$PUBLIC_FILE" "$ADMIN_FILE"; do
  if [ ! -f "$file" ]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

cat > gworld-pro.css <<'CSS'
:root{
  --pro-ink:oklch(94% .01 55);
  --pro-muted:oklch(69% .018 295);
  --pro-base:oklch(10% .012 295);
  --pro-surface:oklch(14% .014 295);
  --pro-raised:oklch(19% .018 295);
  --pro-border:oklch(26% .025 295);
  --pro-accent:oklch(66% .19 32);
  --pro-accent-strong:oklch(58% .21 32);
  --pro-focus:oklch(78% .15 85);
  --pro-ease:cubic-bezier(.16,1,.3,1)
}
html{scroll-behavior:smooth}
body{background:var(--pro-base);color:var(--pro-ink);font-size:16px;letter-spacing:.008em}
header{background:var(--pro-base);border-bottom:1px solid var(--pro-border);backdrop-filter:none!important}
.header-inner{min-height:68px;gap:20px}
.logo-text{-webkit-text-fill-color:currentColor!important;background:none!important;color:var(--pro-ink)!important;font-weight:900;letter-spacing:-.04em}
.logo-icon{border-radius:10px!important;border-color:var(--pro-border)!important}
.search-wrap input{min-height:44px;background:var(--pro-surface)!important;border-color:var(--pro-border)!important;border-radius:10px!important;backdrop-filter:none!important}
.search-wrap input:focus{border-color:var(--pro-accent)!important;box-shadow:0 0 0 3px oklch(66% .19 32/.18)!important}
.btn-auth,.hero-play-btn,.f-btn.active{background:var(--pro-accent)!important;border-radius:9px!important;box-shadow:none!important}
.btn-auth:hover,.hero-play-btn:hover{background:var(--pro-accent-strong)!important;transform:translateY(-1px)!important}
.btn-icon,.f-btn,.sort-select,.random-btn,.genre-tag,.stat-chip{background:var(--pro-surface)!important;border-color:var(--pro-border)!important;border-radius:9px!important;backdrop-filter:none!important}
.sidebar{background:var(--pro-base)!important;border-color:var(--pro-border)!important;backdrop-filter:none!important}
.nav-item{border-left:0!important;border-radius:8px;margin:2px 10px;padding-left:14px!important}
.nav-item:hover,.nav-item.active{background:var(--pro-raised)!important;color:var(--pro-ink)!important;border-left:0!important}
.sidebar-label{color:var(--pro-muted)!important;letter-spacing:.1em!important}
.main{padding-top:28px!important}
.hero-banner{height:min(54vw,520px)!important;border-radius:20px!important;box-shadow:none!important;background:var(--pro-surface)!important}
.hero-banner-bg{animation:none!important}
.hero-banner-gradient{background:linear-gradient(90deg,oklch(10% .012 295/.96) 0%,oklch(10% .012 295/.7) 42%,oklch(10% .012 295/.12) 76%),linear-gradient(0deg,var(--pro-base),transparent 42%)!important}
.hero-banner-content{padding:clamp(24px,5vw,64px)!important}
.hero-banner-title{font-size:clamp(2rem,5vw,4.4rem)!important;max-width:13ch!important;letter-spacing:-.055em!important;line-height:.98!important;text-shadow:none!important}
.hero-banner-badge{background:var(--pro-accent)!important;border-radius:6px!important;box-shadow:none!important}
.hero-banner-meta span{background:var(--pro-surface)!important;border-radius:6px!important;backdrop-filter:none!important}
.hero-info-btn{background:var(--pro-raised)!important;border-color:var(--pro-border)!important;border-radius:9px!important;backdrop-filter:none!important}
.section{margin-bottom:64px!important}.section-head{margin-bottom:20px!important}.section-head-left h2{font-size:clamp(1.2rem,2vw,1.7rem)!important;text-transform:none!important;letter-spacing:-.03em!important}.section-line{display:none}.see-all-btn{color:var(--pro-accent)!important}
.anime-grid,.anime-grid-catalog{gap:24px 16px!important}.anime-card{background:transparent!important;border:0!important;border-radius:0!important;backdrop-filter:none!important;overflow:visible!important}.anime-card:hover{transform:translateY(-4px)!important;box-shadow:none!important}.card-poster{border-radius:12px!important;background:var(--pro-surface)!important}.card-info{padding:10px 1px 0!important}.card-title{font-size:.88rem!important}.card-play{background:var(--pro-accent)!important;box-shadow:none!important}.badge-new{background:var(--pro-accent)!important;box-shadow:none!important}
.detail-poster{border-color:var(--pro-border)!important;box-shadow:none!important}.detail-title{font-size:clamp(2rem,5vw,4rem)!important;letter-spacing:-.055em!important}.badge{background:var(--pro-surface)!important;border-color:var(--pro-border)!important;backdrop-filter:none!important;border-radius:6px!important}
button,a,input,select,textarea{transition:transform .2s var(--pro-ease),opacity .2s var(--pro-ease),background-color .15s,border-color .15s!important}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--pro-focus)!important;outline-offset:3px!important}
@media(max-width:768px){.main{padding:18px 14px 88px!important}.hero-banner{height:430px!important;border-radius:14px!important}.hero-banner-content{padding:24px!important}.anime-grid,.anime-grid-catalog{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px 10px!important}.card-title{font-size:.76rem!important}.section{margin-bottom:44px!important}}
@media(max-width:410px){.anime-grid,.anime-grid-catalog{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
CSS

cat > gworld-admin-pro.css <<'CSS'
:root{
  --admin-base:oklch(12% .012 285);
  --admin-surface:oklch(16% .015 285);
  --admin-raised:oklch(21% .02 285);
  --admin-border:oklch(27% .025 285);
  --admin-text:oklch(94% .01 60);
  --admin-muted:oklch(68% .02 285);
  --admin-accent:oklch(68% .18 32);
  --admin-green:oklch(72% .16 145)
}
body{background:var(--admin-base)!important;color:var(--admin-text)!important;font-size:16px!important}
.admin-sidebar{background:var(--admin-surface)!important;border-right:1px solid var(--admin-border)!important;width:248px!important}
.sidebar-brand{padding:24px!important;border-color:var(--admin-border)!important}.sidebar-brand h2{color:var(--admin-text)!important;letter-spacing:-.04em!important}.sidebar-brand p,.nav-group-label{color:var(--admin-muted)!important}.nav-link{border-left:0!important;margin:2px 10px!important;border-radius:8px!important;padding:11px 14px!important}.nav-link:hover,.nav-link.active{border-left:0!important;background:var(--admin-raised)!important;color:var(--admin-text)!important}.admin-main{margin-left:248px!important;padding:40px clamp(24px,4vw,64px)!important}.page-title{font-size:clamp(2rem,4vw,3.5rem)!important;letter-spacing:-.055em!important}.page-sub{font-size:1rem!important;color:var(--admin-muted)!important}.stats-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:1px!important;background:var(--admin-border)!important;border:1px solid var(--admin-border)!important;border-radius:14px!important;overflow:hidden!important}.stat-card{border:0!important;border-radius:0!important;background:var(--admin-surface)!important;padding:24px!important}.stat-card-value{color:var(--admin-text)!important;font-size:2rem!important}.table-wrap,.form-section,.settings-section{background:var(--admin-surface)!important;border-color:var(--admin-border)!important;border-radius:14px!important}.table-header,th,td{border-color:var(--admin-border)!important}th{background:var(--admin-raised)!important;color:var(--admin-muted)!important}tr:hover td{background:var(--admin-raised)!important}.form-field label,.form-section h3,.settings-section h3{color:var(--admin-muted)!important}.form-field input,.form-field textarea,.form-field select,.search-input{min-height:44px!important;background:var(--admin-raised)!important;border-color:var(--admin-border)!important;border-radius:8px!important}.btn{min-height:42px!important;border-radius:8px!important;letter-spacing:0!important}.btn-primary,.login-btn{background:var(--admin-accent)!important;color:oklch(97% .006 60)!important}.btn-success{background:var(--admin-green)!important;color:var(--admin-base)!important}.login-screen{background:var(--admin-base)!important}.login-box{background:var(--admin-surface)!important;border-color:var(--admin-border)!important;border-radius:16px!important}.login-logo h1{color:var(--admin-text)!important;letter-spacing:-.045em!important}.auto-admin-status{display:flex;align-items:center;gap:8px;color:var(--admin-muted);font-size:.85rem}.auto-admin-dot{width:8px;height:8px;border-radius:50%;background:var(--admin-green)}.auto-admin-actions{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 24px}.auto-admin-note{max-width:68ch;color:var(--admin-muted);line-height:1.65;margin-bottom:28px}.auto-admin-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;color:var(--admin-muted)}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--admin-accent)!important;outline-offset:3px!important}@media(max-width:900px){.admin-main{margin-left:0!important;padding:24px 16px 80px!important}.stats-grid{grid-template-columns:1fr 1fr!important}}@media(max-width:560px){.stats-grid{grid-template-columns:1fr!important}.table-wrap{overflow-x:auto!important}}
CSS

cat > gworld-admin-auto.js <<'JS'
(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const date = value => value ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Jamais';

  function mount() {
    const nav = document.querySelector('.sidebar-nav');
    const main = document.querySelector('.admin-main');
    if (!nav || !main || document.getElementById('sec-automation')) return;

    const link = document.createElement('div');
    link.className = 'nav-link';
    link.dataset.section = 'automation';
    link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg><span>Automatisation</span><span class="nav-badge" id="autoNavBadge">0</span>';
    nav.append(link);

    const page = document.createElement('section');
    page.className = 'admin-page';
    page.id = 'sec-automation';
    page.innerHTML = `
      <h1 class="page-title">Automatisation</h1>
      <p class="page-sub">Suivi des épisodes importés et santé de la synchronisation.</p>
      <div class="auto-admin-actions">
        <a class="btn btn-primary" href="https://github.com/DIEUMAURICE/Gworld-officiel/actions/workflows/sync-franime.yml" target="_blank" rel="noopener">Lancer une synchronisation</a>
        <button class="btn btn-ghost" id="autoRefreshBtn">Actualiser</button>
        <span class="auto-admin-status"><span class="auto-admin-dot"></span>Planifiée toutes les 6 heures</span>
      </div>
      <p class="auto-admin-note">Les lecteurs Sendvid sont validés côté serveur, dédupliqués par page source puis publiés dans le catalogue automatique. La clé service Supabase reste dans GitHub Secrets, jamais dans ce panneau.</p>
      <div class="stats-grid" id="autoStats">
        <div class="stat-card"><div class="stat-card-label">Épisodes publiés</div><div class="stat-card-value">…</div></div>
        <div class="stat-card"><div class="stat-card-label">Ajoutés au dernier passage</div><div class="stat-card-value">…</div></div>
        <div class="stat-card"><div class="stat-card-label">Erreurs récentes</div><div class="stat-card-value">…</div></div>
        <div class="stat-card"><div class="stat-card-label">Dernière synchro</div><div class="stat-card-value" style="font-size:1rem">…</div></div>
      </div>
      <div class="table-wrap">
        <div class="table-header"><h3>Derniers épisodes importés</h3><span class="auto-admin-code">auto_episodes</span></div>
        <table><thead><tr><th>Anime</th><th>Épisode</th><th>Langue</th><th>Lecteur</th><th>Ajouté</th></tr></thead><tbody id="autoEpisodesBody"><tr><td colspan="5">Chargement…</td></tr></tbody></table>
      </div>`;
    main.append(page);

    link.addEventListener('click', () => {
      document.querySelectorAll('.admin-page').forEach(node => node.classList.remove('active'));
      document.querySelectorAll('.nav-link').forEach(node => node.classList.remove('active'));
      page.classList.add('active');
      link.classList.add('active');
      loadAutomation();
    });
    page.querySelector('#autoRefreshBtn').addEventListener('click', loadAutomation);
  }

  async function loadAutomation() {
    if (typeof db === 'undefined') return;
    const [{ count }, runResult, episodesResult] = await Promise.all([
      db.from('auto_episodes').select('*',{count:'exact',head:true}).eq('published',true),
      db.from('sync_runs').select('*').order('finished_at',{ascending:false}).limit(1),
      db.from('auto_episodes').select('anime_title,season_number,episode_number,language,embed_url,created_at').order('created_at',{ascending:false}).limit(30)
    ]);
    const run = runResult.data?.[0] || {};
    document.getElementById('autoNavBadge').textContent = count || 0;
    document.getElementById('autoStats').innerHTML = `
      <div class="stat-card"><div class="stat-card-label">Épisodes publiés</div><div class="stat-card-value">${count || 0}</div></div>
      <div class="stat-card"><div class="stat-card-label">Ajoutés au dernier passage</div><div class="stat-card-value">${run.saved || 0}</div></div>
      <div class="stat-card"><div class="stat-card-label">Erreurs récentes</div><div class="stat-card-value">${run.failed || 0}</div></div>
      <div class="stat-card"><div class="stat-card-label">Dernière synchro</div><div class="stat-card-value" style="font-size:1rem">${esc(date(run.finished_at))}</div></div>`;
    const body = document.getElementById('autoEpisodesBody');
    const rows = episodesResult.data || [];
    body.innerHTML = rows.length ? rows.map(item => `<tr><td>${esc(item.anime_title)}</td><td>S${Number(item.season_number)} E${Number(item.episode_number)}</td><td><span class="pill pill-purple">${esc(item.language)}</span></td><td><a href="${esc(item.embed_url)}" target="_blank" rel="noopener noreferrer">Ouvrir</a></td><td>${esc(date(item.created_at))}</td></tr>`).join('') : '<tr><td colspan="5">Aucun épisode importé.</td></tr>';
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
JS

python3 - <<'PY'
from pathlib import Path

def inject(path_name, head_asset, body_asset):
    path = Path(path_name)
    text = path.read_text(encoding='utf-8')
    if head_asset not in text:
        text = text.replace('</head>', f'  {head_asset}\n</head>', 1)
    if body_asset not in text:
        text = text.replace('</body>', f'  {body_asset}\n</body>', 1)
    path.write_text(text, encoding='utf-8')

inject('index.html', '<link rel="stylesheet" href="/gworld-pro.css">', '<script src="/gworld-auto.js" defer></script>')
inject('gworld-admin-supabase.html', '<link rel="stylesheet" href="/gworld-admin-pro.css">', '<script src="/gworld-admin-auto.js" defer></script>')
PY

# Improve cache policy without disabling caching for every static asset.
cat > vercel.json <<'JSON'
{
  "headers": [
    {
      "source": "/(.*).(css|js|png|jpg|jpeg|webp|svg|woff2)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/((?!.*\\.).*)", "destination": "/index.html" }
  ]
}
JSON

printf '\nUpgrade complete. Commit these files together with the automation files.\n'
