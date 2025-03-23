const express = require('express');
const router = express.Router();
const UserStocks = require('./DBModels/User_Stocks');
const StockTx = require('./DBModels/Stock_Tx');

router.get('/getStockPortfolio', async (req, res) => {
    try {
        const userId = req.userId;

        const userOwnedStocks = await UserStocks.find({ user_id: userId });

        const response = userOwnedStocks.map(stock => {
            return {
                "stock_id": stock.stock_id,
                "stock_name": stock.stock_name,
                "quantity_owned": stock.quantity_owned
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

router.get('/getStockTransactions', async (req, res) => {
    try {
        const userId = req.userId;

        const userStockTx = await StockTx.find({ user_id: userId });

        const response = userStockTx.map(stocktx => {
            return {
                "stock_tx_id": stocktx.stock_tx_id,
                "parent_stock_tx_id": stocktx.parent_stock_tx_id,
                "stock_id": stocktx.stock_id,
                "wallet_tx_id": stocktx.wallet_tx_id,
                "order_status": stocktx.order_status,
                "is_buy": stocktx.is_buy,
                "order_type": stocktx.order_type,
                "stock_price": stocktx.stock_price,
                "quantity": stocktx.quantity,
                "time_stamp": stocktx.time_stamp
            }
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