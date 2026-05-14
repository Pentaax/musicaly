// ===== PLAYER =====
const Player = {
  audio: null,
  currentTrack: null,
  queue: [],
  originalQueue: [],
  currentIndex: -1,
  isShuffling: false,
  repeatMode: 0, // 0: off, 1: all, 2: one
  volume: 0.7,
  prevVolume: 0.7,

  init() {
    this.audio = document.getElementById('audio-player');
    this.audio.volume = this.volume;

    // Eventos do audio
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.handleEnded());
    this.audio.addEventListener('loadedmetadata', () => {
      document.getElementById('time-total').textContent = formatTime(this.audio.duration);
    });
    this.audio.addEventListener('play', () => this.updatePlayIcon(true));
    this.audio.addEventListener('pause', () => this.updatePlayIcon(false));

    // Controles
    document.getElementById('btn-play').addEventListener('click', () => this.toggle());
    document.getElementById('btn-prev').addEventListener('click', () => this.prev());
    document.getElementById('btn-next').addEventListener('click', () => this.next());
    document.getElementById('btn-shuffle').addEventListener('click', () => this.toggleShuffle());
    document.getElementById('btn-repeat').addEventListener('click', () => this.toggleRepeat());
    document.getElementById('btn-like').addEventListener('click', () => this.toggleLike());
    document.getElementById('btn-mute').addEventListener('click', () => this.toggleMute());
    document.getElementById('btn-lyrics').addEventListener('click', () => this.showLyrics());

    // Progress bar - clique e arraste
    this.setupProgressBar();
    this.setupVolumeBar();

    // Atalhos teclado
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.toggle(); }
      if (e.code === 'ArrowRight' && e.ctrlKey) this.next();
      if (e.code === 'ArrowLeft' && e.ctrlKey) this.prev();
    });
  },

  setupProgressBar() {
    const bar = document.getElementById('progress-bar');
    let dragging = false;

    const seek = (e) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (this.audio.duration) this.audio.currentTime = pct * this.audio.duration;
    };

    bar.addEventListener('mousedown', (e) => { dragging = true; seek(e); });
    document.addEventListener('mousemove', (e) => { if (dragging) seek(e); });
    document.addEventListener('mouseup', () => { dragging = false; });
  },

  setupVolumeBar() {
    const bar = document.getElementById('volume-bar');
    let dragging = false;

    const setVol = (e) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.setVolume(pct);
    };

    bar.addEventListener('mousedown', (e) => { dragging = true; setVol(e); });
    document.addEventListener('mousemove', (e) => { if (dragging) setVol(e); });
    document.addEventListener('mouseup', () => { dragging = false; });
  },

  async playTrack(track, queue = null, index = null) {
    showToast('Carregando...');
    try {
      // Passamos o objeto track inteiro para ter acesso ao título e autor
      const stream = await api.getStreamUrl(track);
      if (stream.error) {
        showToast('Erro: ' + stream.error);
        return;
      }

      this.currentTrack = track;
      if (queue) {
        this.originalQueue = [...queue];
        this.queue = this.isShuffling ? this.shuffleArray([...queue]) : [...queue];
        this.currentIndex = index !== null ? index : this.queue.findIndex(t => t.id === track.id);
      }

      this.audio.src = stream.url;
      await this.audio.play();

      this.updateNowPlaying(track);
      await Storage.addToHistory(track);
      this.updateLikeButton();
    } catch (err) {
      console.error('Erro ao tocar:', err);
      showToast('Não foi possível tocar essa música');
    }
  },

  toggle() {
    if (!this.currentTrack) return;
    if (this.audio.paused) this.audio.play();
    else this.audio.pause();
  },

  async next() {
    if (this.queue.length === 0) return;
    if (this.repeatMode === 2) {
      this.audio.currentTime = 0;
      this.audio.play();
      return;
    }
    let next = this.currentIndex + 1;
    if (next >= this.queue.length) {
      if (this.repeatMode === 1) next = 0;
      else return;
    }
    this.currentIndex = next;
    await this.playTrack(this.queue[next]);
  },

  async prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.queue.length === 0) return;
    let prev = this.currentIndex - 1;
    if (prev < 0) prev = this.queue.length - 1;
    this.currentIndex = prev;
    await this.playTrack(this.queue[prev]);
  },

  handleEnded() {
    if (this.repeatMode === 2) {
      this.audio.currentTime = 0;
      this.audio.play();
    } else {
      this.next();
    }
  },

  toggleShuffle() {
    this.isShuffling = !this.isShuffling;
    const btn = document.getElementById('btn-shuffle');
    btn.classList.toggle('active', this.isShuffling);
    if (this.isShuffling) {
      this.queue = this.shuffleArray([...this.originalQueue]);
    } else {
      this.queue = [...this.originalQueue];
    }
    if (this.currentTrack) {
      this.currentIndex = this.queue.findIndex(t => t.id === this.currentTrack.id);
    }
  },

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    const btn = document.getElementById('btn-repeat');
    btn.classList.toggle('active', this.repeatMode > 0);
    btn.title = ['Repetir', 'Repetir tudo', 'Repetir uma'][this.repeatMode];
  },

  async toggleLike() {
    if (!this.currentTrack) return;
    const isLiked = await Storage.toggleFavorite(this.currentTrack);
    this.updateLikeButton(isLiked);
    showToast(isLiked ? 'Adicionado às curtidas' : 'Removido das curtidas');
    if (window.currentView === 'favorites') Views.render('favorites');
  },

  async updateLikeButton(forceState = null) {
    const btn = document.getElementById('btn-like');
    if (!this.currentTrack) {
      btn.classList.remove('active');
      return;
    }
    const isLiked = forceState !== null ? forceState : await Storage.isFavorite(this.currentTrack.id);
    btn.classList.toggle('active', isLiked);
  },

  setVolume(v) {
    this.volume = v;
    this.audio.volume = v;
    document.getElementById('volume-fill').style.width = (v * 100) + '%';
    document.getElementById('icon-volume').classList.toggle('hidden', v === 0);
    document.getElementById('icon-muted').classList.toggle('hidden', v !== 0);
  },

  toggleMute() {
    if (this.volume > 0) {
      this.prevVolume = this.volume;
      this.setVolume(0);
    } else {
      this.setVolume(this.prevVolume || 0.7);
    }
  },

  updateProgress() {
    if (!this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-handle').style.left = pct + '%';
    document.getElementById('time-current').textContent = formatTime(this.audio.currentTime);
  },

  updatePlayIcon(playing) {
    document.getElementById('icon-play').classList.toggle('hidden', playing);
    document.getElementById('icon-pause').classList.toggle('hidden', !playing);
  },

  updateNowPlaying(track) {
    const thumb = document.getElementById('np-thumb');
    thumb.src = track.thumbnail || '';
    thumb.classList.toggle('hidden', !track.thumbnail);
    document.getElementById('np-title').textContent = track.title;
    document.getElementById('np-author').textContent = track.author;
  },

  async showLyrics() {
    if (!this.currentTrack) {
      showToast('Toque uma música primeiro');
      return;
    }
    const modal = document.getElementById('modal-lyrics');
    const content = document.getElementById('lyrics-content');
    document.getElementById('lyrics-title').textContent = this.currentTrack.title;
    document.getElementById('lyrics-author').textContent = this.currentTrack.author;
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    modal.classList.remove('hidden');

    const result = await api.getLyrics({
      title: this.currentTrack.title,
      author: this.currentTrack.author,
    });

    if (result.lyrics) {
      content.textContent = result.lyrics;
    } else {
      content.innerHTML = '<div class="empty-state" style="padding:40px 0"><p>Letra não encontrada para esta música.</p></div>';
    }
  },

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
};

// ===== UTILS =====
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}
