/**
 * CORS middleware
 * Set CORS headers for all requests
 */
const cors = (req, res, next) => {
    // Allow all origins (for development)
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE, PATCH');
    res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization, X-Requested-With, Application, X-API-Key, X-Notify-Secret, X-Slack-Signature, X-Slack-Request-Timestamp'
    );
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours

    // Return response immediately for OPTIONS requests (preflight)
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
};

module.exports = cors;
