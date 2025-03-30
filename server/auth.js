const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('./DBModels/User');
const redis = require('./RedisConnection');
const uuid = require('uuid');

const router = express.Router();

router.post('/register', async (req, res) => {
    const username = req.body.user_name;
    const name = req.body.name;
    const password = req.body.password;

    if (!username || !name || !password) {
        return res.status(400).json({
            "success": false,
            "data": {
                "error": "Please provide all the required fields"
            }
        });
    }

    try {
        const userExists = await redis.get("username:" + username);
        if (userExists) {
            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "User with this username already exists"
                }
            });
        }

        let user = await User.findOne({ user_name: username }).maxTimeMS(12000);
        if (user) {
            try {
                await redis.set("username:" + username, user.user_id, 'EX', 3600);
            } catch (error) {
                console.error("Error setting key in Redis: " + error);
            }

            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "User with this username already exists"
                }
            });
        }

        user = new User({
            user_id: uuid.v4(),
            user_name: username,
            password: password,
            name: name
        });

        await redis.set(user.user_name, JSON.stringify({ userId: user.user_id, password: user.password }), 'EX', 3600);

        await user.save();

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

router.post('/login', async (req, res) => {
    const username = req.body.user_name;
    const password = req.body.password;

    try {
        const user = await redis.get(username);
        const userJson = JSON.parse(user);
        if (!username || !(password === userJson.password)) {
            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "Invalid username or password"
                }
            });
        }

        const token = jwt.sign({ userId: userJson.userId, username: username }, "thisisacustomanduniquesecrecetkey", { expiresIn: '3h' });
        return res.json({
            "success": true,
            "data": {
                "token": token
            }
        });
    } catch (error) {
        return res.status(500).json({
            "success": false,
            "data": {
                "error": "There seems to be an error" + error
            }
        });
    }
});

module.exports = router;