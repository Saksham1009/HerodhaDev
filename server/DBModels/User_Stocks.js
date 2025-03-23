const mongoose = require('mongoose');

const UserStocksCollection = new mongoose.Schema({
    user_stock_id: {
        type: String,
        required: true,
        unique: true
    },
    stock_id: {
        type: String,
        required: true
    },
    stock_name: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    }, 
    quantity_owned: {
        type: Number, 
        required: true, 
        min: 0
    },
    updated_at: {
        type: Date, 
        required: true, 
        default: Date.now
    }
});

module.exports = mongoose.model('User_Stocks', UserStocksCollection);