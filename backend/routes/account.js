const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get current paper money balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('paperMoneyBalance');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ balance: user.paperMoneyBalance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update paper money balance (add new balance to existing balance)
router.put('/balance', auth, async (req, res) => {
  const { newBalance } = req.body;

  if (typeof newBalance !== 'number' || newBalance < 0) {
    return res.status(400).json({ message: 'Invalid balance amount' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add new balance to existing balance
    user.paperMoneyBalance += newBalance;
    await user.save();

    res.json({ balance: user.paperMoneyBalance });
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 