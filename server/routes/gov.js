const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

/**
 * CorpPass Simulation Gateway
 * This route simulates the Singpass/CorpPass OAuth 2.1 flow for SFFS testing.
 */

// 1. Authorize - Simulate redirect to Singpass Login
router.get('/corppass/auth', authMiddleware, (req, res) => {
    const { state, redirect_uri } = req.query;
    console.log(`[GOV-SIM] Authorize request received. State: ${state}`);

    // Simulate the Singpass Login Page environment
    res.json({
        auth_url: `/gov-sim-login?state=${state}&redirect_uri=${redirect_uri}`,
        message: "Redirecting to Singapore Government Login Gateway..."
    });
});

// 2. Callback - Simulate successful authentication and code exchange
router.get('/corppass/callback', (req, res) => {
    const { state, code } = req.query;
    console.log(`[GOV-SIM] Callback received with code: ${code}`);

    // In a real flow, this would exchange 'code' for an access_token via APEX.
    // We simulate a successful token response.
    res.json({
        access_token: `sim_token_${Math.random().toString(36).substr(2)}`,
        expires_in: 3600,
        scope: "iras:ais:submit",
        token_type: "Bearer"
    });
});

module.exports = router;
