/* ===== Gacha simulator (fun only) =====
   Pulls from the real, currently-active JP gacha's rarity rates and card
   pool via the gacha-pool function (which trims sekai-master-db-diff's
   ~80MB combined gachas.json + cards.json down to just what's needed).
   Purely for fun — no save state, no pity/guarantee mechanics simulated
   (each pull is an independent weighted draw off the real rates), and
   completely disconnected from any real game account. */
const GACHA_RARITY_STARS = { rarity_1: 1, rarity_2: 2, rarity_3: 3, rarity_4: 4, rarity_birthday: 4 };

let gachaPoolData = null;
let gachaPoolLoading = null;
let gachaCharacters = [];

async function loadGachaPool() {
    if (gachaPoolData) return gachaPoolData;
    if (gachaPoolLoading) return gachaPoolLoading;
    gachaPoolLoading = Promise.all([
        fetch('/.netlify/functions/gacha-pool').then(res => res.json()),
        getSekaiCharacters(),
    ])
        .then(([data, characters]) => {
            gachaCharacters = characters;
            gachaPoolData = data.gacha;
            return gachaPoolData;
        })
        .catch(e => {
            console.error('Failed to load gacha pool:', e);
            return null;
        })
        .finally(() => { gachaPoolLoading = null; });
    return gachaPoolLoading;
}

function pickWeightedRarity(rates) {
    const roll = Math.random() * 100;
    let acc = 0;
    for (const r of rates) {
        acc += r.rate;
        if (roll < acc) return r.rarity;
    }
    return rates[rates.length - 1].rarity;
}

function pullOneGachaCard(gacha) {
    const rarity = pickWeightedRarity(gacha.rates);
    const candidates = gacha.pool.filter(c => c.rarity === rarity);
    const pool = candidates.length ? candidates : gacha.pool;
    return pool[Math.floor(Math.random() * pool.length)];
}

function gachaCardThumbUrl(card) {
    return `https://storage.sekai.best/sekai-jp-assets/character/member_small/${card.assetbundleName}/card_normal.webp`;
}

function gachaCharacterName(characterId) {
    const c = gachaCharacters.find(ch => ch.id === characterId);
    return c ? `${c.firstName || ''}${c.givenName}` : '';
}

async function renderGachaBanner() {
    const el = document.getElementById('gacha-sim-banner');
    if (!el) return;
    el.textContent = t('gacha_sim_loading');
    const gacha = await loadGachaPool();
    el.textContent = gacha ? gacha.name : t('gacha_sim_unavailable');
}

async function runGachaPull(count) {
    const resultsEl = document.getElementById('gacha-sim-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = `<p class="songs-empty">${t('gacha_sim_pulling')}</p>`;

    const gacha = await loadGachaPool();
    if (!gacha) {
        resultsEl.innerHTML = `<p class="songs-empty">${t('gacha_sim_unavailable')}</p>`;
        return;
    }

    const pulls = Array.from({ length: count }, () => pullOneGachaCard(gacha)).filter(Boolean);
    resultsEl.innerHTML = pulls.map(card => {
        const stars = GACHA_RARITY_STARS[card.rarity] || 2;
        const isRare = stars >= 4;
        return `
        <div class="gacha-result-card ${isRare ? 'rare' : ''}">
            <img src="${gachaCardThumbUrl(card)}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <div class="gacha-result-stars">${'★'.repeat(stars)}</div>
            <div class="gacha-result-name">${escapeHtmlSekai(gachaCharacterName(card.characterId))}</div>
        </div>`;
    }).join('');
}
