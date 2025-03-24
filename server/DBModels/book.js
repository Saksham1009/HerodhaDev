class Book {
    constructor() {
        this.sellOrders = [];
    }

    addSellOrder(order) {
        console.log("Is the issue happening here");
        console.log(this.sellOrders);
        this.sellOrders.push(order);
        this.sellOrders.sort((a, b) => a.price - b.price); // sort ascending by price
    }

    getSellOrders() {
        return this.sellOrders;
    }

    getFirstSellOrder() {
        return this.sellOrders[0];
    }

    deleteSellOrder(id) {
        this.sellOrders = this.sellOrders.filter(order => order.id !== id);
    }
}

module.exports = Book;