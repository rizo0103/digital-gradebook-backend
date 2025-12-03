const express = require('express');
const connection = require('../db');
const jwt = require("jsonwebtoken");
const { private } = require("../configs");
const { logs, getUserFromToken } = require('../utils/common');

const userRouter = express.Router();

userRouter.post("/create-user", async(req, res) => {
    const { username, password, fullname_korean, fullname_english, groups, status } = req.body;
    const { token } = req.headers;

    if (!username || !password || !fullname_korean || !fullname_english || !groups || !status) {
        console.error(logs(req).err);
        return res.status(400).json({ message: "missing fields" });
    }

    let english_first_name = fullname_english.split(" ")[0], english_last_name = fullname_english.split(" ")[1];
    let korean_first_name = fullname_korean.split(" ")[0], korean_last_name = fullname_korean.split(" ")[1];

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

        // create user
        const sql = "INSERT INTO users (english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, groups, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        const [result] = await connection.promise().query(sql, [english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, JSON.stringify(groups), status]);

        console.log(logs(req).ok);

        if (result.affectedRows === 0) {
            console.error(logs(req).err);
            
            return res.status(500).json({ message: "user creation failed" });
        }

        groups.forEach(async (group) => {
            const updateGroupSql = "UPDATE groups SET teacher = ? WHERE name = ?";
            const [resp] = await connection.promise().query(updateGroupSql, [`${korean_last_name} ${korean_first_name}`, group]);
        });

        return res.status(200).json({ message: "user created", data: result });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error});
    }
});

userRouter.get("/get-all-users", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token
        if (!token) {
            console.error(logs(req).err, "TOKEN ERROR");
            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin status
        const user = await getUserFromToken(token, jwt, private, connection);

        if (user.status !== "admin") {
            console.error(logs(req).err, "STATUS ERROR");
            return res.status(403).json({ message: "forbidden" });
        }

        const sql = "SELECT * FROM users";
        const [results] = await connection.promise().query(sql);

        // const filteredResults = results.map(({ password, ...user }) => user);

        console.log(logs(req).ok);
        return res.status(200).json({ message: "success", data: results });

    } catch (error) {
        console.error(logs(req).err, "SERVER ERROR");

        return res.status(500).json({ message: "server error " + error });
    }
});

userRouter.get("/get-user-data", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token
        const user = await getUserFromToken(token, jwt, private, connection);
        if (!user) {
            console.error(logs(req).err);
            return res.status(401).json({ message: "unauthorized" });
        }

        console.log(logs(req).ok);
        
        return res.status(200).json({ message: "success", data: user });
    } catch (error) {
        console.error(logs(req).err);
        
        return res.status(500).json({ message: "server error " + error });
    }
});

userRouter.get("/get-user-data/:username", async (req, res) => {
    const { username } = req.params;
    const { token } = req.headers;

    try {
        // verify token
        const requestingUser = await getUserFromToken(token, jwt, private, connection);
        
        if (!requestingUser) {
            console.error(logs(req).err);
            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin status
        if (requestingUser.status !== "admin") {
            console.error(logs(req).err);
            return res.status(403).json({ message: "forbidden" });
        }

        const sql = "SELECT * FROM users WHERE username = ?";
        const [results] = await connection.promise().query(sql, [username]);

        if (results.length === 0) {
            console.error(logs(req).err);
            return res.status(404).json({ message: "user not found" });
        }
        
        console.log(logs(req).ok);

        return res.status(200).json({ message: "success", data: results[0] });
    } catch (error) {
        console.error(logs(req).err);
        
        return res.status(500).json({ message: "server error " + error });
    }
});

userRouter.put("/update-user/:username", async (req, res) => {
    const { username } = req.params;
    const { new_username, new_password, new_korean_first_name, new_korean_last_name, new_english_first_name, new_english_last_name, new_status, new_email } = req.body;
    const { token } = req.headers;

    try {
        // verify token
        const requestingUser = await getUserFromToken(token, jwt, private, connection);
        
        if (!requestingUser) {
            console.error(logs(req).err);
            return res.status(401).json({ message: "unauthorized" });
        }
        // verify admin status

        if (requestingUser.status !== "admin") {
            console.error(logs(req).err);
            return res.status(403).json({ message: "forbidden" });
        }
        
        const sql = "UPDATE users SET english_first_name = ?, english_last_name = ?, korean_first_name = ?, korean_last_name = ?, username = ?, password = ?, status = ?, email = ? WHERE username = ?";
        const [result] = await connection.promise().query(sql, [new_english_first_name, new_english_last_name, new_korean_first_name, new_korean_last_name, new_username, new_password, new_status, new_email, username]);

        console.log(logs(req).ok);

        // new_groups.forEach(async (group) => {
        //     const updateGroupSql = "UPDATE groups SET teacher = ? WHERE name = ?";
        //     const [resp] = await connection.promise().query(updateGroupSql, [`${last_name_korean} ${first_name_korean}`, group]);
        // });

        return res.status(200).json({ message: "user updated ", data: result });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

module.exports = userRouter;
