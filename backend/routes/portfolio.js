const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const {
    getPortfolio,
    addStock,
    sellStock,
    getTransactions,
    getPortfolioSummary
} = require('../controllers/portfolioController');

// @route   GET /api/portfolio
// @desc    Get user's portfolio
// @access  Private
router.get('/', auth, getPortfolio);

// @route   POST /api/portfolio
// @desc    Add stock to portfolio
// @access  Private
router.post('/', [
    auth,
    [
        check('symbol', 'Symbol is required').not().isEmpty(),
        check('shares', 'Shares must be a positive number').isFloat({ min: 0.000001 }),
        check('price', 'Price must be a positive number').isFloat({ min: 0.01 })
    ]
], addStock);

// @route   POST /api/portfolio/sell
// @desc    Sell stock from portfolio
// @access  Private
router.post('/sell', [
    auth,
    [
        check('symbol', 'Symbol is required').not().isEmpty(),
        check('shares', 'Shares must be a positive number').isFloat({ min: 0.000001 })
    ]
], sellStock);

// @route   GET /api/portfolio/transactions/:symbol
// @desc    Get transactions for a specific stock
// @access  Private
router.get('/transactions/:symbol', auth, getTransactions);

// @route   GET /api/portfolio/summary
// @desc    Get portfolio summary
// @access  Private
router.get('/summary', auth, getPortfolioSummary);

module.exports = router; 