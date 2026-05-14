// ===== APP CONTROLLER =====
const App = {
  searchTimer: null,

  async init() {
    Player.init();
    Views.init();

    // Window controls
    document.getElementById('btn-minimize').addEventListener('click', () => api.minimize());
    document.getElementById('btn-maximize').addEventListener('click', () => api.maximize());
    document.getElementById('btn-close').addEventListener('click', () => api.close());

    // Sidebar nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => Views.render(item.dataset.view));
    });

    // Busca com debounce
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimer);
      const query = e.target.value.trim();
      if (!query) {
        Views.render('search', '');
        return;
      }
      Views.render('home'); // mostra que está digitando
      this.searchTimer = setTimeout(() => {
        Views.render('search', query);
      }, 500);
    });

    searchInput.addEventListener('focus', () => {
      if (window.currentView !== 'search') Views.render('search', searchInput.value);
    });

    // Modal de nova playlist
    document.getElementById('btn-new-playlist').addEventListener('click', () => this.showNewPlaylistModal());
    document.getElementById('cancel-playlist').addEventListener('click', () => this.hideNewPlaylistModal());
    document.getElementById('create-playlist').addEventListener('click', () => this.createPlaylist());
    document.getElementById('new-playlist-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.createPlaylist();
      if (e.key === 'Escape') this.hideNewPlaylistModal();
    });

    // Modal de letras
    document.getElementById('close-lyrics').addEventListener('click', () => {
      document.getElementById('modal-lyrics').classList.add('hidden');
    });

    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.add('hidden');
      });
    });

    // Fechar menu de contexto
    document.addEventListener('click', () => {
      document.getElementById('context-menu').classList.add('hidden');
    });

    // Carregar playlists na sidebar
    await this.loadPlaylists();

    // Render inicial
    await Views.render('home');
  },

  async loadPlaylists() {
    const list = document.getElementById('playlists-list');
    const playlists = await Storage.getPlaylists();
    list.innerHTML = playlists.map(p => `
      <div class="playlist-item" data-playlist-id="${p.id}">
        <div class="playlist-icon">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</div>
      </div>
    `).join('');

    list.querySelectorAll('[data-playlist-id]').forEach(el => {
      el.addEventListener('click', () => Views.render('playlist', el.dataset.playlistId));
    });
  },

  showNewPlaylistModal() {
    const modal = document.getElementById('modal-playlist');
    modal.classList.remove('hidden');
    const input = document.getElementById('new-playlist-name');
    input.value = '';
    setTimeout(() => input.focus(), 50);
  },

  hideNewPlaylistModal() {
    document.getElementById('modal-playlist').classList.add('hidden');
  },

  async createPlaylist() {
    const input = document.getElementById('new-playlist-name');
    const name = input.value.trim();
    if (!name) return;
    const pl = await Storage.createPlaylist(name);
    this.hideNewPlaylistModal();
    await this.loadPlaylists();
    showToast(`Playlist "${name}" criada`);
    Views.render('playlist', pl.id);
  },

  async showContextMenu(event, track, currentPlaylistId = null) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById('context-menu');
    const isFav = await Storage.isFavorite(track.id);
    const playlists = await Storage.getPlaylists();

    let items = [
      {
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        label: 'Tocar agora',
        action: () => Player.playTrack(track, [track], 0),
      },
      {
        icon: isFav
          ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C1 9 2 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c4 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9.5-9C1 9 2 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c4 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"/></svg>',
        label: isFav ? 'Remover das curtidas' : 'Adicionar às curtidas',
        action: async () => {
          await Storage.toggleFavorite(track);
          if (Player.currentTrack?.id === track.id) Player.updateLikeButton();
          showToast(isFav ? 'Removido das curtidas' : 'Adicionado às curtidas');
          if (window.currentView === 'favorites') Views.render('favorites');
        },
      },
    ];

    if (currentPlaylistId) {
      items.push({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/></svg>',
        label: 'Remover desta playlist',
        action: async () => {
          await Storage.removeFromPlaylist(currentPlaylistId, track.id);
          Views.render('playlist', currentPlaylistId);
          showToast('Removida da playlist');
        },
      });
    }

    if (playlists.length > 0) {
      items.push({ divider: true });
      playlists.forEach(p => {
        if (p.id === currentPlaylistId) return;
        items.push({
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
          label: `Adicionar a "${p.name}"`,
          action: async () => {
            const added = await Storage.addToPlaylist(p.id, track);
            showToast(added ? `Adicionada a "${p.name}"` : `Já está em "${p.name}"`);
          },
        });
      });
    }

    menu.innerHTML = items.map((item, i) => {
      if (item.divider) return '<div class="context-divider"></div>';
      return `<div class="context-item" data-idx="${i}">${item.icon}<span>${escapeHtml(item.label)}</span></div>`;
    }).join('');

    // Posicionar
    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    let x = event.clientX;
    let y = event.clientY;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Listeners
    menu.querySelectorAll('.context-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.idx);
        items[idx].action();
        menu.classList.add('hidden');
      });
    });
  },
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => App.init());
