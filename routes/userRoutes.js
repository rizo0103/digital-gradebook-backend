const express = require('express');
const connection = require('../db');
const jwt = require("jsonwebtoken");
const { private } = require("../configs");
const { logs, getUserFromToken } = require('../utils/common');

const userRouter = express.Router();

userRouter.post("/create-user", async(req, res) => {
    const { username, password, fullname, groups, status } = req.body;
    const { token } = req.headers;

    let english_first_name = "", english_last_name = "";

    console.log(groups);

    try {
        // verify token
        const user = await getUserFromToken(token, jwt, private, connection);
        if (!user) {
            console.error(logs(req).err);
            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin status
        if (user.status !== "admin") {
            console.error(logs(req).err);

            return res.status(403).json({ message: "forbidden" });
        }

        if (fullname) {
            const name = fullname.split(" ");
            
            first_name = name[0];
            last_name = name[1] || "ㅂ";
        }

        // create user
        const sql = "INSERT INTO users (english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, groups) VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        const [result] = await connection.promise().query(sql, [english_first_name, english_last_name, first_name, last_name, username, password, JSON.stringify(groups)]);

        console.log(logs(req).ok);

        return res.status(200).json({ message: "user created", data: result });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

module.exports = userRouter;
