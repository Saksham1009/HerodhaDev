const express = require('express');
const router = express.Router();
const UserStocks = require('./DBModels/User_Stocks');
const StockTx = require('./DBModels/Stock_Tx');
const matchingEngine = require('./DBModels/engine');
const client = require('./RedisConnection');
const Stock = require('./DBModels/Stock');

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
        return res.status(400).json({
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
        return res.status(400).json({
            "success": false,
            "data": {
                "error": "There seems to be an error " + error
            }
        });
    }
});

router.get('/getStockPrices', async (req, res) => {
    try {
        console.log("Fetching sell orders from orderBook...");
        console.log("OrderBook instance in /getStockPrices:", matchingEngine.orderBook);
        await matchingEngine.refreshBook();
        const sellOrders = matchingEngine.orderBook.getSellOrders();
        

        console.log("Sell Orders:", sellOrders);
        if (!sellOrders || sellOrders.length === 0) {
            return res.status(200).json({
                "success": true,
                "data": []
            });
        }

        const stocks = [...new Set(sellOrders.map(order => order.stock_id))];
        console.log("Unique stock IDs from sell orders:", stocks);

        const cacheKey = `stock_prices_${stocks.join("_")}`;
        const cachedDataExists = await client.get(cacheKey);


        console.log("Here is the cached data");
        console.log(cachedDataExists);

        if (cachedDataExists) {
            return res.status(200).json({
                "success": true,
                "data": JSON.parse(cachedDataExists)
            });
        }

        const stockPrices = {};
        const stockPriceData = await client.get("orderBookData");
        console.log("Here is the order book data");
        console.log(stockPriceData);
        JSON.parse(stockPriceData).forEach(order => {
            if (stockPrices[order.stock_id] && stockPrices[order.stock_id] > order.price) {
                stockPrices[order.stock_id] = order.price;
            } else if (!stockPrices[order.stock_id]) {
                stockPrices[order.stock_id] = order.price;
            }
        });

        const stockData = await Stock.find();
        const response = [];
        Object.keys(stockPrices).forEach(stock => {
            const stockName = stockData.find(data => data.stock_id === stock).stock_name;
            response.push({
                "stock_id": stock,
                "stock_name": stockName,
                "stock_price": stockPrices[stock]
            });
        });

        client.set(cacheKey, JSON.stringify(response));
        return res.status(200).json({
            "success": true,
            "data": response
        });
    } catch (error) {
        return res.status(400).json({
            "success": false,
            "data": {
                "error": "There seems to be an error " + error
            }
        });
    }
});

module.exports = router;