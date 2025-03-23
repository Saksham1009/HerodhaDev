const mongoose = require('mongoose');

const UserCollection = new mongoose.Schema({
    user_id: {
        type: String,
        unique: true,
        required: true
    },
    user_name: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    balance: {
        type: Number,
        required: true,
        default: 0
    }
});

// TODO: Could add indexes here for better optimizations later?

module.exports = mongoose.model('User', UserCollection);