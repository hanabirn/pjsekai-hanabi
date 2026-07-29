/* ===== Score screenshot storage (IndexedDB — localStorage is too small for images) ===== */
const SEKAI_IMG_DB_NAME = 'sekai_images_db';
const SEKAI_IMG_STORE = 'images';

function openImageDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(SEKAI_IMG_DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(SEKAI_IMG_STORE);
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

async function getAllScoreImagesAsBase64() {
    const db = await openImageDb();
    const entries = await new Promise((resolve, reject) => {
        const tx = db.transaction(SEKAI_IMG_STORE, 'readonly');
        const store = tx.objectStore(SEKAI_IMG_STORE);
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
