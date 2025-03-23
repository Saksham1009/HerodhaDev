const mongoose = require('mongoose');

const StockCollection = new mongoose.Schema({
    stock_id: {
        type: String,
        unique: true,
        required: true
    },
    stock_name: {
        type: String, 
        required: true,
        unique: true
    },
    time_stamp: { 
        type: Date, 
        required: true, 
        default: Date.now
    }
});

module.exports = mongoose.model('Stock', StockCollection);