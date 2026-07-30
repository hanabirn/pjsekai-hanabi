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
    recordProgressSnapshot();
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
    renderProgressHistoryChart();
}

/* ===== Overall growth trend: two small line charts (recorded count, and S/AP/FC
   counts) built from the daily snapshots in recordProgressSnapshot(). Two charts
   rather than one because "recorded" runs into the thousands while S/AP/FC are
   much smaller — one shared axis would flatten the smaller series to a line near 0. */
const PROGRESS_CHART_COLORS = { recorded: 'var(--accent)', s: '#fde047', ap: '#f9a8d4', fc: '#7dd3fc' };

function formatChartDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function trendChartSvg(history, seriesDefs) {
    const width = 600, height = 150;
    const padL = 30, padR = 14, padT = 14, padB = 20;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const xs = history.map(p => new Date(p.date + 'T00:00:00').getTime());
    const xMin = xs[0];
    const xSpan = Math.max(1, xs[xs.length - 1] - xMin);

    let yMax = 1;
    seriesDefs.forEach(s => history.forEach(p => { yMax = Math.max(yMax, p[s.key]); }));
    const magnitude = Math.pow(10, Math.floor(Math.log10(yMax)));
    yMax = Math.ceil(yMax / magnitude) * magnitude;

    const xPos = t => padL + (xs.length === 1 ? innerW / 2 : ((t - xMin) / xSpan) * innerW);
    const yPos = v => padT + innerH - (v / yMax) * innerH;

    const baseline = `<line x1="${padL}" y1="${padT + innerH}" x2="${padL + innerW}" y2="${padT + innerH}" class="trend-chart-grid" />`;
    const yLabels = `<text x="${padL - 6}" y="${padT + innerH + 3}" text-anchor="end" class="trend-chart-axis-label">0</text>
        <text x="${padL - 6}" y="${padT + 8}" text-anchor="end" class="trend-chart-axis-label">${yMax}</text>`;
    const xLabels = `<text x="${padL}" y="${height - 4}" text-anchor="start" class="trend-chart-axis-label">${formatChartDate(history[0].date)}</text>
        <text x="${padL + innerW}" y="${height - 4}" text-anchor="end" class="trend-chart-axis-label">${formatChartDate(history[history.length - 1].date)}</text>`;

    const seriesSvg = seriesDefs.map(s => {
        const pts = history.map(p => `${xPos(new Date(p.date + 'T00:00:00').getTime())},${yPos(p[s.key])}`);
        const line = history.length > 1
            ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`
            : '';
        const dots = history.map(p => {
            const cx = xPos(new Date(p.date + 'T00:00:00').getTime());
            const cy = yPos(p[s.key]);
            return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${s.color}"><title>${formatChartDate(p.date)} ${s.label}: ${p[s.key]}</title></circle>`;
        }).join('');
        const last = history[history.length - 1];
        const lastX = xPos(new Date(last.date + 'T00:00:00').getTime());
        const lastY = yPos(last[s.key]);
        const valueLabel = `<circle cx="${lastX}" cy="${lastY}" r="4" fill="${s.color}"><title>${formatChartDate(last.date)} ${s.label}: ${last[s.key]}</title></circle>
            <text x="${lastX + 6}" y="${lastY - 6}" class="trend-chart-value-label" fill="${s.color}">${last[s.key]}</text>`;
        return line + dots + valueLabel;
    }).join('');

    return `<svg viewBox="0 0 ${width} ${height}" class="trend-chart-svg" preserveAspectRatio="none">
        ${baseline}${yLabels}${xLabels}${seriesSvg}
    </svg>`;
}

function renderProgressHistoryChart() {
    const el = document.getElementById('progress-history-panel');
    if (!el) return;
    const history = getProgressHistory();

    if (history.length < 2) {
        el.innerHTML = `
            <h3 class="achievements-title">${t('progress_history_title')}</h3>
            <p class="songs-empty">${t('progress_history_empty')}</p>
        `;
        return;
    }

    const recordedSvg = trendChartSvg(history, [{ key: 'recorded', label: t('stats_recorded'), color: PROGRESS_CHART_COLORS.recorded }]);
    const rankSvg = trendChartSvg(history, [
        { key: 's', label: 'S', color: PROGRESS_CHART_COLORS.s },
        { key: 'ap', label: 'AP', color: PROGRESS_CHART_COLORS.ap },
        { key: 'fc', label: 'FC', color: PROGRESS_CHART_COLORS.fc },
    ]);

    el.innerHTML = `
        <h3 class="achievements-title">${t('progress_history_title')}</h3>
        <div class="trend-chart-block">
            <div class="trend-chart-label">${t('progress_history_recorded_label')}</div>
            <div class="trend-chart-wrap">${recordedSvg}</div>
        </div>
        <div class="trend-chart-block">
            <div class="trend-chart-label">${t('progress_history_rank_label')}</div>
            <div class="trend-chart-legend">
                <span class="trend-legend-item"><span class="trend-legend-dot" style="background:${PROGRESS_CHART_COLORS.s}"></span>S</span>
                <span class="trend-legend-item"><span class="trend-legend-dot" style="background:${PROGRESS_CHART_COLORS.ap}"></span>AP</span>
                <span class="trend-legend-item"><span class="trend-legend-dot" style="background:${PROGRESS_CHART_COLORS.fc}"></span>FC</span>
            </div>
            <div class="trend-chart-wrap">${rankSvg}</div>
        </div>
    `;
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
