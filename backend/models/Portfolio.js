const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    shares: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const positionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    shares: {
        type: Number,
        required: true,
        min: 0
    },
    avgCost: {
        type: Number,
        required: true,
        min: 0
    },
    transactions: [transactionSchema]
}, {
    timestamps: true,
    toJSON: {
        virtuals: true
    }
});

// Virtual fields for calculated values
positionSchema.virtual('marketValue').get(function() {
    return this.shares * this.currentPrice;
});

positionSchema.virtual('totalCost').get(function() {
    return this.shares * this.avgCost;
});

positionSchema.virtual('gainLoss').get(function() {
    return this.marketValue - this.totalCost;
});

positionSchema.virtual('gainLossPercentage').get(function() {
    return ((this.marketValue - this.totalCost) / this.totalCost) * 100;
});

// Compound index for user and symbol to ensure uniqueness
positionSchema.index({ user: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('Portfolio', positionSchema); 