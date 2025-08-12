const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com'
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Cookie Parser
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb+srv://pranavdarade9:pranav@cluster0.a8w68em.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7 // 1 week
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

// WebSocket server with session support
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? 'https://yourdomain.com'
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Connect to MongoDB
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://pranavdarade9:pranav@cluster0.a8w68em.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => {
    console.log('MongoDB Connected:', mongoose.connection.host);
    // Create indexes after successful connection
    require('./models/Transaction').createIndexes()
      .then(() => console.log('Database indexes created successfully'))
      .catch(err => console.error('Error creating indexes:', err));
  })
  .catch(err => console.error('MongoDB connection error:', err));

// WebSocket middleware to attach session
io.use(async (socket, next) => {
  const sessionId = socket.handshake.auth.sessionID;
  if (!sessionId) {
    return next(new Error('Authentication error'));
  }

  try {
    const session = await mongoose.connection.db.collection('sessions').findOne({
      _id: sessionId
    });

    if (!session) {
      return next(new Error('Session not found'));
    }

    socket.session = session;
    next();
  } catch (error) {
    next(error);
  }
});

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  const subscribedStocks = new Set();

  socket.on('subscribe', ({ symbol }) => {
    subscribedStocks.add(symbol);
    // Start sending real-time updates for the subscribed symbol
  });

  socket.on('unsubscribe', ({ symbol }) => {
    subscribedStocks.delete(symbol);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    subscribedStocks.clear();
  });
});

// Routes
const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stocks');
const portfolioRoutes = require('./routes/portfolio');
const watchlistRoutes = require('./routes/watchlist');
const transactionRoutes = require('./routes/transactions');
const accountRoutes = require('./routes/account');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/account', accountRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Handle session errors
  if (err.message === 'Unable to find the session to touch') {
    return res.status(401).json({ message: 'Session expired or invalid' });
  }
  
  // Handle other errors
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

const PORT = process.env.PORT || 5000;

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
}); 