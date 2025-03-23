const express = require('express');
const router = express.Router();
const User = require('./DBModels/User');
const WalletTx = require('./DBModels/Wallet_Tx');

router.post('/addMoneyToWallet', async (req, res) => {
    try {

        const amount = Number(req.body.amount);

        // Validate if amount entered in valid
        if (amount === undefined || amount < 0) {
            return res.status(400).json({ "success": false, "data": { "error": "Amount must be a positive number" } });
        }

        const userId = req.userId;

        const user = await User.findOne({ user_id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.balance += amount;  // Update the user's balance

        await user.save();

        // Return success response
        return res.status(200).json({ success: true, data: null });
    } catch (err) {
        console.error("Error adding money to wallet:", err);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

router.get('/getWalletBalance', async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findOne({ user_id: userId });

        if (!user) {
            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "User not found"
                }
            })
        }

        return res.status(200).json({
            "success": true,
            "data": {
                "balance": user.balance
            }
        });
    } catch (error) {
        return res.status(401).json({
            "success": false,
            "data": {
                "error": "There seems to be an error " + error
            }
        });
    }
});

router.get('/getWalletTransactions', async (req, res) => {
    try {
        const userId = req.userId;

        const userWalletTx = await WalletTx.find({ user_id: userId });

        const response = userWalletTx.map(walletTx => {
            return {
                wallet_tx_id: walletTx.wallet_tx_id,
                stock_tx_id: walletTx.stock_tx_id,
                is_debit: walletTx.is_debit,
                amount: walletTx.amount,
                time_stamp: walletTx.time_stamp
            };
        });

        return res.status(200).json({
            "success": true,
            "data": response
        });
    } catch (error) {
        return res.status(401).json({
            "success": false,
            "data": {
                "error": "There seems to be an error " + error
            }
        });
    }
});

module.exports = router;