/* ===== Song + difficulty data from the sekai-world community dataset ===== */
const SEKAI_MUSICS_URL = 'https://sekai-world.github.io/sekai-master-db-diff/musics.json';
const SEKAI_DIFFICULTIES_URL = 'https://sekai-world.github.io/sekai-master-db-diff/musicDifficulties.json';
const SEKAI_SONG_CACHE_KEY = 'sekai_song_cache';
const SEKAI_DIFF_ORDER = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];

let sekaiSongs = [];

function joinSekaiSongs(musics, difficulties) {
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
        const [musicsRes, diffsRes] = await Promise.all([
            fetch(SEKAI_MUSICS_URL),
            fetch(SEKAI_DIFFICULTIES_URL),
        ]);
        const musics = await musicsRes.json();
        const difficulties = await diffsRes.json();
        sekaiSongs = joinSekaiSongs(musics, difficulties);
        localStorage.setItem(SEKAI_SONG_CACHE_KEY, JSON.stringify(sekaiSongs));
        onUpdate(sekaiSongs, { fromCache: false });
    } catch (e) {
        console.error('Failed to load Sekai song data:', e);
        if (!cached) onUpdate([], { fromCache: false, error: true });
    }
}
