/* Proxies api.sekai.best's event ranking history for a single rank.
   Passing `rank` (without a `timestamp`) to their /rankings endpoint returns
   that rank's score at every snapshot for the whole event in one call — far
   cheaper than fetching a full leaderboard snapshot per timestamp, which
   would mean hundreds of requests each carrying every player's honor/profile
   data. The response is stripped down to just {t, s} pairs for the same
   reason: the upstream payload includes a lot we don't use. */
const ALLOWED_REGIONS = ['jp', 'tw', 'en', 'kr'];

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const qs = event.queryStringParameters || {};
    const eventId = qs.eventId;
    const rank = qs.rank;
    const region = qs.region || 'jp';

    if (!eventId || !/^\d+$/.test(eventId) || !rank || !/^\d+$/.test(rank)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing or invalid eventId/rank' }) };
    }
    if (!ALLOWED_REGIONS.includes(region)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid region' }) };
    }

    try {
        const url = `https://api.sekai.best/event/${eventId}/rankings?region=${region}&rank=${rank}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.status !== 'success' || !json.data || !Array.isArray(json.data.eventRankings)) {
            return { statusCode: 200, headers, body: JSON.stringify({ points: [], message: json.message || 'no data' }) };
        }

        const points = json.data.eventRankings.map(r => ({ t: r.timestamp, s: parseInt(r.score, 10) || 0 }));
        return {
            statusCode: 200,
            headers: { ...headers, 'Cache-Control': 'public, max-age=180' },
            body: JSON.stringify({ points }),
        };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
