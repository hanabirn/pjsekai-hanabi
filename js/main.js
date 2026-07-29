/* ===== Song table rendering, search, pagination ===== */
const SONG_PAGE_SIZE = 30;
let songSearchQuery = '';
let songPage = 0;
let songModalTarget = null; // { musicId, difficulty }

const RANKS = ['S', 'A', 'B', 'C'];

function filterSongs(query) {
    songSearchQuery = query;
    songPage = 0;
    renderSongTable();
}

function getFilteredSongs() {
    if (!songSearchQuery) return sekaiSongs;
    const q = songSearchQuery.toLowerCase();
    return sekaiSongs.filter(s =>
        s.title.toLowerCase().includes(q) || s.pronunciation.toLowerCase().includes(q)
    );
}

function scoreBadge(entry, musicId, difficulty) {
    if (!entry) return '';
    const parts = [];
    if (entry.rank) parts.push(`<span class="score-rank rank-${entry.rank.toLowerCase()}">${entry.rank}</span>`);
    if (entry.ap) parts.push('<span class="score-flag ap">AP</span>');
    else if (entry.fc) parts.push('<span class="score-flag fc">FC</span>');
    if (entry.hasImage) {
        parts.push(`<span class="score-flag img" onclick="event.stopPropagation(); openImageLightbox(${musicId}, '${difficulty}')">🖼️</span>`);
    }
    if (entry.score) parts.push(`<span class="score-num">${Number(entry.score).toLocaleString()}</span>`);
    return `<div class="score-badge">${parts.join('')}</div>`;
}

function renderSongTable() {
    const body = document.getElementById('song-table-body');
    const empty = document.getElementById('song-table-empty');
    if (!body) return;

    const filtered = getFilteredSongs();
    if (filtered.length === 0) {
        body.innerHTML = '';
        if (empty) empty.style.display = 'block';
        renderSongPagination(0);
        return;
    }
    if (empty) empty.style.display = 'none';

    const totalPages = Math.ceil(filtered.length / SONG_PAGE_SIZE);
    if (songPage >= totalPages) songPage = Math.max(0, totalPages - 1);
    const pageSongs = filtered.slice(songPage * SONG_PAGE_SIZE, (songPage + 1) * SONG_PAGE_SIZE);

    body.innerHTML = pageSongs.map(song => {
        const cells = SEKAI_DIFF_ORDER.map(diff => {
            const diffData = song.difficulties[diff];
            if (!diffData) return `<td class="song-diff-cell empty">${t('songs_no_append')}</td>`;
            const entry = getSongScore(song.id, diff);
            return `<td class="song-diff-cell diff-${diff}" onclick="openScoreModal(${song.id}, '${diff}')">
                <div class="diff-level">${diffData.playLevel}</div>
                ${scoreBadge(entry, song.id, diff)}
            </td>`;
        }).join('');
        return `<tr>
            <td class="song-title-cell">${escapeHtmlSekai(song.title)}</td>
            ${cells}
        </tr>`;
    }).join('');

    renderSongPagination(totalPages);
}

function renderSongPagination(totalPages) {
    const el = document.getElementById('song-pagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < totalPages; i++) {
        html += `<button class="song-page-btn ${i === songPage ? 'active' : ''}" onclick="goToSongPage(${i})">${i + 1}</button>`;
    }
    el.innerHTML = html;
}

function goToSongPage(page) {
    songPage = page;
    renderSongTable();
}

function escapeHtmlSekai(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ===== Score entry modal ===== */
let modalImageAction; // undefined = no change, null = remove existing image, File = new upload
let modalImageObjectUrl = null;

async function openScoreModal(musicId, difficulty) {
    const song = sekaiSongs.find(s => s.id === musicId);
    if (!song) return;
    songModalTarget = { musicId, difficulty };
    modalImageAction = undefined;
    const entry = getSongScore(musicId, difficulty) || {};

    document.getElementById('score-modal-song-name').textContent = `${song.title} — ${difficulty.toUpperCase()}`;
    document.getElementById('score-modal-score-input').value = entry.score || '';
    document.getElementById('score-modal-fc-input').checked = !!entry.fc;
    document.getElementById('score-modal-ap-input').checked = !!entry.ap;
    document.getElementById('score-modal-image-input').value = '';
    document.querySelectorAll('.score-rank-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rank === entry.rank);
    });
    document.getElementById('score-modal-delete-btn').style.display = entry.rank || entry.score ? 'inline-block' : 'none';

    setModalImagePreview(null);
    if (entry.hasImage) {
        const blob = await getScoreImage(musicId, difficulty);
        if (blob) setModalImagePreview(blob);
    }

    document.getElementById('score-modal').style.display = 'flex';
}

function setModalImagePreview(blob) {
    const img = document.getElementById('score-modal-image-preview');
    const removeBtn = document.getElementById('score-modal-image-remove-btn');
    if (modalImageObjectUrl) { URL.revokeObjectURL(modalImageObjectUrl); modalImageObjectUrl = null; }
    if (blob) {
        modalImageObjectUrl = URL.createObjectURL(blob);
        img.src = modalImageObjectUrl;
        img.style.display = 'block';
        removeBtn.style.display = 'inline-block';
    } else {
        img.style.display = 'none';
        removeBtn.style.display = 'none';
    }
}

function onScoreImageInputChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    modalImageAction = file;
    setModalImagePreview(file);
}

function removeModalImage() {
    modalImageAction = null;
    document.getElementById('score-modal-image-input').value = '';
    setModalImagePreview(null);
}

function closeScoreModal() {
    document.getElementById('score-modal').style.display = 'none';
    setModalImagePreview(null);
    songModalTarget = null;
}

function selectRank(btn) {
    document.querySelectorAll('.score-rank-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function saveScoreModal() {
    if (!songModalTarget) return;
    const rankBtn = document.querySelector('.score-rank-btn.active');
    const entry = {
        rank: rankBtn ? rankBtn.dataset.rank : null,
        score: document.getElementById('score-modal-score-input').value || null,
        fc: document.getElementById('score-modal-fc-input').checked,
        ap: document.getElementById('score-modal-ap-input').checked,
    };
    const ok = await setSongScore(songModalTarget.musicId, songModalTarget.difficulty, entry, modalImageAction);
    if (ok) {
        closeScoreModal();
        renderSongTable();
    }
}

async function deleteScoreModal() {
    if (!songModalTarget) return;
    const ok = await deleteSongScore(songModalTarget.musicId, songModalTarget.difficulty);
    if (ok) {
        closeScoreModal();
        renderSongTable();
    }
}

/* ===== Image lightbox (enlarged view of a recorded score screenshot) ===== */
let lightboxObjectUrl = null;

async function openImageLightbox(musicId, difficulty) {
    const blob = await getScoreImage(musicId, difficulty);
    if (!blob) return;
    if (lightboxObjectUrl) URL.revokeObjectURL(lightboxObjectUrl);
    lightboxObjectUrl = URL.createObjectURL(blob);
    document.getElementById('image-lightbox-img').src = lightboxObjectUrl;
    document.getElementById('image-lightbox').style.display = 'flex';
}

function closeImageLightbox() {
    document.getElementById('image-lightbox').style.display = 'none';
    if (lightboxObjectUrl) { URL.revokeObjectURL(lightboxObjectUrl); lightboxObjectUrl = null; }
}

/* ===== Tab switching ===== */
function switchSekaiTab(tab, el) {
    document.querySelectorAll('.sekai-page').forEach(p => p.style.display = 'none');
    document.getElementById('sekai-page-' + tab).style.display = 'block';
    document.querySelectorAll('.sekai-nav-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    if (tab === 'updates' && typeof loadSekaiUpdates === 'function') loadSekaiUpdates();
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
    applyLang(siteLang);
    document.getElementById('song-table-status').textContent = t('songs_loading');
    loadSekaiSongs((songs, meta) => {
        if (meta.error) {
            document.getElementById('song-table-status').textContent = t('songs_load_fail');
            return;
        }
        document.getElementById('song-table-status').textContent = '';
        renderSongTable();
    });
});
