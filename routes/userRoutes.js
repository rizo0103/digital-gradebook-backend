const express = require('express');
const jwt = require("jsonwebtoken");
const { private } = require("../configs");
const { logs, getUserFromToken } = require('../utils/common');
const connectToCloudSQL = require('../db');

const userRouter = express.Router();

userRouter.get("/get-all-users", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token
        const pool = await connectToCloudSQL;
        if (!token) {
            console.error(logs(req).err, "TOKEN ERROR");
            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin status
        const user = await getUserFromToken(token, jwt, private);

        if (user.status !== "admin") {
            console.error(logs(req).err, "STATUS ERROR");
            return res.status(403).json({ message: "forbidden" });
        }

        const sql = "SELECT * FROM users";
        const [results] = await pool.query(sql);

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
        const user = await getUserFromToken(token, jwt, private);
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
        const pool = await connectToCloudSQL;
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
        const [results] = await pool.execute(sql, [username]);

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
    const { new_username, new_password, new_name_tj, new_last_name_tj, new_name_kr, new_last_name_kr, new_name_en, new_last_name_en, new_status, new_email, new_phone } = req.body;
    const { token } = req.headers;

    try {
        const pool = await connectToCloudSQL;
        const requestingUser = await getUserFromToken(token, jwt, private);
        
        if (!requestingUser) {
            console.error(logs(req).err, "unauthorized");
            return res.status(401).json({ message: "unauthorized" });
        }
        
        if (requestingUser.status !== "admin") {
            console.error(logs(req).err, `user ${requestingUser.username} with status ${requestingUser.status} trying to update user, but not an admin`);
            return res.status(403).json({ message: "forbidden" });
        }
        
        const sql = "UPDATE users SET username = ?, password = ?, name_tj = ?, last_name_tj = ?, name_kr = ?, last_name_kr = ?, name_en = ?, last_name_en = ?, status = ?, email = ?, phone = ? WHERE username = ?";
        const [result] = await pool.execute(sql, [new_username, new_password, new_name_tj, new_last_name_tj, new_name_kr, new_last_name_kr, new_name_en, new_last_name_en, new_status, new_email, new_phone, username]);

        console.log(logs(req).info(`user ${requestingUser.username} updated user ${username}`));

        return res.status(200).json({ message: "user updated", data: result });
    } catch (error) {
        console.error(logs(req).err, "SERVER ERROR" + error);
        return res.status(500).json({ message: "server error " + error });
    }
});

module.exports = userRouter;
