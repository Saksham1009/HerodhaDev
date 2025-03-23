const mongoose = require('mongoose');

const WalletTxCollection = new mongoose.Schema({
    wallet_tx_id: {
        type: String,
        required: true,
        unique: true
    },
    user_id: {
        type: String,
        required: true
    },
    stock_tx_id: {
        type: String,
        required: false
    },
    is_debit: {
        type: Boolean,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    time_stamp: {
        type: Date,
        required: true,
        default: Date.now
    }
});

module.exports = mongoose.model('Wallet_Tx', WalletTxCollection);