const mongoose = require('mongoose');

const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 400,
    socketTimeoutMS: 80000,
    serverSelectionTimeoutMS: 10000
}

const connectToDB = async () => {
    try {
        await mongoose.connect("mongodb://mongo:27017/HerodhaDev", connectionOptions);
        console.log("Connection to the database was successful!");
    } catch (error) {
        console.error("There was an error connecting to the database: ", error);
        process.exit(1);
    }
};

module.exports = connectToDB;