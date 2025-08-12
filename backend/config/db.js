const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        
        // Set mongoose options
        mongoose.set('strictQuery', false);
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50,
            minPoolSize: 10,
            connectTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Create indexes for your collections
        try {
            await Promise.all([
                conn.connection.collection('users').createIndexes([
                    { key: { email: 1 }, unique: true },
                    { key: { createdAt: 1 } }
                ]),
                conn.connection.collection('stocks').createIndexes([
                    { key: { symbol: 1 }, unique: true },
                    { key: { lastUpdated: 1 } }
                ]),
                conn.connection.collection('portfolios').createIndexes([
                    { key: { userId: 1 } },
                    { key: { createdAt: 1 } },
                    { key: { "stocks.symbol": 1 } }
                ]),
                conn.connection.collection('watchlists').createIndexes([
                    { key: { userId: 1 } },
                    { key: { createdAt: 1 } },
                    { key: { "stocks.symbol": 1 } }
                ])
            ]);
            console.log('Database indexes created successfully');
        } catch (indexError) {
            console.error('Error creating indexes:', indexError);
        }

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected. Attempting to reconnect...');
            setTimeout(connectDB, 5000);
        });

        // Enable query logging in development
        if (process.env.NODE_ENV === 'development') {
            mongoose.set('debug', true);
        }

    } catch (error) {
        console.error('MongoDB Connection Error:', error.message);
        console.error('Connection URI:', process.env.MONGODB_URI);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

module.exports = connectDB; 