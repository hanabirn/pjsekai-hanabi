/* ===== Song + difficulty + unit data from the sekai-world community dataset ===== */
const SEKAI_MUSICS_URL = 'https://sekai-world.github.io/sekai-master-db-diff/musics.json';
const SEKAI_DIFFICULTIES_URL = 'https://sekai-world.github.io/sekai-master-db-diff/musicDifficulties.json';
const SEKAI_VOCALS_URL = 'https://sekai-world.github.io/sekai-master-db-diff/musicVocals.json';
const SEKAI_CHARACTERS_URL = 'https://sekai-world.github.io/sekai-master-db-diff/gameCharacters.json';
const SEKAI_SONG_CACHE_KEY = 'sekai_song_cache';
const SEKAI_DIFF_ORDER = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];

const SEKAI_UNIT_NAMES = {
    light_sound: 'Leo/need',
    idol: 'MORE MORE JUMP!',
    street: 'Vivid BAD SQUAD',
    theme_park: 'ワンダーランズ×ショウタイム',
    school_refusal: '25時、ナイトコードで。',
    piapro: 'Virtual Singers',
};

let sekaiSongs = [];

function songCoverUrl(song) {
    if (!song.assetbundleName) return '';
    return `https://storage.sekai.best/sekai-jp-assets/music/jacket/${song.assetbundleName}/${song.assetbundleName}.webp`;
}

function songPreviewUrl(song) {
    if (!song.vocalAsset) return '';
    return `https://storage.sekai.best/sekai-jp-assets/music/short/${song.vocalAsset}/${song.vocalAsset}_short.mp3`;
}

function songFullAudioUrl(song) {
    if (!song.vocalAsset) return '';
    return `https://storage.sekai.best/sekai-jp-assets/music/long/${song.vocalAsset}/${song.vocalAsset}.mp3`;
}

function songHasMv(song) {
    const cats = song.categories || [];
    return cats.includes('mv') || cats.includes('mv_2d');
}

function songMvUrl(song) {
    const id = String(song.id).padStart(4, '0');
    return `https://storage.sekai.best/sekai-jp-assets/live/2dmode/sekai_mv/${id}/${id}.mp4`;
}

const VOCAL_TYPE_PRIORITY = ['sekai', 'original_song'];

function buildMusicVocalMap(vocals) {
    const byMusic = {};
    vocals.forEach(v => {
        if (!byMusic[v.musicId]) byMusic[v.musicId] = [];
        byMusic[v.musicId].push(v);
    });
    const vocalAssets = {};
    Object.keys(byMusic).forEach(musicId => {
        const candidates = byMusic[musicId];
        let chosen = null;
        for (const type of VOCAL_TYPE_PRIORITY) {
            chosen = candidates.find(v => v.musicVocalType === type);
            if (chosen) break;
        }
        if (!chosen) chosen = candidates[0];
        vocalAssets[musicId] = chosen.assetbundleName || '';
    });
    return vocalAssets;
}

function buildMusicUnitMap(vocals, characters) {
    const charUnit = {};
    characters.forEach(c => { charUnit[c.id] = c.unit; });

    const musicUnits = {};
    vocals.forEach(v => {
        if (!musicUnits[v.musicId]) musicUnits[v.musicId] = new Set();
        (v.characters || []).forEach(ch => {
            const unit = charUnit[ch.characterId];
            if (unit) musicUnits[v.musicId].add(unit);
        });
    });
    return musicUnits;
}

function joinSekaiSongs(musics, difficulties, musicUnits, musicVocals) {
    const diffsByMusic = {};
    difficulties.forEach(d => {
        if (!diffsByMusic[d.musicId]) diffsByMusic[d.musicId] = {};
        diffsByMusic[d.musicId][d.musicDifficulty] = {
            playLevel: d.playLevel,
            totalNoteCount: d.totalNoteCount,
        };
    });

    return musics
        .filter(m => diffsByMusic[m.id])
        .map(m => ({
            id: m.id,
            title: m.title,
            pronunciation: m.pronunciation || '',
            difficulties: diffsByMusic[m.id],
            units: musicUnits[m.id] ? [...musicUnits[m.id]] : [],
            releasedAt: m.releasedAt || 0,
            assetbundleName: m.assetbundleName || '',
            categories: m.categories || [],
            vocalAsset: musicVocals[m.id] || '',
        }))
        .sort((a, b) => a.title.localeCompare(b.title, 'ja'));
}

async function loadSekaiSongs(onUpdate) {
    const cached = localStorage.getItem(SEKAI_SONG_CACHE_KEY);
    if (cached) {
        try {
            sekaiSongs = JSON.parse(cached);
            onUpdate(sekaiSongs, { fromCache: true });
        } catch (e) {
            sekaiSongs = [];
        }
    }

    try {
        const [musicsRes, diffsRes, vocalsRes, charsRes] = await Promise.all([
            fetch(SEKAI_MUSICS_URL),
            fetch(SEKAI_DIFFICULTIES_URL),
            fetch(SEKAI_VOCALS_URL),
            fetch(SEKAI_CHARACTERS_URL),
        ]);
        const musics = await musicsRes.json();
        const difficulties = await diffsRes.json();
        const vocals = await vocalsRes.json();
        const characters = await charsRes.json();
        const musicUnits = buildMusicUnitMap(vocals, characters);
        const musicVocals = buildMusicVocalMap(vocals);
        sekaiSongs = joinSekaiSongs(musics, difficulties, musicUnits, musicVocals);
        localStorage.setItem(SEKAI_SONG_CACHE_KEY, JSON.stringify(sekaiSongs));
        onUpdate(sekaiSongs, { fromCache: false });
    } catch (e) {
        console.error('Failed to load Sekai song data:', e);
        if (!cached) onUpdate([], { fromCache: false, error: true });
    }
}
