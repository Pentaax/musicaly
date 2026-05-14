// ===== VIEWS =====
const Views = {
  container: null,

  init() {
    this.container = document.getElementById('view-container');
  },

  async render(view, data = null) {
    window.currentView = view;
    this.container.classList.remove('fade-in');
    void this.container.offsetWidth;
    this.container.classList.add('fade-in');

    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.view === view);
    });

    switch (view) {
      case 'home': await this.renderHome(); break;
      case 'search': await this.renderSearch(data); break;
      case 'library': await this.renderLibrary(); break;
      case 'favorites': await this.renderFavorites(); break;
      case 'history': await this.renderHistory(); break;
      case 'playlist': await this.renderPlaylist(data); break;
    }
  },

  async renderHome() {
    const history = await Storage.getHistory();
    const favorites = await Storage.getFavorites();

    let html = `
      <div class="hero">
        <h1 class="hero-title">${greeting()}</h1>
        <p class="hero-subtitle">O que vamos ouvir hoje?</p>
      </div>
    `;

    if (favorites.length > 0) {
      html += `
        <section class="section">
          <div class="section-header">
            <div>
              <h2 class="section-title">Suas curtidas</h2>
              <p class="section-subtitle">Comece a tocar do que você ama</p>
            </div>
          </div>
          <div class="quick-grid">
            ${favorites.slice(0, 8).map(t => this.quickCard(t, favorites)).join('')}
          </div>
        </section>
      `;
    }

    if (history.length > 0) {
      html += `
        <section class="section">
          <div class="section-header">
            <div>
              <h2 class="section-title">Tocadas recentemente</h2>
              <p class="section-subtitle">Continue de onde parou</p>
            </div>
          </div>
          <div class="card-grid">
            ${history.slice(0, 10).map(t => this.bigCard(t, history)).join('')}
          </div>
        </section>
      `;
    }

    if (favorites.length === 0 && history.length === 0) {
      html += this.emptyState(
        'music',
        'Comece sua jornada musical',
        'Use a busca acima para encontrar músicas, artistas ou álbuns favoritos.'
      );
    }

    this.container.innerHTML = html;
    this.attachCardListeners();
  },

  async renderSearch(query) {
    if (!query || query.trim() === '') {
      this.container.innerHTML = this.emptyState(
        'search',
        'Procure por suas músicas favoritas',
        'Encontre artistas, álbuns ou faixas digitando na barra de busca acima.'
      );
      return;
    }

    this.container.innerHTML = `
      <div class="hero">
        <h1 class="hero-title">Resultados</h1>
        <p class="hero-subtitle">Buscando "${escapeHtml(query)}"...</p>
      </div>
      <div class="loading"><div class="spinner"></div></div>
    `;

    const results = await api.searchSongs(query);
    if (results.error || !Array.isArray(results)) {
      this.container.innerHTML = this.emptyState('error', 'Erro na busca', results.error || 'Tente novamente.');
      return;
    }

    if (results.length === 0) {
      this.container.innerHTML = this.emptyState('search', 'Nenhum resultado', `Não encontramos nada para "${escapeHtml(query)}".`);
      return;
    }

    this.container.innerHTML = `
      <div class="hero">
        <h1 class="hero-title">Resultados</h1>
        <p class="hero-subtitle">${results.length} faixas encontradas para "${escapeHtml(query)}"</p>
      </div>
      <div class="track-list">
        <div class="track-list-header">
          <div>#</div>
          <div>Título</div>
          <div>Canal</div>
          <div style="text-align:right">Duração</div>
          <div></div>
        </div>
        ${results.map((t, i) => this.trackRow(t, i, results)).join('')}
      </div>
    `;
    this.attachTrackListeners(results);
  },

  async renderLibrary() {
    const playlists = await Storage.getPlaylists();
    const favCount = (await Storage.getFavorites()).length;
    const histCount = (await Storage.getHistory()).length;

    this.container.innerHTML = `
      <div class="hero">
        <h1 class="hero-title">Sua Biblioteca</h1>
        <p class="hero-subtitle">Suas coleções e histórico em um só lugar</p>
      </div>

      <section class="section">
        <div class="card-grid">
          <div class="card" data-action="favorites">
            <div class="card-thumb" style="background: linear-gradient(135deg, var(--pink-primary), var(--pink-deep)); display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="white" style="width:60%; height:60%"><path d="M12 21s-7-4.5-9.5-9C1 9 2 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c4 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>
            </div>
            <div class="card-title">Curtidas</div>
            <div class="card-author">${favCount} música${favCount !== 1 ? 's' : ''}</div>
          </div>
          <div class="card" data-action="history">
            <div class="card-thumb" style="background: linear-gradient(135deg, #6e5a65, var(--bg-card)); display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:50%; height:50%"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </div>
            <div class="card-title">Histórico</div>
            <div class="card-author">${histCount} faixa${histCount !== 1 ? 's' : ''} tocada${histCount !== 1 ? 's' : ''}</div>
          </div>
          ${playlists.map(p => `
            <div class="card" data-playlist="${p.id}">
              <div class="card-thumb" style="background: linear-gradient(${135 + (p.name.length * 7) % 180}deg, var(--pink-soft), var(--pink-deep)); display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" fill="white" style="width:50%; height:50%"><path d="M9 18V5l12-2v13" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="6" cy="18" r="3" fill="white"/><circle cx="18" cy="16" r="3" fill="white"/></svg>
              </div>
              <div class="card-title">${escapeHtml(p.name)}</div>
              <div class="card-author">${p.tracks.length} música${p.tracks.length !== 1 ? 's' : ''}</div>
            </div>
          `).join('')}
        </div>
      </section>
    `;

    this.container.querySelectorAll('[data-action="favorites"]').forEach(el =>
      el.addEventListener('click', () => this.render('favorites'))
    );
    this.container.querySelectorAll('[data-action="history"]').forEach(el =>
      el.addEventListener('click', () => this.render('history'))
    );
    this.container.querySelectorAll('[data-playlist]').forEach(el =>
      el.addEventListener('click', () => this.render('playlist', el.dataset.playlist))
    );
  },

  async renderFavorites() {
    const favs = await Storage.getFavorites();
    if (favs.length === 0) {
      this.container.innerHTML = this.emptyState(
        'heart',
        'Nenhuma curtida ainda',
        'Quando você curtir uma música, ela aparecerá aqui.'
      );
      return;
    }

    this.container.innerHTML = `
      <div class="hero" style="display:flex; gap:24px; align-items:flex-end;">
        <div style="width:200px; height:200px; border-radius:8px; background:linear-gradient(135deg, var(--pink-primary), var(--pink-deep)); display:flex; align-items:center; justify-content:center; box-shadow: var(--shadow-lg);">
          <svg viewBox="0 0 24 24" fill="white" style="width:50%; height:50%"><path d="M12 21s-7-4.5-9.5-9C1 9 2 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c4 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>
        </div>
        <div>
          <p style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--text-secondary)">Playlist</p>
          <h1 class="hero-title" style="margin:8px 0">Curtidas</h1>
          <p class="hero-subtitle">${favs.length} música${favs.length !== 1 ? 's' : ''} que você ama</p>
        </div>
      </div>
      <div class="track-list" style="margin-top: 24px">
        <div class="track-list-header">
          <div>#</div>
          <div>Título</div>
          <div>Canal</div>
          <div style="text-align:right">Duração</div>
          <div></div>
        </div>
        ${favs.map((t, i) => this.trackRow(t, i, favs)).join('')}
      </div>
    `;
    this.attachTrackListeners(favs);
  },

  async renderHistory() {
    const hist = await Storage.getHistory();
    if (hist.length === 0) {
      this.container.innerHTML = this.emptyState(
        'clock',
        'Histórico vazio',
        'As músicas que você ouvir aparecerão aqui.'
      );
      return;
    }

    this.container.innerHTML = `
      <div class="hero" style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <h1 class="hero-title">Histórico</h1>
          <p class="hero-subtitle">Últimas ${hist.length} faixas tocadas</p>
        </div>
        <button class="btn-secondary" id="clear-history">Limpar histórico</button>
      </div>
      <div class="track-list" style="margin-top: 24px">
        <div class="track-list-header">
          <div>#</div>
          <div>Título</div>
          <div>Canal</div>
          <div style="text-align:right">Duração</div>
          <div></div>
        </div>
        ${hist.map((t, i) => this.trackRow(t, i, hist)).join('')}
      </div>
    `;
    document.getElementById('clear-history').addEventListener('click', async () => {
      await Storage.clearHistory();
      this.render('history');
      showToast('Histórico limpo');
    });
    this.attachTrackListeners(hist);
  },

  async renderPlaylist(playlistId) {
    const pl = await Storage.getPlaylist(playlistId);
    if (!pl) {
      this.render('library');
      return;
    }

    this.container.innerHTML = `
      <div class="hero" style="display:flex; gap:24px; align-items:flex-end;">
        <div style="width:200px; height:200px; border-radius:8px; background:linear-gradient(${135 + (pl.name.length * 7) % 180}deg, var(--pink-soft), var(--pink-deep)); display:flex; align-items:center; justify-content:center; box-shadow: var(--shadow-lg);">
          <svg viewBox="0 0 24 24" fill="white" style="width:50%; height:50%"><path d="M9 18V5l12-2v13" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="6" cy="18" r="3" fill="white"/><circle cx="18" cy="16" r="3" fill="white"/></svg>
        </div>
        <div style="flex:1">
          <p style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--text-secondary)">Playlist</p>
          <h1 class="hero-title" style="margin:8px 0">${escapeHtml(pl.name)}</h1>
          <p class="hero-subtitle">${pl.tracks.length} música${pl.tracks.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn-secondary" id="rename-pl">Renomear</button>
          <button class="btn-secondary" id="delete-pl">Excluir</button>
        </div>
      </div>
      ${pl.tracks.length === 0 ? `
        <div class="empty-state" style="padding: 60px 20px">
          <p>Esta playlist está vazia. Use a busca para adicionar músicas.</p>
        </div>
      ` : `
        <div class="track-list" style="margin-top: 24px">
          <div class="track-list-header">
            <div>#</div>
            <div>Título</div>
            <div>Canal</div>
            <div style="text-align:right">Duração</div>
            <div></div>
          </div>
          ${pl.tracks.map((t, i) => this.trackRow(t, i, pl.tracks, pl.id)).join('')}
        </div>
      `}
    `;

    document.getElementById('rename-pl').addEventListener('click', async () => {
      const name = prompt('Novo nome:', pl.name);
      if (name && name.trim()) {
        await Storage.renamePlaylist(pl.id, name.trim());
        await App.loadPlaylists();
        this.render('playlist', pl.id);
      }
    });

    document.getElementById('delete-pl').addEventListener('click', async () => {
      if (confirm(`Excluir a playlist "${pl.name}"?`)) {
        await Storage.deletePlaylist(pl.id);
        await App.loadPlaylists();
        this.render('library');
        showToast('Playlist excluída');
      }
    });

    this.attachTrackListeners(pl.tracks, pl.id);
  },

  // ===== Helpers de HTML =====
  trackRow(track, index, queue, playlistId = null) {
    const isPlaying = Player.currentTrack?.id === track.id;
    return `
      <div class="track-row ${isPlaying ? 'playing' : ''}" data-index="${index}" ${playlistId ? `data-playlist-id="${playlistId}"` : ''}>
        <div class="track-index">${index + 1}</div>
        <div class="track-info">
          ${track.thumbnail ? `<img src="${track.thumbnail}" alt="">` : '<div style="width:40px;height:40px;background:var(--bg-highlight);border-radius:4px"></div>'}
          <div class="track-info-text">
            <div class="track-name">${escapeHtml(track.title)}</div>
            <div class="track-artist">${escapeHtml(track.author)}</div>
          </div>
        </div>
        <div class="track-album">${escapeHtml(track.author)}</div>
        <div class="track-duration">${track.duration || formatTime(track.durationSec)}</div>
        <div class="track-actions">
          <button class="btn-icon" data-action="menu" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  quickCard(track, queue) {
    return `
      <div class="quick-card" data-track-id="${track.id}">
        ${track.thumbnail ? `<img src="${track.thumbnail}" alt="">` : '<div style="width:64px;height:64px;background:var(--bg-highlight)"></div>'}
        <div class="quick-card-title">${escapeHtml(track.title)}</div>
        <button class="quick-card-play">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    `;
  },

  bigCard(track, queue) {
    return `
      <div class="card" data-track-id="${track.id}">
        <div class="card-thumb">
          ${track.thumbnail ? `<img src="${track.thumbnail}" alt="">` : ''}
          <button class="card-play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="card-title">${escapeHtml(track.title)}</div>
        <div class="card-author">${escapeHtml(track.author)}</div>
      </div>
    `;
  },

  emptyState(icon, title, description) {
    const icons = {
      music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
      heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C1 9 2 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c4 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>',
      clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
    };
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icons[icon] || icons.music}</div>
        <h3>${title}</h3>
        <p>${description}</p>
      </div>
    `;
  },

  attachCardListeners() {
    this.container.querySelectorAll('[data-track-id]').forEach(el => {
      el.addEventListener('click', async (e) => {
        const trackId = el.dataset.trackId;
        const allCards = [...this.container.querySelectorAll('[data-track-id]')];
        const queue = await this.buildQueueFromCards(allCards);
        const track = queue.find(t => t.id === trackId);
        const idx = queue.findIndex(t => t.id === trackId);
        if (track) Player.playTrack(track, queue, idx);
      });
    });
  },

  async buildQueueFromCards(cards) {
    // Reconstrói a queue do histórico ou favoritos baseado nos cards visíveis
    const history = await Storage.getHistory();
    const favorites = await Storage.getFavorites();
    const all = [...history, ...favorites];
    const seen = new Set();
    const queue = [];
    cards.forEach(c => {
      const t = all.find(x => x.id === c.dataset.trackId);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        queue.push(t);
      }
    });
    return queue;
  },

  attachTrackListeners(tracks, playlistId = null) {
    this.container.querySelectorAll('.track-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="menu"]')) return;
        const idx = parseInt(row.dataset.index);
        Player.playTrack(tracks[idx], tracks, idx);
      });

      const menuBtn = row.querySelector('[data-action="menu"]');
      if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(row.dataset.index);
          App.showContextMenu(e, tracks[idx], playlistId);
        });
      }
    });
  },
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
