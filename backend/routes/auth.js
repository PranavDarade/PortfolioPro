const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      name,
      email,
      password
    });

    // Save user to database
    await user.save();

    // Set user in session
    req.session.userId = user._id;
    
    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Error saving session' });
      }
      
      res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Set user in session
    req.session.userId = user._id;
    
    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Error saving session' });
      }
      
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Verify session
router.get('/verify-session', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'No active session' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Save session explicitly to update last activity
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Error saving session' });
      }
      
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    });
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ message: 'Error verifying session' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  // Clear the session
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Error logging out' });
    }
    
    // Clear the session cookie
    res.clearCookie('connect.sid');
    
    // Send success response
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router; 