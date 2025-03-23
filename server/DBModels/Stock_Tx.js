const mongoose = require('mongoose');

const StockTxCollection = new mongoose.Schema({
    stock_tx_id: {
        type: String,
        required: true,
        unique: true
    },
    stock_id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    stock_price: {
        type: Number,
        required: true
    },
    is_buy: {
        type: Boolean,
        required: true
    },
    time_stamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    parent_stock_tx_id: {
        type: String,
        required: false
    },
    order_status: {
        type: String,
        enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PARTIALLY_COMPLETE'],
        required: true
    },
    wallet_tx_id: {
        type: String,
        required: false
    },
    order_type: {
        type: String,
        enum: ['MARKET', 'LIMIT'],
        required: true
    }
});

module.exports = mongoose.model('Stock_Tx', StockTxCollection);