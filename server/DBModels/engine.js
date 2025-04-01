const Book = require('./book');
const redis = require('../RedisConnection');
const UserStocks = require('./User_Stocks');
const Stock = require('./Stock');
const { createClient } = require('redis');
const uuid = require('uuid');

const redisSub = createClient({
    url: 'redis://redis:6379',
});

class Engine {
    constructor() {
        this.orderBook = new Book();

        this.initializeEngine();
    }

    async refreshBook() {
        const orders = await redis.get("orderBookData");
        if (orders) {
            this.orderBook.sellOrders = JSON.parse(orders);
        } else {
            this.orderBook.sellOrders = [];
        }
    }

    async saveBookInRedis() {
        try {
            console.log("Loading existing sell orders from Redis...");
            const existingData = await redis.get("orderBookData");
            let existingOrders = existingData ? JSON.parse(existingData) : [];
    
            console.log("New local sell orders:", this.orderBook.sellOrders);
    
            // Merge by order.id to avoid duplicates
            const mergedMap = {};
    
            for (const order of existingOrders) {
                mergedMap[order.id] = order;
            }
    
            for (const order of this.orderBook.sellOrders) {
                mergedMap[order.id] = order;
            }
    
            const mergedOrders = Object.values(mergedMap);
    
            console.log("Final merged sellOrders:", mergedOrders);
    
            // Save merged sellOrders to Redis
            await redis.set("orderBookData", JSON.stringify(mergedOrders));
            await redis.publish("orderBookData", JSON.stringify(mergedOrders));
            console.log("Sell orders saved and published to Redis.");
    
            // Update local state to reflect merged data
            this.orderBook.sellOrders = mergedOrders;
    
            // Stock price cache logic
            const stocks = [...new Set(mergedOrders.map(order => order.stock_id))];
            console.log("Unique stock IDs:", stocks);
    
            const cacheKey = `stock_prices_${stocks.join("_")}`;
            console.log("Cache key:", cacheKey);
    
            const stockPrices = {};
            mergedOrders.forEach(order => {
                if (
                    stockPrices[order.stock_id] &&
                    stockPrices[order.stock_id] > order.price
                ) {
                    stockPrices[order.stock_id] = order.price;
                } else if (!stockPrices[order.stock_id]) {
                    stockPrices[order.stock_id] = order.price;
                }
            });
    
            const stockData = await Stock.find();
            const response = [];
    
            Object.keys(stockPrices).forEach(stock => {
                const stockName = stockData.find(data => data.stock_id === stock)?.stock_name || "Unknown";
                response.push({
                    stock_id: stock,
                    stock_name: stockName,
                    current_price: stockPrices[stock],
                });
            });
    
            await redis.set(cacheKey, JSON.stringify(response));
            console.log("Stock prices cached.");
    
        } catch (error) {
            console.error(" Error saving order book in Redis:", error);
        }
    }
    
    async executeOrder(order) {
        console.log("Executing order:", order);
        if (order.is_buy && order.order_type === 'MARKET') {
        } else {
            console.log("Processing as SELL order...");
            this.orderBook.addSellOrder(order);
            console.log("OrderBook instance in executeOrder:", this.orderBook);
            console.log("Sell order added to order book:", order);

        }

        await this.saveBookInRedis();
        console.log("Order book saved successfully.");
        


        return true;
    }

    async updateOrder(order) {
        if (!order || !order.id) {
            console.log("Invalid order provided for update");
            return false;
        }
    
        console.log("Updating order:", order);
        
        // First refresh the book to get the latest state
        await this.refreshBook();
        
        // Find the order in the sell orders array
        const orderIndex = this.orderBook.sellOrders.findIndex(o => o.id === order.id);
        
        if (orderIndex === -1) {
            console.log(`Order with id ${order.id} not found in the order book`);
            return false;
        }
        
        // Update the order with new values
        this.orderBook.sellOrders[orderIndex] = {
            ...this.orderBook.sellOrders[orderIndex],
            ...order
        };
        
        console.log("Order updated in order book:", this.orderBook.sellOrders[orderIndex]);
        
        // Save updated order book to Redis
        await this.saveBookInRedis();
        console.log("Order book saved after update");
        
        return true;
    }

    async cancelOrder(order) {
        if (!order) {
            return false;
        }

        if (order.is_buy) {
            return false;
        }

        this.orderBook.deleteSellOrder(order.id);

        console.log("Cancelling order: " + order.id);

        if (!order.is_buy && order.quantity > 0) {
            try {
                const userStocks = await UserStocks.findOne({ user_id: order.user_id, stock_id: order.stock_id });
                const stock = await Stock.findOne({ stock_id: order.stock_id });
                if (!userStocks) {
                    const newUserStock = new UserStocks({
                        user_stock_id: uuid.v4(),
                        user_id: order.user_id,
                        stock_id: order.stock_id,
                        quantity_owned: order.quantity,
                        stock_name: stock.stock_name
                    });

                    await newUserStock.save();
                } else {
                    userStocks.quantity_owned += order.quantity;
                    await userStocks.save();
                }
            } catch (error) {
                console.error("Error cancelling order: " + error);
                return false;
            }
        }

        await this.saveBookInRedis();

        return true;
    }

    async initializeEngine() {
        const orders = await redis.get("orderBookData");
        if (orders) {
            this.orderBook.sellOrders = JSON.parse(orders);
            console.log("Loaded sellOrders from Redis:", this.orderBook.sellOrders);
        } else {
            console.log("No sell orders found in Redis, starting with empty order book.");
        }

        redisSub.subscribe('orderBookData', (err, count) => {
            if (err) {
                console.error('Redis error:', err);
            } else {
                console.log('Subscribed to orderBook channel');
            }
        });

        redisSub.on("message", async (channel, message) => {
            if (channel === "orderBookData") {
                await this.refreshBook();
            }
        });
    }
}

const engineInstance = new Engine();
module.exports = engineInstance;
