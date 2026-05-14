const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const CryptoJS = require('crypto-js');

const store = new Store();

// Configurações do JioSaavn
const SAAVN_KEY = '38346b346c336d346c336d346c336d34'; // Chave DES fixa

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1a0d14',
    icon: path.join(__dirname, 'src/assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('src/index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ===== Controles da janela =====
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// ===== JioSaavn: BUSCA =====
ipcMain.handle('search-songs', async (event, query) => {
  try {
    const response = await fetch(
      `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=web6dot0`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' } }
    );
    const data = await response.json();
    
    const items = [];
    const songs = data.songs?.data || [];

    for (const item of songs) {
      try {
        const id = item.id;
        const title = item.title.replace(/&quot;/g, '"');
        const author = item.more_info?.singers || item.description || 'Desconhecido';
        
        // Normaliza thumbnail para 500x500
        const thumbnail = item.image.replace('50x50', '500x500');

        items.push({
          id,
          title: String(title),
          author: String(author),
          duration: '0:00', // Autocomplete não retorna duração
          durationSec: 0,
          thumbnail,
          pid: id
        });
      } catch (e) {
        // pula items malformados
      }
    }

    return items;
  } catch (err) {
    console.error('Erro na busca JioSaavn:', err);
    return { error: 'Erro ao buscar músicas' };
  }
});

// ===== JioSaavn: STREAM URL =====
ipcMain.handle('get-stream-url', async (event, track) => {
  try {
    // 1. Pega detalhes da música para obter o encrypted_media_url
    const detailsRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${track.id}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const detailsData = await detailsRes.json();
    const song = detailsData[track.id];

    if (!song || !song.encrypted_media_url) {
      throw new Error('URL criptografada não encontrada');
    }

    // 2. Descriptografa a URL usando DES-ECB
    const key = CryptoJS.enc.Utf8.parse('38346b34'); // Usa os primeiros 8 bytes como chave
    const decrypted = CryptoJS.DES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(song.encrypted_media_url) },
      key,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    
    let streamUrl = decrypted.toString(CryptoJS.enc.Utf8);
    
    // 3. Normaliza para 320kbps e formato correto
    streamUrl = streamUrl.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
    if (!streamUrl.startsWith('http')) {
      streamUrl = streamUrl.replace(/^/, 'https:');
    }

    return {
      url: streamUrl,
      title: track.title,
      author: track.author,
      duration: parseInt(song.duration) || 0,
      thumbnail: track.thumbnail
    };
  } catch (err) {
    console.error('Erro ao obter stream JioSaavn:', err);
    return { error: 'Não foi possível carregar o áudio desta música.' };
  }
});

// ===== Letras =====
ipcMain.handle('get-lyrics', async (event, { title, author }) => {
  try {
    const cleanTitle = title
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/official|video|audio|lyrics|hd|4k|mv/gi, '')
      .replace(/feat\.?|ft\.?/gi, '')
      .trim();
    const cleanAuthor = author.replace(/- Topic|VEVO|Official/gi, '').trim();
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanAuthor)}/${encodeURIComponent(cleanTitle)}`
    );
    const data = await res.json();
    return data.lyrics ? { lyrics: data.lyrics } : { error: 'Letra não encontrada' };
  } catch (err) {
    return { error: 'Não foi possível buscar a letra' };
  }
});

// ===== Storage =====
ipcMain.handle('store-get', (event, key) => store.get(key));
ipcMain.handle('store-set', (event, key, value) => store.set(key, value));
ipcMain.handle('store-delete', (event, key) => store.delete(key));

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
