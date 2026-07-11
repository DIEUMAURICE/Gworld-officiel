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
