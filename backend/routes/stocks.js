const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const finnhub = require('finnhub');
const WebSocketService = require('../services/websocketService');

// Configure Finnhub client
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.FINNHUB_API_KEY;
const finnhubClient = new finnhub.DefaultApi();

// Get real-time stock quote
router.get('/quote/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await new Promise((resolve, reject) => {
      finnhubClient.quote(symbol, (error, data, response) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
    res.json(quote);
  } catch (error) {
    console.error('Error fetching stock quote:', error);
    res.status(500).json({ message: 'Error fetching stock quote' });
  }
});

// Subscribe to real-time updates
router.post('/subscribe', auth, (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ message: 'Symbol is required' });
    }

    WebSocketService.subscribe(symbol);
    res.json({ message: `Subscribed to ${symbol}` });
  } catch (error) {
    console.error('Error subscribing to stock:', error);
    res.status(500).json({ message: 'Error subscribing to stock updates' });
  }
});

// Unsubscribe from real-time updates
router.post('/unsubscribe', auth, (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ message: 'Symbol is required' });
    }

    WebSocketService.unsubscribe(symbol);
    res.json({ message: `Unsubscribed from ${symbol}` });
  } catch (error) {
    console.error('Error unsubscribing from stock:', error);
    res.status(500).json({ message: 'Error unsubscribing from stock updates' });
  }
});

// Search stocks
router.get('/search/:query', auth, async (req, res) => {
  try {
    const { query } = req.params;
    const result = await new Promise((resolve, reject) => {
      finnhubClient.symbolSearch(query, (error, data, response) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
    res.json(result);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ message: 'Error searching stocks' });
  }
});

// Get company profile
router.get('/company/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const profile = await new Promise((resolve, reject) => {
      finnhubClient.companyProfile2({ symbol }, (error, data, response) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
    res.json(profile);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ message: 'Error fetching company profile' });
  }
});

module.exports = router; 