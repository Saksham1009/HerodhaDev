const express = require('express');
const router = express.Router();
const Stock = require('./DBModels/Stock');
const User_Stocks = require('./DBModels/User_Stocks');
const uuid = require('uuid');

// Create a stock
router.post('/createStock', async (req, res) => {

    const stock_name = req.body.stock_name;

    if (!stock_name) {
        return res.status(400).json({
            success: false,
            data: {
                message: "Please provide stock name"
            }
        });
    }

    const stockExistenceCheck = await Stock.findOne({ stock_name: stock_name });

    if (stockExistenceCheck) {
        return res.status(400).json({
            success: false,
            data: {
                message: "Stock already exists"
            }
        });
    }

    const stock = new Stock({
        stock_id: uuid.v4(),
        stock_name: stock_name
    });

    try {
        const newStock = await stock.save();
        return res.status(201).json({
            success: true,
            data: {
                stock_id: newStock.stock_id
            }
        });  
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
});


// add Stock to User
router.post('/addStockToUser', async (req, res) => {

    try {
        const stock_id = req.body.stock_id;
        const quantity = Number(req.body.quantity);

        const userId = req.userId;

        if (!stock_id || !quantity) {
            return res.status(400).json({
                success: false,
                data: {
                    message: "Please provide stock_id and quantity"
                }
            });
        }

        // check if stock exists 
        const stock = await Stock.findOne({ stock_id: stock_id });
        if (!stock) {
            return res.status(404).json({success: false, message: "Stock not found"});
        }

        // check if user already owns the stock 

        let userStock = await User_Stocks.findOne({user_id: userId, stock_id});

        // if user stocks exists
        if (userStock){
            userStock.quantity_owned += quantity;
            userStock.updated_at = Date.now();
        } else {
            // create new user stock entry
            userStock = new User_Stocks({
                user_stock_id: uuid.v4(),
                user_id: userId,
                stock_name: stock.stock_name,
                stock_id: stock_id, 
                quantity_owned: quantity
            });
        }
        
        await userStock.save();
        return res.status(201).json({success: true, data: null});
    } catch (err){
        console.error("Error adding stock to user", err);
        return res.status(500).json({success: false, message: err});
    }
});

module.exports = router;
