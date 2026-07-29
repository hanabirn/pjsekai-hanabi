/* ===== Screenshot + gallery image storage (IndexedDB — localStorage is too small for images) ===== */
const SEKAI_IMG_DB_NAME = 'sekai_images_db';
const SEKAI_IMG_STORE = 'images';
const SEKAI_GALLERY_STORE = 'gallery';

function openImageDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(SEKAI_IMG_DB_NAME, 2);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SEKAI_IMG_STORE)) db.createObjectStore(SEKAI_IMG_STORE);
            if (!db.objectStoreNames.contains(SEKAI_GALLERY_STORE)) db.createObjectStore(SEKAI_GALLERY_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function imageKey(musicId, difficulty) {
    return `${musicId}_${difficulty}`;
}

async function saveScoreImage(musicId, difficulty, blob) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SEKAI_IMG_STORE, 'readwrite');
        tx.objectStore(SEKAI_IMG_STORE).put(blob, imageKey(musicId, difficulty));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getScoreImage(musicId, difficulty) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SEKAI_IMG_STORE, 'readonly');
        const req = tx.objectStore(SEKAI_IMG_STORE).get(imageKey(musicId, difficulty));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function deleteScoreImage(musicId, difficulty) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SEKAI_IMG_STORE, 'readwrite');
        tx.objectStore(SEKAI_IMG_STORE).delete(imageKey(musicId, difficulty));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllFromStore(storeName) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const result = [];
        const req = store.openCursor();
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                result.push([cursor.key, cursor.value]);
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

async function getAllScoreImagesAsBase64() {
    const entries = await getAllFromStore(SEKAI_IMG_STORE);
    const out = {};
    for (const [key, blob] of entries) {
        out[key] = await blobToBase64(blob);
    }
    return out;
}

async function restoreScoreImagesFromBase64(images) {
    // Decode all blobs BEFORE opening the transaction: IndexedDB transactions
    // auto-commit once the microtask queue drains, so an `await` between
    // starting the tx and calling put() closes it out from under us.
    const entries = await Promise.all(
        Object.entries(images || {}).map(async ([key, dataUrl]) => [key, await base64ToBlob(dataUrl)])
    );
    const db = await openImageDb();
    const tx = db.transaction(SEKAI_IMG_STORE, 'readwrite');
    const store = tx.objectStore(SEKAI_IMG_STORE);
    store.clear();
    entries.forEach(([key, blob]) => store.put(blob, key));
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/* ===== Character gallery (own object store, own id scheme) ===== */
function newGalleryId() {
    return Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

async function addGalleryImage(blob) {
    const db = await openImageDb();
    const id = newGalleryId();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SEKAI_GALLERY_STORE, 'readwrite');
        tx.objectStore(SEKAI_GALLERY_STORE).put(blob, id);
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllGalleryImages() {
    const entries = await getAllFromStore(SEKAI_GALLERY_STORE);
    return entries
        .map(([id, blob]) => ({ id, blob }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

async function deleteGalleryImage(id) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SEKAI_GALLERY_STORE, 'readwrite');
        tx.objectStore(SEKAI_GALLERY_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllGalleryImagesAsBase64() {
    const entries = await getAllFromStore(SEKAI_GALLERY_STORE);
    const out = {};
    for (const [key, blob] of entries) {
        out[key] = await blobToBase64(blob);
    }
    return out;
}

async function restoreGalleryImagesFromBase64(images) {
    const entries = await Promise.all(
        Object.entries(images || {}).map(async ([key, dataUrl]) => [key, await base64ToBlob(dataUrl)])
    );
    const db = await openImageDb();
    const tx = db.transaction(SEKAI_GALLERY_STORE, 'readwrite');
    const store = tx.objectStore(SEKAI_GALLERY_STORE);
    store.clear();
    entries.forEach(([key, blob]) => store.put(blob, key));
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function base64ToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
}
