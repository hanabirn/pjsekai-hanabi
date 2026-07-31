/* ===== Updates tab: JP + Global/EN (via Netlify function proxy, CORS-blocked
   direct) + TW + KR (direct fetch, CORS-open — TW and KR are both white-label
   deployments of the same ByteDance game-marketing platform, just a different
   host/app_id/channel, so they share one parser). ===== */
const JP_NEWS_FUNCTION_URL = '/.netlify/functions/jp-news';
const EN_NEWS_FUNCTION_URL = '/.netlify/functions/en-news';
const TW_NEWS_API_URL = 'https://act.toutiaocloud.com/site/api/v2/news/search?app_id=5245&language=en-US&website=74&page=1&block=2&channel=5&page_index=1&page_size=20&top_flag=false';
const KR_NEWS_API_URL = 'https://act.nvsgames.com/site/api/v2/news/search?app_id=292248&language=en-US&website=90&page=2&block=6&channel=18&top_flag=false&page_index=1&page_size=20';
const JP_NEWS_PAGE_URL = 'https://pjsekai.sega.jp/news/index.html';
const TW_NEWS_PAGE_URL = 'https://www.tw-pjsekai.com/news.html';
const EN_NEWS_PAGE_URL = 'https://colorfulstage.com/news/';
const KR_NEWS_PAGE_URL = 'https://www.kr-pjsekai.com/news.html';
const JP_NEWS_IMAGE_BASE = 'https://pjsekai.sega.jp/master-data/image/news/';

let sekaiUpdatesLoaded = false;

async function loadSekaiUpdates() {
    if (sekaiUpdatesLoaded) return;
    sekaiUpdatesLoaded = true;
    loadJpNews();
    loadTwNews();
    loadEnNews();
    loadKrNews();
}

function newsItemHtml(title, dateStr, category, linkUrl, imageUrl) {
    return `<a class="news-item" href="${linkUrl}" target="_blank" rel="noopener">
        ${imageUrl ? `<img class="news-thumb" src="${imageUrl}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div class="news-item-body">
            <div class="news-item-header">
                <span class="news-date">${dateStr}</span>
                ${category ? `<span class="news-category">${category}</span>` : ''}
            </div>
            <span class="news-title">${escapeHtmlSekai(title)}</span>
        </div>
    </a>`;
}

async function loadJpNews() {
    const container = document.getElementById('jp-news-list');
    container.innerHTML = `<div class="news-loading">${t('updates_loading')}</div>`;
    try {
        const res = await fetch(JP_NEWS_FUNCTION_URL);
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        const items = (data.news || []).slice().sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 20);
        if (items.length === 0) {
            container.innerHTML = `<div class="news-empty">${t('updates_empty')}</div>`;
            return;
        }
        container.innerHTML = items.map(n => {
            const d = new Date(n.publishedAt);
            const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
            const imageUrl = n.thumbImage ? JP_NEWS_IMAGE_BASE + n.thumbImage : '';
            return newsItemHtml(n.title, dateStr, n.categoryDisplayName, JP_NEWS_PAGE_URL, imageUrl);
        }).join('');
    } catch (e) {
        console.error('JP news load failed:', e);
        container.innerHTML = `<div class="news-empty">${t('updates_load_fail')}</div>`;
    }
}

async function loadEnNews() {
    const container = document.getElementById('en-news-list');
    container.innerHTML = `<div class="news-loading">${t('updates_loading')}</div>`;
    try {
        const res = await fetch(EN_NEWS_FUNCTION_URL);
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        const items = (data.news || []).slice(0, 20);
        if (items.length === 0) {
            container.innerHTML = `<div class="news-empty">${t('updates_empty')}</div>`;
            return;
        }
        container.innerHTML = items.map(n => {
            const linkUrl = n.targetUrl ? EN_NEWS_PAGE_URL.replace(/\/$/, '') + n.targetUrl : EN_NEWS_PAGE_URL;
            const imageUrl = n.thumimg ? 'https://colorfulstage.com' + n.thumimg : '';
            return newsItemHtml(n.title, n.updated || '', n.category || '', linkUrl, imageUrl);
        }).join('');
    } catch (e) {
        console.error('EN news load failed:', e);
        container.innerHTML = `<div class="news-empty">${t('updates_load_fail')}</div>`;
    }
}

async function loadKrNews() {
    const container = document.getElementById('kr-news-list');
    container.innerHTML = `<div class="news-loading">${t('updates_loading')}</div>`;
    try {
        const res = await fetch(KR_NEWS_API_URL);
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        const items = (data.data && data.data.page_news || []).slice().sort((a, b) => b.update_at - a.update_at).slice(0, 20);
        if (items.length === 0) {
            container.innerHTML = `<div class="news-empty">${t('updates_empty')}</div>`;
            return;
        }
        container.innerHTML = items.map(n => {
            const d = new Date(n.update_at * 1000);
            const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
            const title = n.title || n.news_name;
            return newsItemHtml(title, dateStr, '', n.url || KR_NEWS_PAGE_URL, n.image || '');
        }).join('');
    } catch (e) {
        console.error('KR news load failed:', e);
        container.innerHTML = `<div class="news-empty">${t('updates_load_fail')}</div>`;
    }
}

async function loadTwNews() {
    const container = document.getElementById('tw-news-list');
    container.innerHTML = `<div class="news-loading">${t('updates_loading')}</div>`;
    try {
        const res = await fetch(TW_NEWS_API_URL);
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        const items = (data.data && data.data.page_news || []).slice().sort((a, b) => b.update_at - a.update_at).slice(0, 20);
        if (items.length === 0) {
            container.innerHTML = `<div class="news-empty">${t('updates_empty')}</div>`;
            return;
        }
        container.innerHTML = items.map(n => {
            const d = new Date(n.update_at * 1000);
            const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
            const title = n.title || n.news_name;
            return newsItemHtml(title, dateStr, '', n.url || TW_NEWS_PAGE_URL, n.image || '');
        }).join('');
    } catch (e) {
        console.error('TW news load failed:', e);
        container.innerHTML = `<div class="news-empty">${t('updates_load_fail')}</div>`;
    }
}
