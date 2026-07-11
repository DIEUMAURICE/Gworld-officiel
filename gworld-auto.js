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
