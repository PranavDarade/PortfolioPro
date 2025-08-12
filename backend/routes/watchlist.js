const router = require('express').Router();
const Watchlist = require('../models/Watchlist');
const auth = require('../middleware/auth'); // Add authentication middleware

// GET /api/watchlist - Get the logged-in user's watchlist
router.get('/', auth, async (req, res) => {
    try {
        const watchlist = await Watchlist.findOne({ user: req.user.id });
        if (!watchlist) {
            // If no watchlist exists, return an empty one
            return res.json({ user: req.user.id, symbols: [] });
        }
        res.json(watchlist);
    } catch (err) {
        console.error("Error fetching watchlist:", err);
        res.status(500).json({ message: 'Server error fetching watchlist' });
    }
});

// POST /api/watchlist - Add a symbol to the logged-in user's watchlist
router.post('/', auth, async (req, res) => {
    const { symbol } = req.body;

    if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ message: 'Valid stock symbol is required' });
    }

    const upperSymbol = symbol.toUpperCase().trim();

    try {
        let watchlist = await Watchlist.findOne({ user: req.user.id });

        if (!watchlist) {
            // Create a new watchlist if it doesn't exist
            watchlist = new Watchlist({
                user: req.user.id,
                symbols: [upperSymbol]
            });
        } else {
            // Add symbol if it doesn't already exist
            if (watchlist.symbols.includes(upperSymbol)) {
                return res.status(409).json({ message: `${upperSymbol} is already in the watchlist` });
            }
            watchlist.symbols.push(upperSymbol);
        }

        const savedWatchlist = await watchlist.save();
        res.status(201).json(savedWatchlist);

    } catch (err) {
        console.error("Error adding to watchlist:", err);
        if (err.code === 11000) { // Handle potential unique constraint error if creation race condition occurs
            return res.status(409).json({ message: 'Watchlist conflict, please try again.' })
        }
        res.status(500).json({ message: 'Server error adding to watchlist' });
    }
});

// DELETE /api/watchlist/:symbol - Remove a symbol from the logged-in user's watchlist
router.delete('/:symbol', auth, async (req, res) => {
    const symbolToRemove = req.params.symbol.toUpperCase().trim();

    try {
        const watchlist = await Watchlist.findOne({ user: req.user.id });

        if (!watchlist || !watchlist.symbols.includes(symbolToRemove)) {
            return res.status(404).json({ message: `Symbol ${symbolToRemove} not found in watchlist` });
        }

        // Remove the symbol
        watchlist.symbols = watchlist.symbols.filter(s => s !== symbolToRemove);

        await watchlist.save();
        res.json({ message: `${symbolToRemove} removed from watchlist`, watchlist });

    } catch (err) {
        console.error("Error removing from watchlist:", err);
        res.status(500).json({ message: 'Server error removing from watchlist' });
    }
});

// Remove the PATCH route as it's no longer needed with the simplified model
// router.patch('/:id', ...);

module.exports = router; 