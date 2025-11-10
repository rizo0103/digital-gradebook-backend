const express = require('express');
const connection = require('../db');
const jwt = require("jsonwebtoken");
const { private } = require("../configs");
const { logs, getUserFromToken, modifyDays } = require('../utils/common');

const groupRouter = express.Router();

groupRouter.get("/get-timeslots", async(req, res) => {
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
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

        // get timeslots
        const sql = "SELECT * FROM timeslots";
        const [results] = await connection.promise().query(sql);

        console.log(logs(req).ok);
        return res.status(200).json({ message: "success", data: results });

    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.post("/create-group", async(req, res) => {
    const { name, amount, days } = await req.body; 
    const { token } = req.headers;

    if (!token) {
        console.error(logs(req).err);
    }
    
    days.sort((a, b) => a - b);
    let finalDays = modifyDays(days);

    try {
        // verify token (throws if invalid)
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

        // create group
        const sql = "INSERT INTO groups (name, amount, days) VALUES (?, ?, ?)";
        const [result] = await connection.promise().query(sql, [name, amount, JSON.stringify(finalDays)]);

        console.log(logs(req).ok);
        return res.status(200).json({ message: "group created", data: result });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }

});

groupRouter.get("/get-groups", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
        const user = await getUserFromToken(token, jwt, private, connection);
        
        if (!user) {
            console.error(logs(req).err);
         
            return res.status(401).json({ message: "unauthorized" });
        }
        
        // verify admin or teacher status
        if (user.status !== "admin" && user.status !== "teacher") {
            console.error(logs(req).err);
         
            return res.status(403).json({ message: "forbidden" });
        }

        // get groups
        let sql = "SELECT * FROM groups",
            filter = [];

        if (user.status === "teacher") {
            sql = "SELECT * FROM groups WHERE teacher = ?";
            filter.push(user.username);
        }

        const [results] = await connection.promise().query(sql, filter);

        console.log(logs(req).ok);
        return res.status(200).json({ message: "success", data: results });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.get("/get-all-groups", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)

        const user = await getUserFromToken(token, jwt, private, connection);

        if (!user) {
            console.error(logs(req).err);

            return res.status(401).json({ message: "unauthorized" });
        }

        if (user.status !== "admin") {
            console.error(logs(req).err);

            return res.status(403).json({ message: "forbidden" });
        }

        const sql = "SELECT * FROM groups";
        const [results] = await connection.promise().query(sql);

        console.log(logs(req).ok);

        return res.status(200).json({ message: "success", data: results });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.get("/get-group-data/:id", async (req, res) => {
    const { id } = req.params;
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
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

        let sql = "SELECT * FROM groups WHERE id = ?",
            [results] = await connection.promise().query(sql, id);
        
        if (results.length === 0) {
            console.error(logs(req).err);

            return res.status(404).json({ message: "group was not found" });
        }

        console.log(logs(req).ok);

        return res.status(200).json({ message: "success", data: results[0] });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error" + error });
    }
});

groupRouter.put("/update-group/:id", async (req, res) => {
    const { id } = req.params;
    const { new_name, new_amount, new_days } = req.body;
    const { token } = req.headers;

    if (new_days.length === 0) {
        console.error(logs(req).err);

        return res.status(400).json({ message: "no days provided" });
    }

    let finalDays = modifyDays(new_days);

    try {
        // verify token (throws if invalid)
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

        let sql = "UPDATE groups SET name = ?, amount = ?, days = ? WHERE id = ?",
            [results] = await connection.promise().query(sql, [new_name, new_amount, JSON.stringify(finalDays), id]);
        
        if (results.length === 0) {
            console.error(logs(req).err);

            return res.status(404).json({ message: "group was not found" });
        }

        console.log(logs(req).ok);

        return res.status(200).json({ message: "success", data: results[0] });
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error" + error });
    }
});

groupRouter.post("/create-timeslot", async (req, res) => {
        const { name, timeslot } = await req.body;
    const { token } = req.headers;

    if (!token) {
        console.error(logs(req).err);

        return res.status(400).json({ message: "no token provided" });
    }

    try {
        // verify token (throws if invalid)
        const decoded = jwt.verify(token, private);
        const username = decoded && decoded.username;

        timeslot.sort((a, b) => a - b);
        
        if (!username) {
            console.error(logs(req).err);
            
            return res.status(400).json({ message: "invalid token" });
        }

        // check if user is admin
        const [users] = await connection.promise().query("SELECT * FROM users WHERE username = ?", [username]);
        const user = users && users[0];
        
        if (!user || user.status !== "admin") {
            console.error(logs(req).err);
            return res.status(403).json({ message: "forbidden" });
        }

        // check if there is table for the timeslots
        const [tables] = await connection.promise().query("SHOW TABLES LIKE 'timeslots'");

        if (tables.length === 0) {
            // create table if not exists
            await connection.promise().query("CREATE TABLE timeslots (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), timeslot JSON)");
            console.log("Timeslots table created");
        }

        const sql = "INSERT INTO timeslots (name, timeslot) VALUES (?, ?)";
        const filter = [name, JSON.stringify(timeslot)];
        await connection.promise().query(sql, filter);

        console.log(logs(req).ok);

        return res.status(200).json({message: "success" });
    } catch (err) {
        console.error(logs(req).err);

        return res.status(500).json({message: "server error " + err});
    }
});

module.exports = groupRouter;
