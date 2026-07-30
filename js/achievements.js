/* ===== Achievements (derived live from recorded scores, no separate persistence) ===== */
const SEKAI_ACHIEVEMENTS = [
    { id: 'first_record', icon: '🎉', current: st => st.recorded, target: () => 1 },
    { id: 'ten_record', icon: '📝', current: st => st.recorded, target: () => 10 },
    { id: 'fifty_record', icon: '📚', current: st => st.recorded, target: () => 50 },
    { id: 'hundred_record', icon: '💯', current: st => st.recorded, target: () => 100 },
    { id: 'first_ap', icon: '🌈', current: st => st.ap, target: () => 1 },
    { id: 'ten_ap', icon: '🌈✨', current: st => st.ap, target: () => 10 },
    { id: 'first_fc', icon: '🟣', current: st => st.ap + st.fc, target: () => 1 },
    { id: 'all_units', icon: '🏆', current: (st, extra) => extra.unitsTouched, target: () => Object.keys(SEKAI_UNIT_NAMES).length },
    { id: 'full_completion', icon: '🌟', current: st => st.recorded, target: st => st.totalDifficulties },
];

function computeUnitsTouched() {
    const scores = getSekaiScores();
    const touched = new Set();
    Object.keys(scores).forEach(musicId => {
        if (Object.keys(scores[musicId]).length === 0) return;
        const song = sekaiSongs.find(s => s.id === Number(musicId));
        if (song) song.units.forEach(u => touched.add(u));
    });
    return touched.size;
}

function computeAchievements() {
    const st = computeSongStats();
    const extra = { unitsTouched: computeUnitsTouched() };
    return SEKAI_ACHIEVEMENTS.map(a => {
        const current = a.current(st, extra);
        const target = a.target(st, extra);
        return Object.assign({}, a, { current, target, unlocked: target > 0 && current >= target });
    });
}

// Tracks which achievements were already unlocked, so newly-crossed ones can toast.
// Stays null until the first render establishes the baseline (avoids toasting
// everything the visitor already had unlocked on page load).
let sekaiUnlockedAchievementIds = null;

function renderAchievements() {
    const el = document.getElementById('achievements-panel');
    if (!el) return;
    const list = computeAchievements();

    if (sekaiUnlockedAchievementIds === null) {
        sekaiUnlockedAchievementIds = new Set(list.filter(a => a.unlocked).map(a => a.id));
    } else {
        list.forEach(a => {
            if (a.unlocked && !sekaiUnlockedAchievementIds.has(a.id)) {
                sekaiUnlockedAchievementIds.add(a.id);
                showToast(t('ach_unlocked_toast', { name: t('ach_' + a.id + '_name') }));
            }
        });
    }

    el.innerHTML = `
        <h3 class="achievements-title">${t('achievements_title')}</h3>
        <div class="achievements-grid">
            ${list.map(a => `
                <div class="achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}" title="${escapeHtmlSekai(t('ach_' + a.id + '_desc'))}">
                    <div class="achievement-icon">${a.unlocked ? a.icon : '🔒'}</div>
                    <div class="achievement-name">${escapeHtmlSekai(t('ach_' + a.id + '_name'))}</div>
                    <div class="achievement-progress">${Math.min(a.current, a.target)}/${a.target}</div>
                </div>
            `).join('')}
        </div>
    `;

    renderNewSongsPanel();
}

/* ===== Recently released songs (moved here from the inline song-table NEW badge) ===== */
function renderNewSongsPanel() {
    const el = document.getElementById('new-songs-panel');
    if (!el) return;
    const newSongs = sekaiSongs.filter(isNewSong).sort((a, b) => b.releasedAt - a.releasedAt);

    if (newSongs.length === 0) {
        el.innerHTML = `
            <h3 class="achievements-title">${t('new_songs_title')}</h3>
            <p class="songs-empty">${t('new_songs_empty')}</p>
        `;
        return;
    }

    el.innerHTML = `
        <h3 class="achievements-title">${t('new_songs_title')}</h3>
        <div class="new-songs-grid">
            ${newSongs.map(song => `
                <div class="new-song-card" onclick="jumpToNewSong(${song.id})">
                    <span class="song-new-badge new-song-card-badge">${t('song_new_badge')}</span>
                    <img src="${songCoverUrl(song)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">
                    <div class="new-song-card-title">${escapeHtmlSekai(song.title)}</div>
                </div>
            `).join('')}
        </div>
    `;
}
