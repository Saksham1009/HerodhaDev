const DBConnection = require('./DBConnection');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

DBConnection();

const auth = require('./auth');
const setup = require('./setup');
const walletHandler = require('./walletHandler');
const stockHandler = require('./stockHandler');
const engine = require('./engine');

const app = express();

app.use(express.json());
app.use(cors());

function tokenCheck(req, res, next) {
    const token = req.headers.token;

    if (!token) {
        return res.status(401).json({ message: 'Access Denied, no token given' });
    }

    try {
        const verified = jwt.verify(token, "thisisacustomanduniquesecrecetkey");
        req.userId = verified.userId;
        req.username = verified.username;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
};

app.use('/authentication', auth);
app.use('/setup', tokenCheck, setup);
app.use('/transaction', tokenCheck, walletHandler);
app.use('/transaction', tokenCheck, stockHandler);
app.use('/engine', tokenCheck, engine);

app.listen(3030, () => {
    console.log('Server is running successfully on port 3001');
});

// TODO: Move keys to .env
