const Portfolio = require('../models/Portfolio');
const User = require('../models/User'); // Import User model
const { validationResult } = require('express-validator');
const finnhub = require('finnhub'); // Import finnhub for company profile
const Transaction = require('../models/Transaction');

// Configure Finnhub client (ensure API key is loaded from .env)
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.FINNHUB_API_KEY;
const finnhubClient = new finnhub.DefaultApi();

// @desc    Get user's portfolio
// @route   GET /api/portfolio
// @access  Private
exports.getPortfolio = async (req, res) => {
    try {
        const portfolio = await Portfolio.find({ user: req.user.id });
        res.json(portfolio);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add or update stock in portfolio
// @route   POST /api/portfolio
// @access  Private
exports.addStock = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { symbol, shares, price } = req.body;
    const userId = req.user.id;

    // Validate input
    if (typeof shares !== 'number' || shares <= 0 || typeof price !== 'number' || price <= 0) {
        return res.status(400).json({ message: 'Invalid shares or price' });
    }

    const cost = shares * price;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check paper money balance
        if (user.paperMoneyBalance < cost) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }

        let position = await Portfolio.findOne({ user: userId, symbol });
        let companyName = '';

        if (position) {
            // Update existing position
            const currentTotalCost = position.shares * position.avgCost;
            const newTotalShares = position.shares + shares;
            const newTotalCost = currentTotalCost + cost;
            position.avgCost = newTotalCost / newTotalShares;
            position.shares = newTotalShares;
            companyName = position.name; // Use existing name
        } else {
            // Create new position - Fetch company name from Finnhub
            try {
                const profile = await new Promise((resolve, reject) => {
                    finnhubClient.companyProfile2({ symbol }, (error, data, response) => {
                        if (error) reject(error);
                        else resolve(data);
                    });
                });
                companyName = profile.name || symbol; // Use fetched name or symbol as fallback
            } catch (finnhubError) {
                console.error('Finnhub error fetching profile:', finnhubError);
                companyName = symbol; // Fallback to symbol if Finnhub fails
            }

            position = new Portfolio({
                user: userId,
                symbol,
                name: companyName,
                shares,
                avgCost: price
            });
        }

        // Create transaction record
        const transaction = new Transaction({
            userId,
            symbol,
            type: 'BUY',
            quantity: shares,
            price,
            total: cost,
            status: 'COMPLETED'
        });

        // Add transaction to portfolio
        position.transactions.push({
            type: 'BUY',
            symbol,
            shares,
            price,
            total: cost
        });

        // Deduct cost from paper money balance
        user.paperMoneyBalance -= cost;

        // Save all updates
        await Promise.all([
            position.save(),
            user.save(),
            transaction.save()
        ]);

        res.json({ position, newBalance: user.paperMoneyBalance });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Sell stock from portfolio
// @route   POST /api/portfolio/sell
// @access  Private
exports.sellStock = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { symbol, shares } = req.body;
    const userId = req.user.id;

     // Validate input
    if (typeof shares !== 'number' || shares <= 0) {
        return res.status(400).json({ message: 'Invalid number of shares' });
    }

    try {
        const [position, user] = await Promise.all([
            Portfolio.findOne({ user: userId, symbol }),
            User.findById(userId)
        ]);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!position) {
            return res.status(404).json({ msg: 'Position not found' });
        }
        if (shares > position.shares) {
            return res.status(400).json({ msg: 'Insufficient shares' });
        }

        // Fetch current price for selling
        let currentPrice = position.avgCost; // Fallback to avgCost if quote fails
        try {
            const quote = await new Promise((resolve, reject) => {
                finnhubClient.quote(symbol, (error, data, response) => {
                    if (error) reject(error);
                    else resolve(data);
                });
            });
            currentPrice = quote.c; // Use current market price
        } catch (quoteError) {
            console.error(`Failed to fetch current price for ${symbol}:`, quoteError);
            // Continue with avgCost as fallback
        }

        const proceeds = shares * currentPrice;

        // Create transaction record
        const transaction = new Transaction({
            userId,
            symbol,
            type: 'SELL',
            quantity: shares,
            price: currentPrice,
            total: proceeds,
            status: 'COMPLETED'
        });

        // Update position
        position.shares -= shares;

        // Add sell transaction to portfolio
        position.transactions.push({
            type: 'SELL',
            symbol,
            shares,
            price: currentPrice,
            total: proceeds
        });

        // Add proceeds to paper money balance
        user.paperMoneyBalance += proceeds;

        if (position.shares === 0) {
            // Remove position if all shares are sold
            await Promise.all([
                Portfolio.findOneAndDelete({ _id: position._id }),
                user.save(),
                transaction.save()
            ]);
            res.json({ msg: 'Position closed', newBalance: user.paperMoneyBalance });
        } else {
            await Promise.all([
                position.save(),
                user.save(),
                transaction.save()
            ]);
            res.json({ position, newBalance: user.paperMoneyBalance });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get transactions for a specific stock
// @route   GET /api/portfolio/transactions/:symbol
// @access  Private
exports.getTransactions = async (req, res) => {
    try {
        const position = await Portfolio.findOne({ 
            user: req.user.id, 
            symbol: req.params.symbol 
        });

        if (!position) {
            return res.status(404).json({ msg: 'Position not found' });
        }

        res.json(position.transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get portfolio summary
// @route   GET /api/portfolio/summary
// @access  Private
exports.getPortfolioSummary = async (req, res) => {
    try {
        const positions = await Portfolio.find({ user: req.user.id });
        
        const summary = {
            totalPositions: positions.length,
            totalValue: 0,
            totalCost: 0,
            totalGainLoss: 0,
            gainLossPercentage: 0
        };

        positions.forEach(position => {
            const positionValue = position.shares * position.avgCost;
            summary.totalValue += positionValue;
            summary.totalCost += position.shares * position.avgCost;
        });

        summary.totalGainLoss = summary.totalValue - summary.totalCost;
        summary.gainLossPercentage = summary.totalCost > 0 
            ? (summary.totalGainLoss / summary.totalCost) * 100 
            : 0;

        res.json(summary);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}; 