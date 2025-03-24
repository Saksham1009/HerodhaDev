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
            await redis.set("orderBookData", JSON.stringify(this.orderBook.sellOrders));
            await redis.publish("orderBookData", JSON.stringify(this.orderBook.sellOrders));
        } catch (error) {
            console.error("Error saving order book in Redis: " + error);
        }
    }

    async executeOrder(order) {
        if (order.is_buy && order.order_type === 'MARKET') {
            const sellOrder = this.orderBook.getFirstSellOrder(); // TODO: this might cause issue since we are have all stockids in one list
            while (order.quantity > 0 && sellOrder) {
                const quantity = Math.min(order.quantity, sellOrder.quantity);
                order.quantity -= quantity;
                sellOrder.quantity -= quantity;

                if (sellOrder.quantity === 0) {
                    this.orderBook.deleteSellOrder(sellOrder.id);
                }
            }
        } else {
            this.orderBook.addSellOrder(order);
        }

        await this.saveBookInRedis();

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
        this.orderBook.sellOrders = JSON.parse(orders);

        redisSub.subscribe('orderBook', (err, count) => {
            if (err) {
                console.error('Redis error:', err);
            } else {
                console.log('Subscribed to orderBook channel');
            }
        });

        redisSub.on("message", async (channel, message) => {
            if (channel === "orderBook") {
                await this.refreshBook();
            }
        });
    }
}

const engineInstance = new Engine();
module.exports = engineInstance;
