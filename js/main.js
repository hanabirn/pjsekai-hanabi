/* ===== Song table rendering, search, sort, filter, pagination ===== */
const SONG_PAGE_SIZE = 30;
let songSearchQuery = '';
let songSortMode = 'title';
let songFilterMode = 'all';
let songUnitFilter = 'all';
let songPage = 0;
let songModalTarget = null; // { musicId, difficulty }

const RANKS = ['S', 'A', 'B', 'C'];

function filterSongs(query) {
    songSearchQuery = query;
    songPage = 0;
    renderSongTable();
    const input = document.getElementById('song-search-input');
    const clearBtn = document.getElementById('song-search-clear');
    const backBtn = document.getElementById('song-search-back-btn');
    if (input) input.value = query;
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
    if (backBtn) backBtn.style.display = query ? 'inline-flex' : 'none';
}

function clearSongSearch() {
    filterSongs('');
}

function onSongSortChange(value) {
    songSortMode = value;
    songPage = 0;
    renderSongTable();
}

function onSongFilterChange(value) {
    songFilterMode = value;
    songPage = 0;
    renderSongTable();
}

function onSongUnitChange(value) {
    songUnitFilter = value;
    songPage = 0;
    renderSongTable();
}

function songMaxLevel(song) {
    return Math.max(...Object.values(song.difficulties).map(d => d.playLevel));
}

function songHasAnyScore(song) {
    const scores = getSekaiScores();
    return !!scores[song.id] && Object.keys(scores[song.id]).length > 0;
}

function getFilteredSongs() {
    let list = sekaiSongs;

    if (songSearchQuery) {
        const q = songSearchQuery.toLowerCase();
        list = list.filter(s => s.title.toLowerCase().includes(q) || s.pronunciation.toLowerCase().includes(q));
    }

    if (songFilterMode === 'recorded') list = list.filter(songHasAnyScore);
    else if (songFilterMode === 'unrecorded') list = list.filter(s => !songHasAnyScore(s));

    if (songUnitFilter !== 'all') list = list.filter(s => s.units.includes(songUnitFilter));

    if (songSortMode === 'level-desc' || songSortMode === 'level-asc') {
        list = list.slice().sort((a, b) =>
            songSortMode === 'level-desc' ? songMaxLevel(b) - songMaxLevel(a) : songMaxLevel(a) - songMaxLevel(b)
        );
    }

    return list;
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

function computeSongStats() {
    const scores = getSekaiScores();
    let totalDifficulties = 0;
    sekaiSongs.forEach(s => { totalDifficulties += Object.keys(s.difficulties).length; });

    let recorded = 0, s = 0, ap = 0, fc = 0;
    Object.values(scores).forEach(diffs => {
        Object.values(diffs).forEach(entry => {
            recorded++;
            if (entry.rank === 'S') s++;
            if (entry.ap) ap++;
            else if (entry.fc) fc++;
        });
    });
    return { recorded, totalDifficulties, s, ap, fc };
}

function renderSongStats() {
    const el = document.getElementById('song-stats-bar');
    if (!el) return;
    const st = computeSongStats();
    el.innerHTML = `
        <div class="stat-tile"><div class="stat-num">${st.recorded}/${st.totalDifficulties}</div><div class="stat-label">${t('stats_recorded')}</div></div>
        <div class="stat-tile"><div class="stat-num">${st.s}</div><div class="stat-label">S</div></div>
        <div class="stat-tile"><div class="stat-num">${st.ap}</div><div class="stat-label">AP</div></div>
        <div class="stat-tile"><div class="stat-num">${st.fc}</div><div class="stat-label">FC</div></div>
    `;
}

const NEW_SONG_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function isNewSong(song) {
    return song.releasedAt > 0 && (Date.now() - song.releasedAt) < NEW_SONG_WINDOW_MS;
}

function renderSongTable() {
    const body = document.getElementById('song-table-body');
    const empty = document.getElementById('song-table-empty');
    if (!body) return;

    renderSongStats();
    renderFavoritesSection();
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
        const newBadge = isNewSong(song) ? `<span class="song-new-badge">${t('song_new_badge')}</span>` : '';
        const favActive = isFavorite(song.id);
        const heart = `<span class="song-fav-heart ${favActive ? 'active' : ''}" onclick="toggleFavoriteUI(${song.id}, event)">${favActive ? '♥' : '♡'}</span>`;
        const previewBtn = songPreviewUrl(song)
            ? `<button class="song-preview-btn" onclick="event.stopPropagation(); toggleSongPreview(${song.id}, this)" title="${t('song_preview_title')}">🔊</button>`
            : '';
        const mvBtn = songHasMv(song)
            ? `<button class="song-mv-btn" onclick="event.stopPropagation(); openSongMv(${song.id})" title="${t('song_mv_title')}">🎬</button>`
            : '';
        return `<tr>
            <td class="song-title-cell">${heart}${previewBtn}${mvBtn}${escapeHtmlSekai(song.title)}${newBadge}</td>
            ${cells}
        </tr>`;
    }).join('');

    renderSongPagination(totalPages);
}

/* ===== Song preview clip + MV playback =====
   storage.sekai.best rejects any request that carries a Referer header,
   and <audio>/<video> don't support the referrerpolicy attribute (unlike
   <img>), so the assets are fetched as no-referrer blobs and played from
   an object URL instead of pointing src straight at the CDN. */
const SEKAI_MUSIC_VOLUME_KEY = 'sekai_music_volume';

function getSavedMusicVolume() {
    const saved = localStorage.getItem(SEKAI_MUSIC_VOLUME_KEY);
    return saved !== null ? Number(saved) : 1;
}

function saveMusicVolume(vol) {
    localStorage.setItem(SEKAI_MUSIC_VOLUME_KEY, vol);
}

let songPreviewAudio = null;
let songPreviewObjectUrl = null;
let songPreviewBtnEl = null;

function stopSongPreview() {
    if (songPreviewAudio) {
        songPreviewAudio.pause();
        songPreviewAudio = null;
    }
    if (songPreviewObjectUrl) {
        URL.revokeObjectURL(songPreviewObjectUrl);
        songPreviewObjectUrl = null;
    }
    if (songPreviewBtnEl) {
        songPreviewBtnEl.textContent = '🔊';
        songPreviewBtnEl.classList.remove('playing', 'loading');
        songPreviewBtnEl = null;
    }
    const bar = document.getElementById('song-preview-bar');
    if (bar) bar.style.display = 'none';
}

function setSongPreviewVolume(value) {
    const vol = Number(value);
    saveMusicVolume(vol);
    if (songPreviewAudio) songPreviewAudio.volume = vol;
}

async function toggleSongPreview(musicId, btnEl) {
    const wasThisButton = songPreviewBtnEl === btnEl;
    stopSongPreview();
    if (wasThisButton) return;

    const song = sekaiSongs.find(s => s.id === musicId);
    const url = song && songPreviewUrl(song);
    if (!url) return;

    songPreviewBtnEl = btnEl;
    btnEl.textContent = '⏳';
    btnEl.classList.add('loading');

    try {
        const res = await fetch(url, { referrerPolicy: 'no-referrer' });
        if (!res.ok) throw new Error('bad response');
        const blob = await res.blob();
        if (songPreviewBtnEl !== btnEl) return; // superseded by another click while loading

        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.volume = getSavedMusicVolume();
        audio.onended = () => stopSongPreview();
        songPreviewAudio = audio;
        songPreviewObjectUrl = objectUrl;
        btnEl.textContent = '⏸';
        btnEl.classList.remove('loading');
        btnEl.classList.add('playing');

        const bar = document.getElementById('song-preview-bar');
        const title = document.getElementById('song-preview-bar-title');
        const slider = document.getElementById('song-preview-volume-slider');
        if (title) title.textContent = song.title;
        if (slider) slider.value = audio.volume;
        if (bar) bar.style.display = 'flex';

        await audio.play();
    } catch (e) {
        if (songPreviewBtnEl === btnEl) stopSongPreview();
    }
}

/* The 2D MV file itself has no audio track — sekai.best's own player plays
   it silently and syncs the full-length song audio alongside it as a
   separate track, so we do the same and expose our own volume control
   since the (muted, silent) video's native controls won't have one. */
let songMvObjectUrl = null;
let songMvAudio = null;
let songMvAudioObjectUrl = null;

async function openSongMv(musicId) {
    const song = sekaiSongs.find(s => s.id === musicId);
    if (!song) return;
    stopSongPreview();
    stopMvAudio();

    const video = document.getElementById('mv-lightbox-video');
    const loading = document.getElementById('mv-lightbox-loading');
    video.style.display = 'none';
    video.muted = true;
    if (loading) loading.style.display = 'block';
    document.getElementById('mv-lightbox').style.display = 'flex';

    try {
        const audioUrl = songFullAudioUrl(song);
        const [videoRes, audioRes] = await Promise.all([
            fetch(songMvUrl(song), { referrerPolicy: 'no-referrer' }),
            audioUrl ? fetch(audioUrl, { referrerPolicy: 'no-referrer' }) : Promise.resolve(null),
        ]);
        if (!videoRes.ok) throw new Error('bad response');
        const videoBlob = await videoRes.blob();
        if (songMvObjectUrl) URL.revokeObjectURL(songMvObjectUrl);
        songMvObjectUrl = URL.createObjectURL(videoBlob);
        video.src = songMvObjectUrl;

        if (audioRes && audioRes.ok) {
            const audioBlob = await audioRes.blob();
            songMvAudioObjectUrl = URL.createObjectURL(audioBlob);
            songMvAudio = new Audio(songMvAudioObjectUrl);
            const vol = getSavedMusicVolume();
            songMvAudio.volume = vol;
            const slider = document.getElementById('mv-volume-slider');
            if (slider) slider.value = vol;
            document.getElementById('mv-volume-btn').textContent = vol === 0 ? '🔇' : '🔊';
        }

        if (loading) loading.style.display = 'none';
        video.style.display = 'block';
        video.play().catch(() => {});
        if (songMvAudio) songMvAudio.play().catch(() => {});
    } catch (e) {
        closeMvLightbox();
        showToast(t('song_mv_load_fail'));
    }
}

function stopMvAudio() {
    if (songMvAudio) {
        songMvAudio.pause();
        songMvAudio = null;
    }
    if (songMvAudioObjectUrl) {
        URL.revokeObjectURL(songMvAudioObjectUrl);
        songMvAudioObjectUrl = null;
    }
}

function toggleMvMute() {
    if (!songMvAudio) return;
    songMvAudio.muted = !songMvAudio.muted;
    document.getElementById('mv-volume-btn').textContent = songMvAudio.muted ? '🔇' : '🔊';
}

function setMvVolume(value) {
    const vol = Number(value);
    saveMusicVolume(vol);
    document.getElementById('mv-volume-btn').textContent = vol === 0 ? '🔇' : '🔊';
    if (!songMvAudio) return;
    songMvAudio.volume = vol;
    songMvAudio.muted = false;
}

function closeMvLightbox() {
    const video = document.getElementById('mv-lightbox-video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (songMvObjectUrl) {
        URL.revokeObjectURL(songMvObjectUrl);
        songMvObjectUrl = null;
    }
    stopMvAudio();
    document.getElementById('mv-lightbox').style.display = 'none';
}

/* ===== Favorite songs (cover-art card grid, 7x2 per page) ===== */
const FAVORITES_PAGE_SIZE = 14; // 7 columns x 2 rows
let favoritesPage = 0;

function toggleFavoriteUI(musicId, event) {
    if (event) event.stopPropagation();
    toggleFavorite(musicId);
    renderSongTable();
}

function renderFavoritesSection() {
    const container = document.getElementById('favorites-grid');
    const empty = document.getElementById('favorites-empty');
    const pagination = document.getElementById('favorites-pagination');
    if (!container) return;
    const favSongs = getFavorites().map(id => sekaiSongs.find(s => s.id === id)).filter(Boolean);
    if (favSongs.length === 0) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    const totalPages = Math.ceil(favSongs.length / FAVORITES_PAGE_SIZE);
    if (favoritesPage >= totalPages) favoritesPage = Math.max(0, totalPages - 1);
    const pageSongs = favSongs.slice(favoritesPage * FAVORITES_PAGE_SIZE, (favoritesPage + 1) * FAVORITES_PAGE_SIZE);

    container.innerHTML = pageSongs.map(song => {
        const cover = songCoverUrl(song);
        return `<div class="favorite-card" onclick="jumpToFavoriteSong(${song.id})">
            <img src="${cover}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">
            <div class="favorite-card-title">${escapeHtmlSekai(song.title)}</div>
        </div>`;
    }).join('');

    if (pagination) {
        if (totalPages <= 1) {
            pagination.innerHTML = '';
        } else {
            let html = '';
            for (let i = 0; i < totalPages; i++) {
                html += `<button class="song-page-btn ${i === favoritesPage ? 'active' : ''}" onclick="goToFavoritesPage(${i})">${i + 1}</button>`;
            }
            pagination.innerHTML = html;
        }
    }
}

function goToFavoritesPage(page) {
    favoritesPage = page;
    renderFavoritesSection();
}

function jumpToFavoriteSong(musicId) {
    const song = sekaiSongs.find(s => s.id === musicId);
    if (!song) return;
    filterSongs(song.title);
    document.getElementById('song-search-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const rankingBtn = document.getElementById('score-modal-ranking-btn');
    if (rankingBtn) rankingBtn.style.display = (entry.rank && entry.score && entry.hasImage) ? 'inline-block' : 'none';

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

async function onSubmitToRankingClick() {
    if (!songModalTarget) return;
    const song = sekaiSongs.find(s => s.id === songModalTarget.musicId);
    const entry = getSongScore(songModalTarget.musicId, songModalTarget.difficulty);
    if (!song || !entry) return;
    await submitToRanking(songModalTarget.musicId, songModalTarget.difficulty, song.title, entry);
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

/* ===== Character gallery (uploaded fan art in IndexedDB) ===== */
let galleryObjectUrls = [];
const GALLERY_PAGE_SIZE = 24; // 6 columns x 4 rows
let galleryPage = 0;

async function onGalleryUploadChange(event) {
    const files = [...event.target.files];
    if (files.length === 0) return;
    if (!(await verifySekaiPassword())) { event.target.value = ''; return; }
    for (const file of files) {
        await addGalleryImage(file);
    }
    event.target.value = '';
    renderGallery();
    showToast(t('gallery_upload_done'));
}

async function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    const pagination = document.getElementById('gallery-pagination');
    if (!grid) return;

    galleryObjectUrls.forEach(url => URL.revokeObjectURL(url));
    galleryObjectUrls = [];

    const images = await getAllGalleryImages();
    if (images.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    const totalPages = Math.ceil(images.length / GALLERY_PAGE_SIZE);
    if (galleryPage >= totalPages) galleryPage = Math.max(0, totalPages - 1);
    const pageImages = images.slice(galleryPage * GALLERY_PAGE_SIZE, (galleryPage + 1) * GALLERY_PAGE_SIZE);

    grid.innerHTML = pageImages.map(img => {
        const url = URL.createObjectURL(img.blob);
        galleryObjectUrls.push(url);
        return `<div class="gallery-item">
            <img src="${url}" onclick="openGalleryLightbox('${img.id}')" alt="">
            <button class="gallery-delete-btn" onclick="event.stopPropagation(); deleteGalleryImageUI('${img.id}')">&times;</button>
        </div>`;
    }).join('');

    if (pagination) {
        if (totalPages <= 1) {
            pagination.innerHTML = '';
        } else {
            let html = '';
            for (let i = 0; i < totalPages; i++) {
                html += `<button class="song-page-btn ${i === galleryPage ? 'active' : ''}" onclick="goToGalleryPage(${i})">${i + 1}</button>`;
            }
            pagination.innerHTML = html;
        }
    }
}

function goToGalleryPage(page) {
    galleryPage = page;
    renderGallery();
}

async function openGalleryLightbox(id) {
    const images = await getAllGalleryImages();
    const found = images.find(i => i.id === id);
    if (!found) return;
    if (lightboxObjectUrl) URL.revokeObjectURL(lightboxObjectUrl);
    lightboxObjectUrl = URL.createObjectURL(found.blob);
    document.getElementById('image-lightbox-img').src = lightboxObjectUrl;
    document.getElementById('image-lightbox').style.display = 'flex';
}

async function deleteGalleryImageUI(id) {
    if (!(await verifySekaiPassword())) return;
    await deleteGalleryImage(id);
    renderGallery();
}

/* ===== Tab switching ===== */
function switchSekaiTab(tab, el) {
    document.querySelectorAll('.sekai-page').forEach(p => p.style.display = 'none');
    document.getElementById('sekai-page-' + tab).style.display = 'block';
    document.querySelectorAll('.sekai-nav-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    if (tab === 'updates' && typeof loadSekaiUpdates === 'function') loadSekaiUpdates();
    if (tab === 'characters') renderGallery();
    if (tab === 'ranking' && typeof loadRankingBoard === 'function') loadRankingBoard();
}

/* ===== Background photo carousel (fades between curated character art, left + right sides) ===== */
(function initBgCarousel() {
    function runCarousel(selector, intervalMs, delayMs) {
        const slides = document.querySelectorAll(selector);
        if (!slides.length) return;
        let idx = 0;
        slides[0].classList.add('active');
        setTimeout(() => {
            setInterval(() => {
                slides[idx].classList.remove('active');
                idx = (idx + 1) % slides.length;
                slides[idx].classList.add('active');
            }, intervalMs);
        }, delayMs);
    }
    runCarousel('#bg-carousel .bg-slide-left', 7000, 0);
    runCarousel('#bg-carousel .bg-slide-right', 7000, 3500);
})();

/* ===== Floating colorful prism particles (Project SEKAI "colorful stage" accent) ===== */
(function initBgParticles() {
    const container = document.getElementById('bg-particles');
    if (!container) return;
    const colors = ['#39c5bb', '#ff6fa5', '#a78bfa', '#fbbf24', '#7dd3fc'];
    function spawnParticle() {
        const p = document.createElement('div');
        p.className = 'bg-particle';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.color = colors[Math.floor(Math.random() * colors.length)];
        const scale = 0.7 + Math.random() * 1.3;
        p.style.transform = `scale(${scale})`;
        const duration = 10 + Math.random() * 8;
        p.style.animationDuration = duration + 's';
        container.appendChild(p);
        setTimeout(() => p.remove(), duration * 1000);
    }
    setInterval(spawnParticle, 1200);
    for (let i = 0; i < 5; i++) setTimeout(spawnParticle, i * 400);
})();

/* ===== Player game IDs (per-visitor, stored locally in their own browser) ===== */
function loadPlayerIds() {
    const tw = localStorage.getItem('sekai_player_id_tw') || '';
    const jp = localStorage.getItem('sekai_player_id_jp') || '';
    document.getElementById('player-id-tw-input').value = tw;
    document.getElementById('player-id-jp-input').value = jp;
}

function savePlayerIds() {
    const tw = document.getElementById('player-id-tw-input').value.trim();
    const jp = document.getElementById('player-id-jp-input').value.trim();
    localStorage.setItem('sekai_player_id_tw', tw);
    localStorage.setItem('sekai_player_id_jp', jp);
    showToast(t('player_id_saved'));
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
    applyLang(siteLang);
    loadPlayerIds();

    const mvVideo = document.getElementById('mv-lightbox-video');
    mvVideo.addEventListener('play', () => { if (songMvAudio) songMvAudio.play().catch(() => {}); });
    mvVideo.addEventListener('pause', () => { if (songMvAudio) songMvAudio.pause(); });
    mvVideo.addEventListener('seeked', () => { if (songMvAudio) songMvAudio.currentTime = mvVideo.currentTime; });
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
