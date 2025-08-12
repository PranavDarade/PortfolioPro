const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Check if user is logged in via session
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get user from database
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = auth; 