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

function onRankingDifficultyChange(value) {
    rankingDifficultyFilter = value;
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

function renderRankingList(list, metric) {
    const sorted = list.slice().sort((a, b) => b[metric] - a[metric]).filter(p => p[metric] > 0);
    if (sorted.length === 0) return `<div class="ranking-empty">${t('ranking_empty')}</div>`;
    const medals = ['🥇', '🥈', '🥉'];
    return `<ol class="ranking-list">` + sorted.map((p, i) => `
        <li class="ranking-item">
            <span class="ranking-medal">${medals[i] || (i + 1)}</span>
            <span class="ranking-nick">${escapeHtmlSekai(p.nickname)}</span>
            <span class="ranking-count">${p[metric]}</span>
        </li>
    `).join('') + `</ol>`;
}

function renderRankingBoard() {
    const container = document.getElementById('ranking-board');
    if (!container) return;
    const aggregated = aggregateRankings(rankingEntries, rankingDifficultyFilter);
    container.innerHTML = `
        <div class="ranking-column">
            <h3>🌈 AP</h3>
            ${renderRankingList(aggregated, 'ap')}
        </div>
        <div class="ranking-column">
            <h3>🟣 FC</h3>
            ${renderRankingList(aggregated, 'fc')}
        </div>
        <div class="ranking-column">
            <h3>⭐ S</h3>
            ${renderRankingList(aggregated, 's')}
        </div>
    `;
}
