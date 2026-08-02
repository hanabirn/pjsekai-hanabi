/* Builds a lightweight "current gacha pool" from sekai-master-db-diff's
   gachas.json (45MB) and cards.json (34MB) — both far too large to ship to
   the browser directly. This function eats that cost once, keeps only the
   handful of fields the client needs for ~500-800 cards, and is cached hard
   (both by our own Cache-Control and Netlify's CDN) since gacha banners
   don't change more than once every few days. */
const CACHE_SECONDS = 21600; // 6 hours

function pickCurrentGacha(gachas) {
    const now = Date.now();
    const active = gachas.filter(g =>
        g.startAt <= now && g.endAt >= now &&
        Array.isArray(g.gachaCardRarityRates) && g.gachaCardRarityRates.length > 1 &&
        Array.isArray(g.gachaDetails) && g.gachaDetails.length > 0
    );
    if (active.length === 0) return null;
    active.sort((a, b) => b.startAt - a.startAt);
    return active[0];
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const [gachasRes, cardsRes] = await Promise.all([
            fetch('https://sekai-world.github.io/sekai-master-db-diff/gachas.json'),
            fetch('https://sekai-world.github.io/sekai-master-db-diff/cards.json'),
        ]);
        const gachas = await gachasRes.json();
        const cards = await cardsRes.json();

        const gacha = pickCurrentGacha(gachas);
        if (!gacha) {
            return { statusCode: 200, headers, body: JSON.stringify({ gacha: null }) };
        }

        const cardsById = {};
        cards.forEach(c => { cardsById[c.id] = c; });

        const pool = gacha.gachaDetails
            .map(d => cardsById[d.cardId])
            .filter(Boolean)
            .map(c => ({
                id: c.id,
                characterId: c.characterId,
                rarity: c.cardRarityType,
                assetbundleName: c.assetbundleName,
                prefix: c.prefix,
            }));

        const rates = gacha.gachaCardRarityRates.map(r => ({ rarity: r.cardRarityType, rate: r.rate }));

        const body = JSON.stringify({
            gacha: { id: gacha.id, name: gacha.name, rates, pool },
        });
        return {
            statusCode: 200,
            headers: { ...headers, 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
            body,
        };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
