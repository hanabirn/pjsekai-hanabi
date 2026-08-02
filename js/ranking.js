/* ===== World Ranking: OCR-assisted submission + public leaderboard =====
   Every submission goes to a "pending" queue on the backend regardless of the
   OCR result — OCR only helps the reviewer triage faster, it never publishes
   on its own, since the check runs client-side and could be bypassed by
   someone calling the API directly. */
const SEKAI_RANKING_API = 'https://script.google.com/macros/s/AKfycbzGJHz5HC9fey3UvKNdXjQ6ID_S63Vz_I5YSzdxA_VWMDJQcSwnCT2DDyLHXMr-xiA/exec';
const RANKING_NICKNAME_KEY = 'sekai_ranking_nickname';
const RANKING_CACHE_KEY = 'sekai_ranking_cache';

function resizeImageBlob(blob, maxWidth) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
        };
        img.onerror = reject;
        img.src = url;
    });
}

function blobToBase64Ranking(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function ocrCheckScreenshot(imageBlob, claimedScore, claimedFc, claimedAp) {
    const { data: { text } } = await Tesseract.recognize(imageBlob, 'eng');
    const upper = text.toUpperCase();
    const hasAP = upper.includes('ALL PERFECT');
    const hasFC = upper.includes('FULL COMBO');
    const numbers = (text.match(/\d[\d,]{4,}/g) || []).map(s => parseInt(s.replace(/,/g, ''), 10));
    const scoreMatches = !claimedScore || numbers.some(n => Math.abs(n - Number(claimedScore)) < 50);
    const notes = [];
    if (claimedAp && !hasAP) notes.push('claimed AP but "ALL PERFECT" not detected');
    if (claimedFc && !claimedAp && !hasFC) notes.push('claimed FC but "FULL COMBO" not detected');
    if (!scoreMatches) notes.push('claimed score not found in screenshot text');
    return { ok: notes.length === 0, notes };
}

async function submitToRanking(musicId, difficulty, songTitle, entry) {
    if (!entry.rank || !entry.score || !entry.hasImage) return;
    if (!SEKAI_RANKING_API) { showToast(t('ranking_not_ready')); return; }

    let nickname = localStorage.getItem(RANKING_NICKNAME_KEY) || '';
    nickname = prompt(t('ranking_nickname_prompt'), nickname);
    if (nickname === null) return;
    nickname = nickname.trim();
    if (!nickname) return;
    localStorage.setItem(RANKING_NICKNAME_KEY, nickname);

    const originalBlob = await getScoreImage(musicId, difficulty);
    if (!originalBlob) { showToast(t('ranking_no_image')); return; }

    showToast(t('ranking_checking'));
    try {
        const resized = await resizeImageBlob(originalBlob, 960);
        const ocrResult = await ocrCheckScreenshot(resized, entry.score, entry.fc, entry.ap);
        const imageBase64 = await blobToBase64Ranking(resized);

        await fetch(SEKAI_RANKING_API, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                nickname, musicId, songTitle, difficulty,
                score: entry.score, rank: entry.rank, fc: !!entry.fc, ap: !!entry.ap,
                ocrOk: ocrResult.ok, ocrNotes: ocrResult.notes.join('; '),
                imageBase64,
            }),
        });
        showToast(t('ranking_submitted'));
    } catch (e) {
        console.error('Ranking submit failed:', e);
        showToast(t('ranking_submit_fail'));
    }
}

/* ===== Public leaderboard ===== */
let rankingEntries = [];

async function loadRankingBoard() {
    const container = document.getElementById('ranking-board');
    if (!container) return;
    if (!SEKAI_RANKING_API) {
        container.innerHTML = `<div class="ranking-empty">${t('ranking_not_ready')}</div>`;
        return;
    }

    const cached = localStorage.getItem(RANKING_CACHE_KEY);
    if (cached) {
        try {
            rankingEntries = JSON.parse(cached);
            renderRankingBoard();
        } catch (e) {
            rankingEntries = [];
        }
    } else {
        container.innerHTML = `<div class="ranking-loading">${t('ranking_loading')}</div>`;
    }

    try {
        const res = await fetch(SEKAI_RANKING_API);
        rankingEntries = await res.json();
        localStorage.setItem(RANKING_CACHE_KEY, JSON.stringify(rankingEntries));
    } catch (e) {
        console.error('Ranking board load failed:', e);
        if (!cached) {
            container.innerHTML = `<div class="ranking-empty">${t('ranking_load_fail')}</div>`;
            return;
        }
    }
    renderRankingBoard();
}

let rankingDifficultyFilter = 'all';
let rankingNicknameSearch = '';

function onRankingDifficultyChange(value) {
    rankingDifficultyFilter = value;
    renderRankingBoard();
}

function onRankingSearchInput(value) {
    rankingNicknameSearch = value.trim();
    renderRankingBoard();
}

function aggregateRankings(entries, difficulty) {
    const filtered = (!difficulty || difficulty === 'all') ? entries : entries.filter(e => e.difficulty === difficulty);
    const byNick = {};
    filtered.forEach(e => {
        if (!byNick[e.nickname]) byNick[e.nickname] = { nickname: e.nickname, ap: 0, fc: 0, s: 0 };
        if (e.ap) byNick[e.nickname].ap++;
        else if (e.fc) byNick[e.nickname].fc++;
        if (e.rank === 'S') byNick[e.nickname].s++;
    });
    return Object.values(byNick);
}

/* encodeURIComponent leaves ' ( ) unescaped (they're in its "safe" set), so a
   nickname containing one breaks out of the single-quoted onclick attribute
   below — escape those too before embedding. */
function encodeForOnclick(str) {
    return encodeURIComponent(str).replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16));
}

function renderRankingList(list, metric, query) {
    const sorted = list.slice().sort((a, b) => b[metric] - a[metric]).filter(p => p[metric] > 0);
    const numbered = sorted.map((p, i) => ({ ...p, place: i + 1 }));
    const visible = query ? numbered.filter(p => p.nickname.toLowerCase().includes(query.toLowerCase())) : numbered;
    if (visible.length === 0) return `<div class="ranking-empty">${t(query ? 'ranking_no_match' : 'ranking_empty')}</div>`;
    const medals = ['🥇', '🥈', '🥉'];
    return `<ol class="ranking-list">` + visible.map(p => {
        const followed = isRankingFriend(p.nickname);
        return `
        <li class="ranking-item">
            <span class="ranking-medal">${medals[p.place - 1] || p.place}</span>
            <button class="ranking-follow-btn ${followed ? 'active' : ''}" onclick="toggleRankingFriend(decodeURIComponent('${encodeForOnclick(p.nickname)}'))" title="${escapeHtmlSekai(t('ranking_friend_toggle_title'))}">${followed ? '★' : '☆'}</button>
            <span class="ranking-nick">${escapeHtmlSekai(p.nickname)}</span>
            <span class="ranking-count">${p[metric]}</span>
        </li>
    `;
    }).join('') + `</ol>`;
}

function renderRankingBoard() {
    const container = document.getElementById('ranking-board');
    if (!container) return;
    const aggregated = aggregateRankings(rankingEntries, rankingDifficultyFilter);
    const query = rankingNicknameSearch;
    container.innerHTML = `
        <div class="ranking-column">
            <h3>🌈 AP</h3>
            ${renderRankingList(aggregated, 'ap', query)}
        </div>
        <div class="ranking-column">
            <h3>🟣 FC</h3>
            ${renderRankingList(aggregated, 'fc', query)}
        </div>
        <div class="ranking-column">
            <h3>⭐ S</h3>
            ${renderRankingList(aggregated, 's', query)}
        </div>
    `;
    renderFriendsCompare(aggregated);
}

/* ===== Friend tracking: follow specific nicknames from the leaderboard and
   compare their AP/FC/S totals side by side, independent of medal placement ===== */
const RANKING_FRIENDS_KEY = 'sekai_ranking_friends';

function getRankingFriends() {
    try {
        return JSON.parse(localStorage.getItem(RANKING_FRIENDS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveRankingFriends(list) {
    localStorage.setItem(RANKING_FRIENDS_KEY, JSON.stringify(list));
}

function isRankingFriend(nickname) {
    return getRankingFriends().some(n => n.toLowerCase() === nickname.toLowerCase());
}

function toggleRankingFriend(nickname) {
    const friends = getRankingFriends();
    const idx = friends.findIndex(n => n.toLowerCase() === nickname.toLowerCase());
    if (idx >= 0) friends.splice(idx, 1);
    else friends.push(nickname);
    saveRankingFriends(friends);
    renderRankingBoard();
}

function addRankingFriendFromInput() {
    const input = document.getElementById('ranking-friend-add-input');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    if (!isRankingFriend(name)) {
        const friends = getRankingFriends();
        friends.push(name);
        saveRankingFriends(friends);
    }
    input.value = '';
    renderRankingBoard();
}

function renderFriendsCompare(aggregated) {
    const el = document.getElementById('ranking-friends-panel');
    if (!el) return;
    const friends = getRankingFriends();
    const byNick = {};
    aggregated.forEach(p => { byNick[p.nickname.toLowerCase()] = p; });

    const rows = friends.map(name => {
        const p = byNick[name.toLowerCase()];
        const encodedName = encodeForOnclick(name);
        return `<tr>
            <td class="friends-compare-name">${escapeHtmlSekai(name)}</td>
            <td>${p ? p.ap : 0}</td>
            <td>${p ? p.fc : 0}</td>
            <td>${p ? p.s : 0}</td>
            <td><button class="friends-remove-btn" onclick="toggleRankingFriend(decodeURIComponent('${encodedName}'))" aria-label="remove">&times;</button></td>
        </tr>`;
    }).join('');

    el.innerHTML = `
        <h3 class="favorites-title">${t('ranking_friends_title')}</h3>
        <div class="ranking-friend-add-row">
            <input type="text" id="ranking-friend-add-input" data-i18n-placeholder="ranking_friend_add_placeholder" placeholder="${escapeHtmlSekai(t('ranking_friend_add_placeholder'))}" onkeydown="if(event.key==='Enter')addRankingFriendFromInput()">
            <button class="btn-small" onclick="addRankingFriendFromInput()">${t('ranking_friend_add_btn')}</button>
        </div>
        ${friends.length === 0
            ? `<div class="ranking-empty">${t('ranking_friends_empty')}</div>`
            : `<table class="friends-compare-table">
                <thead><tr><th>${t('ranking_friend_col_name')}</th><th>🌈 AP</th><th>🟣 FC</th><th>⭐ S</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
              </table>`}
    `;
}

/* ===== Official border tracker =====
   Shows the real T1/T100/T1000/T2000 event score over time on the JP server,
   via the event-border function (which proxies api.sekai.best). This is
   separate from the friend leaderboard above — that's self-reported scores,
   this is the actual live event standings. JP only: TW/EN/KR run the same
   events on a delay under different event ids we'd have to map separately,
   and JP is what every community border tracker defaults to anyway. */
const BORDER_RANKS = [1, 100, 1000, 2000];
let borderCurrentEvent = null;
let borderCurrentRank = 1;
let borderPointsCache = {};

function formatBorderEventWindow(event) {
    const fmt = ms => {
        const d = new Date(ms);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    return `${fmt(event.startAt)} - ${fmt(event.aggregateAt)}`;
}

function formatBorderTimeLabel(isoString) {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* Downsamples to keep the SVG light even when an event's been running for
   days (a 3-minute snapshot interval over 10 days is ~4800 points). */
function downsampleBorderPoints(points, maxPoints) {
    if (points.length <= maxPoints) return points;
    const step = points.length / maxPoints;
    const out = [];
    for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
    out.push(points[points.length - 1]);
    return out;
}

function borderTrendChartSvg(points) {
    const width = 600, height = 150;
    const padL = 46, padR = 14, padT = 14, padB = 22;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const xs = points.map(p => new Date(p.t).getTime());
    const xMin = xs[0];
    const xSpan = Math.max(1, xs[xs.length - 1] - xMin);
    const yMax = Math.max(1, ...points.map(p => p.s));

    const xPos = t => padL + (xs.length === 1 ? innerW / 2 : ((t - xMin) / xSpan) * innerW);
    const yPos = v => padT + innerH - (v / yMax) * innerH;

    const baseline = `<line x1="${padL}" y1="${padT + innerH}" x2="${padL + innerW}" y2="${padT + innerH}" class="trend-chart-grid" />`;
    const yLabels = `<text x="${padL - 6}" y="${padT + innerH + 3}" text-anchor="end" class="trend-chart-axis-label">0</text>
        <text x="${padL - 6}" y="${padT + 8}" text-anchor="end" class="trend-chart-axis-label">${yMax.toLocaleString()}</text>`;
    const xLabels = `<text x="${padL}" y="${height - 4}" text-anchor="start" class="trend-chart-axis-label">${formatBorderTimeLabel(points[0].t)}</text>
        <text x="${padL + innerW}" y="${height - 4}" text-anchor="end" class="trend-chart-axis-label">${formatBorderTimeLabel(points[points.length - 1].t)}</text>`;

    const pts = points.map(p => `${xPos(new Date(p.t).getTime())},${yPos(p.s)}`);
    const line = points.length > 1
        ? `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`
        : '';
    const last = points[points.length - 1];
    const lastX = xPos(new Date(last.t).getTime());
    const lastY = yPos(last.s);
    const valueLabel = `<circle cx="${lastX}" cy="${lastY}" r="4" fill="var(--accent)"><title>${formatBorderTimeLabel(last.t)}: ${last.s.toLocaleString()}</title></circle>
        <text x="${lastX + 6}" y="${lastY - 6}" class="trend-chart-value-label" fill="var(--accent)">${last.s.toLocaleString()}</text>`;

    return `<svg viewBox="0 0 ${width} ${height}" class="trend-chart-svg" preserveAspectRatio="none">
        ${baseline}${yLabels}${xLabels}${line}${valueLabel}
    </svg>`;
}

function renderBorderRankTabs() {
    const el = document.getElementById('border-rank-tabs');
    if (!el) return;
    el.innerHTML = BORDER_RANKS.map(rank =>
        `<button class="border-rank-tab ${rank === borderCurrentRank ? 'active' : ''}" onclick="switchBorderRank(${rank}, this)">Top ${rank.toLocaleString()}</button>`
    ).join('');
}

async function renderBorderChart() {
    const wrap = document.getElementById('border-chart-wrap');
    const status = document.getElementById('border-status');
    if (!wrap || !status || !borderCurrentEvent) return;

    wrap.style.display = 'none';
    status.style.display = 'block';
    status.textContent = t('border_loading');

    try {
        let points = borderPointsCache[borderCurrentRank];
        if (!points) {
            const params = new URLSearchParams({ eventId: borderCurrentEvent.id, rank: borderCurrentRank, region: 'jp' });
            const res = await fetch(`/.netlify/functions/event-border?${params.toString()}`);
            const data = await res.json();
            points = data.points || [];
            borderPointsCache[borderCurrentRank] = points;
        }

        if (points.length === 0) {
            wrap.style.display = 'none';
            status.style.display = 'block';
            status.textContent = t('border_empty');
            return;
        }

        wrap.innerHTML = borderTrendChartSvg(downsampleBorderPoints(points, 200));
        wrap.style.display = 'block';
        status.style.display = 'none';
    } catch (e) {
        console.error('Border chart fetch failed:', e);
        wrap.style.display = 'none';
        status.style.display = 'block';
        status.textContent = t('border_error');
    }
}

function switchBorderRank(rank, el) {
    borderCurrentRank = rank;
    document.querySelectorAll('.border-rank-tab').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    renderBorderChart();
}

let borderTrackerLoaded = false;

async function loadBorderTracker() {
    const infoEl = document.getElementById('border-event-info');
    if (!infoEl) return;
    if (borderTrackerLoaded) return;

    infoEl.textContent = t('border_loading');
    borderCurrentEvent = await getCurrentJpEvent();

    if (!borderCurrentEvent) {
        infoEl.textContent = t('border_no_event');
        return;
    }

    infoEl.innerHTML = `<strong>${escapeHtmlSekai(borderCurrentEvent.name)}</strong><br>${formatBorderEventWindow(borderCurrentEvent)}`;
    renderBorderRankTabs();
    borderTrackerLoaded = true;
    renderBorderChart();
}
