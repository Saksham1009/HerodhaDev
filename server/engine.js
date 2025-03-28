const express = require('express');
const router = express.Router();
const Stock = require('./DBModels/Stock');
const User_Stocks = require('./DBModels/User_Stocks');
const User = require('./DBModels/User');
const Stock_Tx = require('./DBModels/Stock_Tx');
const matchingEngine = require('./DBModels/engine');
const Wallet_Tx = require('./DBModels/Wallet_Tx');
const uuid = require('uuid');
/*
router.post('/placeStockOrder', async (req, res) => {
    const { stock_id, is_buy, order_type, quantity, price } = req.body;
    const user_id = req.userId;

    if (
        !stock_id ||
        !order_type ||
        !quantity ||
        (is_buy === undefined || is_buy === null) ||
        (order_type === 'LIMIT' && price == null)
    ) {
        return res.status(400).json({
            "success": false,
            "data": {
                "error": "Please provide all the required fields"
            }
        });
    }

    if (is_buy && order_type === 'MARKET' && price) {
        return res.status(400).json({ "success": false, "data": { "error": 'Price should not be provided for market orders' } });
    }

    try {
        const stock = await Stock.findOne({stock_id: stock_id});
        if (!stock) {
            return res.status(404).json({ success: false, message: 'Invalid stock ID' });
        }

        const user = await User.findOne({user_id: user_id});
        if (!user) {
            return res.status(404).json({ success: false, message: 'Invalid user ID' });
        }
        //sell order
        if (!is_buy && order_type === 'LIMIT') {
            const userStock = await User_Stocks.findOne({ user_id: user_id, stock_id: stock_id });
            if (!userStock || userStock.quantity_owned < quantity) {
                return res.status(400).json({ success: false, message: 'Insufficient stocks' });
            }

            // deduct stock from user
            userStock.quantity_owned -= quantity;
            if (userStock.quantity_owned === 0) {
                await User_Stocks.deleteOne({ user_id: user_id, stock_id: stock_id });
            } else {
                await userStock.save();
            }

            const stockTx = new Stock_Tx({
                stock_tx_id: uuid.v4(),
                stock_id: stock_id,
                parent_stock_tx_id: null,
                wallet_tx_id: null,
                user_id: user_id,
                order_status: 'IN_PROGRESS',
                is_buy: false,
                order_type: order_type,
                quantity: quantity,
                stock_price: price
            });

            await stockTx.save();

            const engineSellOrder = {
                id: stockTx.stock_tx_id,
                stock_id,
                user_id,
                is_buy: false,
                order_type,
                quantity,
                price: price,
            };

            await matchingEngine.executeOrder(engineSellOrder);
        } else {
            console.log(" Processing BUY order...");
            await matchingEngine.refreshBook();
            const sellOrders = await matchingEngine.orderBook.getSellOrders();
            console.log("Fetched sell orders from engine:", sellOrders);
            const filteredSellOrders = sellOrders.filter(order => order.stock_id === stock_id && order.user_id !== user_id);
            console.log("filtered sell orders", filteredSellOrders);

            if (!filteredSellOrders || filteredSellOrders.length === 0) {
                return res.status(400).json({
                    success: false,
                    data: {
                        error: "No sell orders available"
                    }
                });
            }

            const totalStocks = filteredSellOrders.reduce((acc, order) => {
                return acc + order.quantity;
            }, 0);

            if (totalStocks < quantity) {
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }

            let quantityLeftToMatch = quantity;
            let totalPriceForOrder = 0;

            for (let sellOrder of filteredSellOrders) {
                const quantityToMatch = Math.min(quantityLeftToMatch, sellOrder.quantity);
                const priceToMatch = sellOrder.price;

                totalPriceForOrder += quantityToMatch * priceToMatch;

                if (user.balance < totalPriceForOrder) { // this might cause issues later if we have already inserted some transactions below and then we encounter less funds!
                    return res.status(400).json({ "success": false, "data": { "message": 'Insufficient funds' } });
                }

                const buyStockTx = new Stock_Tx({
                    stock_tx_id: uuid.v4(),
                    stock_id: stock_id,
                    wallet_tx_id: uuid.v4(),
                    user_id: user_id,
                    order_status: 'COMPLETED',
                    is_buy: true,
                    order_type: order_type,
                    quantity: quantityToMatch,
                    stock_price: priceToMatch,
                    parent_stock_tx_id: null
                });
                await buyStockTx.save();

                const parentStockTx = await Stock_Tx.findOne({ stock_tx_id: sellOrder.id });
                if (parentStockTx) {
                    if (parentStockTx.order_status !== 'PARTIALLY_COMPLETE') {
                        parentStockTx.order_status = 'PARTIALLY_COMPLETE';
                        await parentStockTx.save();
                    }
                }

                const sellStockTx = new Stock_Tx({
                    stock_tx_id: uuid.v4(),
                    stock_id: stock_id,
                    wallet_tx_id: uuid.v4(),
                    user_id: sellOrder.user_id,
                    order_status: 'COMPLETED',
                    is_buy: false,
                    order_type: 'LIMIT',
                    quantity: quantityToMatch,
                    stock_price: priceToMatch,
                    parent_stock_tx_id: parentStockTx.stock_tx_id
                });
                await sellStockTx.save();

                const buyWalletTx = new Wallet_Tx({
                    wallet_tx_id: buyStockTx.wallet_tx_id,
                    user_id: user_id,
                    is_debit: true,
                    stock_tx_id: buyStockTx.stock_tx_id,
                    amount: quantityToMatch * priceToMatch
                });
                await buyWalletTx.save();

                const sellWalletTx = new Wallet_Tx({
                    wallet_tx_id: sellStockTx.wallet_tx_id,
                    user_id: sellOrder.user_id,
                    stock_tx_id: sellStockTx.stock_tx_id,
                    is_debit: false,
                    amount: quantityToMatch * priceToMatch
                });
                await sellWalletTx.save();

                const seller = await User.findOne({ user_id: sellOrder.user_id });
                if (seller) {
                    seller.balance += quantityToMatch * priceToMatch;
                    await seller.save();
                }

                sellOrder.quantity -= quantityToMatch;
                if (sellOrder.quantity === 0) {
                    await matchingEngine.cancelOrder(sellOrder);
                } else {
                    await matchingEngine.updateOrder(sellOrder);
                }

                quantityLeftToMatch -= quantityToMatch;

                if (quantityLeftToMatch === 0) {
                    break;
                }
            };

            user.balance -= totalPriceForOrder;
            await user.save();

            const buyerUserStock = await User_Stocks.findOne({ user_id: user_id, stock_id: stock_id });
            if (buyerUserStock) {
                buyerUserStock.quantity_owned += quantity;
                await buyerUserStock.save();
            } else {
                const newUserStock = new User_Stocks({
                    user_stock_id: uuid.v4(),
                    user_id: user_id,
                    stock_id: stock_id,
                    quantity_owned: quantity,
                    stock_name: stock.stock_name
                });
                await newUserStock.save();
            }
        }

        return res.json({ success: true, data: null });
    } catch (err) {
        console.log("Error returned here" + err);
        return res.status(500).json({
            success: false,
            data: { message: err.message }
        });
    }
});
*/


router.post('/placeStockOrder', async (req, res) => {
    const { stock_id, is_buy, order_type, quantity, price } = req.body;
    const user_id = req.userId;

    if (!stock_id || !order_type || !quantity || is_buy === undefined || (order_type === 'LIMIT' && price == null)) {
        return res.status(400).json({ success: false, data: { error: "Please provide all the required fields" } });
    }

    if (is_buy && order_type === 'MARKET' && price) {
        return res.status(400).json({ success: false, data: { error: "Price should not be provided for market orders" } });
    }

    try {
        const [stock, user] = await Promise.all([
            Stock.findOne({ stock_id }),
            User.findOne({ user_id })
        ]);

        if (!stock) return res.status(404).json({ success: false, message: 'Invalid stock ID' });
        if (!user) return res.status(404).json({ success: false, message: 'Invalid user ID' });

        if (!is_buy && order_type === 'LIMIT') {
            // SELL LIMIT
            const userStock = await User_Stocks.findOne({ user_id, stock_id });

            if (!userStock || userStock.quantity_owned < quantity) {
                return res.status(400).json({ success: false, message: 'Insufficient stocks' });
            }

            userStock.quantity_owned -= quantity;
            if (userStock.quantity_owned === 0) {
                await User_Stocks.deleteOne({ user_id, stock_id });
            } else {
                await userStock.save();
            }

            const stockTx = new Stock_Tx({
                stock_tx_id: uuid.v4(),
                stock_id,
                user_id,
                is_buy: false,
                order_type,
                quantity,
                stock_price: price,
                order_status: 'IN_PROGRESS',
                parent_stock_tx_id: null
            });

            await stockTx.save();

            await matchingEngine.executeOrder({
                id: stockTx.stock_tx_id,
                stock_id,
                user_id,
                is_buy: false,
                order_type,
                quantity,
                price
            });

            return res.json({ success: true, data: null });
        }

        // BUY ORDER FLOW
        await matchingEngine.refreshBook();
        const sellOrders = (await matchingEngine.orderBook.getSellOrders())
            .filter(order => order.stock_id === stock_id && order.user_id !== user_id);

        if (!sellOrders.length) {
            return res.status(400).json({ success: false, data: { error: "No sell orders available" } });
        }

        const totalAvailable = sellOrders.reduce((sum, o) => sum + o.quantity, 0);
        if (totalAvailable < quantity) {
            return res.status(200).json({ success: true, data: [] });
        }

        let quantityLeft = quantity;
        let totalCost = 0;
        const txs = [];

        for (const sellOrder of sellOrders) {
            const qty = Math.min(quantityLeft, sellOrder.quantity);
            const cost = qty * sellOrder.price;
            totalCost += cost;

            if (user.balance < totalCost) {
                return res.status(400).json({ success: false, data: { message: 'Insufficient funds' } });
            }

            // Build transactions in-memory
            const buyTxId = uuid.v4();
            const sellTxId = uuid.v4();

            txs.push(
                new Stock_Tx({
                    stock_tx_id: buyTxId,
                    stock_id,
                    user_id,
                    is_buy: true,
                    quantity: qty,
                    stock_price: sellOrder.price,
                    order_type,
                    order_status: 'COMPLETED',
                    wallet_tx_id: buyTxId, 
                    parent_stock_tx_id: null
                }),
                new Stock_Tx({
                    stock_tx_id: sellTxId,
                    stock_id,
                    user_id: sellOrder.user_id,
                    is_buy: false,
                    quantity: qty,
                    stock_price: sellOrder.price,
                    order_type: 'LIMIT',
                    order_status: 'COMPLETED',
                    wallet_tx_id: sellTxId,
                    parent_stock_tx_id: sellOrder.id
                }),
                new Wallet_Tx({
                    wallet_tx_id: buyTxId,
                    user_id,
                    is_debit: true,
                    stock_tx_id: buyTxId,
                    amount: cost
                }),
                new Wallet_Tx({
                    wallet_tx_id: sellTxId,
                    user_id: sellOrder.user_id,
                    is_debit: false,
                    stock_tx_id: sellTxId,
                    amount: cost
                })
            );

            const seller = await User.findOne({ user_id: sellOrder.user_id });
            if (seller) {
                seller.balance += cost;
                await seller.save();
            }

            sellOrder.quantity -= qty;
            if (sellOrder.quantity === 0) await matchingEngine.cancelOrder(sellOrder);
            else await matchingEngine.updateOrder(sellOrder);

            quantityLeft -= qty;
            if (quantityLeft <= 0) break;
        }

        user.balance -= totalCost;
        await user.save();

        await Promise.all(txs.map(tx => tx.save()));

        const buyerStock = await User_Stocks.findOne({ user_id, stock_id });
        if (buyerStock) {
            buyerStock.quantity_owned += quantity;
            await buyerStock.save();
        } else {
            await new User_Stocks({
                user_stock_id: uuid.v4(),
                user_id,
                stock_id,
                quantity_owned: quantity,
                stock_name: stock.stock_name
            }).save();
        }

        return res.json({ success: true, data: null });
    } catch (err) {
        console.error("Error placing order:", err);
        return res.status(500).json({ success: false, data: { message: err.message } });
    }
});

router.post('/cancelStockTransaction', async (req, res) => {
    try {
        const stock_tx_id = req.body.stock_tx_id;
        const user_id = req.userId;

        if (!stock_tx_id) {
            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "Please provide stock_tx_id"
                }
            });
        }

        const stockTx = await Stock_Tx.findOne({ stock_tx_id: stock_tx_id, is_buy: false });

        if (!stockTx) {
            return res.status(404).json({
                "success": false,
                "data": {
                    "error": "Invalid stock_tx_id"
                }
            });
        }

        const prevStatus = stockTx.order_status;

        console.log("Previous status: ", prevStatus);

        if (stockTx.order_status === 'COMPLETED' || stockTx.order_status === 'CANCELLED') {
            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "Transaction already completed"
                }
            });
        }

        stockTx.order_status = 'CANCELLED';
        await stockTx.save();

        var quantityToReturn = stockTx.quantity;

        console.log("Quantity to return: ", quantityToReturn);

        const nestedStockTransactions = await Stock_Tx.find({ parent_stock_tx_id: stock_tx_id });

        console.log("Nested stock transactions: ", nestedStockTransactions);

        const totalQMatched = nestedStockTransactions.reduce((acc, tx) => {
            return acc + tx.quantity;
        }, 0);
        quantityToReturn = stockTx.quantity - totalQMatched;

        console.log("Total quantity matched: ", totalQMatched);

        if (quantityToReturn > 0) {
            const userStock = await User_Stocks.findOne({ user_id: user_id, stock_id: stockTx.stock_id });
            if (!userStock) {
                const stock = await Stock.findOne({ stock_id: stockTx.stock_id });
                const newUserStock = new User_Stocks({
                    user_stock_id: uuid.v4(),
                    user_id: user_id,
                    stock_id: stockTx.stock_id,
                    quantity_owned: quantityToReturn,
                    stock_name: stock.stock_name
                });
                await newUserStock.save();
            } else {
                userStock.quantity_owned += quantityToReturn;
                await userStock.save();
            }
        }

        return res.status(200).json({
            "success": true,
            "data": null
        });

    } catch (error) {
        return res.status(500).json({
            "success": false,
            "data": {
                "error": "There seems to be an error: " + error.message
            }
        });
    }
});


module.exports = router;