const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('./DBModels/User');
const redis = require('./RedisConnection');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');

const router = express.Router();

const createHashedPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

const verifyPassword = async (password, encodedPass) => {
    return await bcrypt.compare(password, encodedPass);
};

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

        const encodedPass = await createHashedPassword(password);

        user = new User({
            user_id: uuid.v4(),
            user_name: username,
            password: encodedPass,
            name: name
        });

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
        const user = await User.findOne({ user_name: username });
        if (!user || !(await verifyPassword(password, user.password))) {
            return res.status(400).json({
                "success": false,
                "data": {
                    "error": "Invalid username or password"
                }
            });
        }

        const token = jwt.sign({ userId: user.user_id, username: user.user_name }, "thisisacustomanduniquesecrecetkey", { expiresIn: '3h' });
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