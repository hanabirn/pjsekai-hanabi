/* ===== Password gate (mirrors the main site's osu! collection pattern) ===== */
async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function getSekaiPassword() { return localStorage.getItem('sekai_password_hash'); }
async function setSekaiPasswordHash(pw) { localStorage.setItem('sekai_password_hash', await sha256(pw)); }
function hasSekaiPassword() { return !!getSekaiPassword(); }

let sekaiPasswordVerifiedThisSession = false;
async function verifySekaiPassword() {
    if (!hasSekaiPassword() || sekaiPasswordVerifiedThisSession) return true;
    const pw = prompt(t('password_prompt'));
    if (pw === null) return false;
    const hash = await sha256(pw);
    if (hash !== getSekaiPassword()) { alert(t('password_wrong')); return false; }
    sekaiPasswordVerifiedThisSession = true;
    return true;
}

async function setupSekaiPassword() {
    if (!(await verifySekaiPassword())) return;
    const pw = prompt(t('password_set_prompt'));
    if (pw === null) return;
    if (pw === '') { localStorage.removeItem('sekai_password_hash'); return; }
    const confirmPw = prompt(t('password_confirm_prompt'));
    if (confirmPw !== pw) { alert(t('password_mismatch')); return; }
    await setSekaiPasswordHash(pw);
    alert(t('password_set_success'));
}

/* ===== Toast ===== */
function showToast(msg) {
    let toast = document.getElementById('sekai-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sekai-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'sekai-toast show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.className = 'sekai-toast'; }, 2500);
}

/* ===== Score storage (localStorage, sparse: only recorded difficulties are stored) ===== */
const SEKAI_SCORES_KEY = 'sekai_scores';

function getSekaiScores() {
    try {
        return JSON.parse(localStorage.getItem(SEKAI_SCORES_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveSekaiScores(scores) {
    localStorage.setItem(SEKAI_SCORES_KEY, JSON.stringify(scores));
}

function getSongScore(musicId, difficulty) {
    const scores = getSekaiScores();
    return (scores[musicId] && scores[musicId][difficulty]) || null;
}

/* ===== Favorite songs (localStorage, array of musicId) ===== */
const SEKAI_FAVORITES_KEY = 'sekai_favorites';

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(SEKAI_FAVORITES_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function isFavorite(musicId) {
    return getFavorites().includes(musicId);
}

function toggleFavorite(musicId) {
    const favs = getFavorites();
    const idx = favs.indexOf(musicId);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(musicId);
    localStorage.setItem(SEKAI_FAVORITES_KEY, JSON.stringify(favs));
    return idx < 0;
}

async function setSongScore(musicId, difficulty, entry, imageFile) {
    if (!(await verifySekaiPassword())) return false;
    const scores = getSekaiScores();
    if (!scores[musicId]) scores[musicId] = {};

    if (imageFile === null) {
        // explicit "remove image" request
        await deleteScoreImage(musicId, difficulty);
        entry.hasImage = false;
    } else if (imageFile) {
        await saveScoreImage(musicId, difficulty, imageFile);
        entry.hasImage = true;
    } else {
        // no change requested — keep whatever was already recorded
        const existing = scores[musicId][difficulty];
        entry.hasImage = existing ? !!existing.hasImage : false;
    }

    scores[musicId][difficulty] = entry;
    saveSekaiScores(scores);
    appendScoreHistory(musicId, difficulty, entry);
    return true;
}

/* ===== Per-song score history (append-only timeline behind each save, capped so it
   can't grow unbounded) — powers the score modal's history list ===== */
const SEKAI_SCORE_HISTORY_KEY = 'sekai_score_history';
const SEKAI_SCORE_HISTORY_MAX = 30; // entries kept per song+difficulty

function getScoreHistory() {
    try {
        return JSON.parse(localStorage.getItem(SEKAI_SCORE_HISTORY_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveScoreHistory(history) {
    localStorage.setItem(SEKAI_SCORE_HISTORY_KEY, JSON.stringify(history));
}

function appendScoreHistory(musicId, difficulty, entry) {
    if (!entry.rank && !entry.score) return;
    const history = getScoreHistory();
    const key = `${musicId}_${difficulty}`;
    const list = history[key] || (history[key] = []);
    list.push({ ts: Date.now(), rank: entry.rank, score: entry.score, fc: !!entry.fc, ap: !!entry.ap });
    if (list.length > SEKAI_SCORE_HISTORY_MAX) history[key] = list.slice(-SEKAI_SCORE_HISTORY_MAX);
    saveScoreHistory(history);
}

function getSongScoreHistory(musicId, difficulty) {
    return getScoreHistory()[`${musicId}_${difficulty}`] || [];
}

function renderScoreHistoryList(musicId, difficulty) {
    const el = document.getElementById('score-modal-history-list');
    if (!el) return;
    const history = getSongScoreHistory(musicId, difficulty);
    if (history.length === 0) {
        el.innerHTML = `<p class="score-history-empty">${t('score_modal_history_empty')}</p>`;
        return;
    }
    el.innerHTML = history.slice().reverse().map(h => {
        const d = new Date(h.ts);
        const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
        const rankBadge = h.rank ? `<span class="score-rank rank-${h.rank.toLowerCase()}">${h.rank}</span>` : '';
        const flag = h.ap ? '<span class="score-flag ap">AP</span>' : (h.fc ? '<span class="score-flag fc">FC</span>' : '');
        const scoreStr = h.score ? Number(h.score).toLocaleString() : '';
        return `<div class="score-history-row">
            <span class="score-history-date">${dateStr}</span>
            ${rankBadge}
            <span class="score-history-num">${scoreStr}</span>
            ${flag}
        </div>`;
    }).join('');
}

/* ===== Daily snapshots of aggregate stats (one point/day, overwritten through the day)
   for the achievements tab's growth chart — this necessarily only starts accumulating
   from whenever this feature first shipped, there's no way to backfill past progress. */
const SEKAI_PROGRESS_HISTORY_KEY = 'sekai_progress_history';
const SEKAI_PROGRESS_HISTORY_MAX_DAYS = 90;

function getProgressHistory() {
    try {
        return JSON.parse(localStorage.getItem(SEKAI_PROGRESS_HISTORY_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveProgressHistory(history) {
    localStorage.setItem(SEKAI_PROGRESS_HISTORY_KEY, JSON.stringify(history));
}

function recordProgressSnapshot() {
    if (typeof computeSongStats !== 'function') return;
    const st = computeSongStats();
    const today = new Date().toISOString().slice(0, 10);
    const point = { date: today, recorded: st.recorded, s: st.s, ap: st.ap, fc: st.fc };
    const history = getProgressHistory();
    const last = history[history.length - 1];
    if (last && last.date === today && last.recorded === point.recorded && last.s === point.s && last.ap === point.ap && last.fc === point.fc) {
        return; // stats haven't changed since the last write today — skip it
    }
    if (last && last.date === today) history[history.length - 1] = point;
    else history.push(point);
    saveProgressHistory(history.length > SEKAI_PROGRESS_HISTORY_MAX_DAYS ? history.slice(-SEKAI_PROGRESS_HISTORY_MAX_DAYS) : history);
}

async function deleteSongScore(musicId, difficulty) {
    if (!(await verifySekaiPassword())) return false;
    const scores = getSekaiScores();
    if (scores[musicId]) {
        delete scores[musicId][difficulty];
        if (Object.keys(scores[musicId]).length === 0) delete scores[musicId];
    }
    saveSekaiScores(scores);
    await deleteScoreImage(musicId, difficulty);
    return true;
}

/* ===== Export / Import (bundles IndexedDB screenshots + gallery into the same JSON file) ===== */
async function exportSekaiScores() {
    const images = await getAllScoreImagesAsBase64();
    const gallery = await getAllGalleryImagesAsBase64();
    const data = {
        scores: getSekaiScores(),
        scoreHistory: getScoreHistory(),
        progressHistory: getProgressHistory(),
        images, gallery,
        exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sekai-scores-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('export_done'));
}

async function importSekaiScores(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!(await verifySekaiPassword())) { event.target.value = ''; return; }
    try {
        const data = JSON.parse(await file.text());
        if (typeof data.scores !== 'object' || data.scores === null) throw new Error('invalid format');
        saveSekaiScores(data.scores);
        if (data.scoreHistory && typeof data.scoreHistory === 'object') saveScoreHistory(data.scoreHistory);
        if (Array.isArray(data.progressHistory)) saveProgressHistory(data.progressHistory);
        if (data.images && typeof data.images === 'object') {
            await restoreScoreImagesFromBase64(data.images);
        }
        if (data.gallery && typeof data.gallery === 'object') {
            await restoreGalleryImagesFromBase64(data.gallery);
        }
        if (typeof renderSongTable === 'function') renderSongTable();
        if (typeof renderGallery === 'function') renderGallery();
        showToast(t('import_done'));
    } catch (e) {
        alert(t('import_fail'));
    } finally {
        event.target.value = '';
    }
}
