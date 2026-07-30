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

function joinSekaiSongs(musics, difficulties, musicUnits) {
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
        sekaiSongs = joinSekaiSongs(musics, difficulties, musicUnits);
        localStorage.setItem(SEKAI_SONG_CACHE_KEY, JSON.stringify(sekaiSongs));
        onUpdate(sekaiSongs, { fromCache: false });
    } catch (e) {
        console.error('Failed to load Sekai song data:', e);
        if (!cached) onUpdate([], { fromCache: false, error: true });
    }
}
