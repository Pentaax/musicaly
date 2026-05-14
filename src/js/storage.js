// ===== STORAGE LAYER =====
const Storage = {
  async getFavorites() {
    return (await api.storeGet('favorites')) || [];
  },

  async toggleFavorite(track) {
    const favs = await this.getFavorites();
    const idx = favs.findIndex(t => t.id === track.id);
    if (idx >= 0) {
      favs.splice(idx, 1);
      await api.storeSet('favorites', favs);
      return false;
    } else {
      favs.unshift({ ...track, addedAt: Date.now() });
      await api.storeSet('favorites', favs);
      return true;
    }
  },

  async isFavorite(trackId) {
    const favs = await this.getFavorites();
    return favs.some(t => t.id === trackId);
  },

  async getHistory() {
    return (await api.storeGet('history')) || [];
  },

  async addToHistory(track) {
    let history = await this.getHistory();
    history = history.filter(t => t.id !== track.id);
    history.unshift({ ...track, playedAt: Date.now() });
    history = history.slice(0, 100);
    await api.storeSet('history', history);
  },

  async clearHistory() {
    await api.storeSet('history', []);
  },

  async getPlaylists() {
    return (await api.storeGet('playlists')) || [];
  },

  async createPlaylist(name) {
    const playlists = await this.getPlaylists();
    const playlist = {
      id: 'pl_' + Date.now(),
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    playlists.push(playlist);
    await api.storeSet('playlists', playlists);
    return playlist;
  },

  async deletePlaylist(id) {
    let playlists = await this.getPlaylists();
    playlists = playlists.filter(p => p.id !== id);
    await api.storeSet('playlists', playlists);
  },

  async renamePlaylist(id, newName) {
    const playlists = await this.getPlaylists();
    const pl = playlists.find(p => p.id === id);
    if (pl) {
      pl.name = newName;
      await api.storeSet('playlists', playlists);
    }
  },

  async addToPlaylist(playlistId, track) {
    const playlists = await this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && !pl.tracks.some(t => t.id === track.id)) {
      pl.tracks.push({ ...track, addedAt: Date.now() });
      await api.storeSet('playlists', playlists);
      return true;
    }
    return false;
  },

  async removeFromPlaylist(playlistId, trackId) {
    const playlists = await this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl) {
      pl.tracks = pl.tracks.filter(t => t.id !== trackId);
      await api.storeSet('playlists', playlists);
    }
  },

  async getPlaylist(id) {
    const playlists = await this.getPlaylists();
    return playlists.find(p => p.id === id);
  },
};
