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
    return true;
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
    const data = { scores: getSekaiScores(), images, gallery, exportedAt: new Date().toISOString() };
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
