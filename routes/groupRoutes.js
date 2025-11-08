const express = require('express');
const connection = require('../db');
const jwt = require("jsonwebtoken");
const { private } = require("../configs");
const { logs, getUserFromToken } = require('../utils/common');

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

    
    const modifiedDays = days.map(day => {
        let year = `${day}`.substring(0, 4),
            month = `${day}`.substring(4, 6),
            date = `${day}`.substring(6, 8);

        return `${year}-${month}-${date}`;
    }), months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const finalDays = {};
        
    modifiedDays.map(day => {
        let dateObj = new Date(day);
        let year = dateObj.getFullYear();
        let month = months[dateObj.getMonth()];

        finalDays[year] = finalDays[year] || {};
        finalDays[year][month] = finalDays[month] || [];
    });

        
    modifiedDays.map(day => {
        let dateObj = new Date(day);
        let year = dateObj.getFullYear();
        let month = months[dateObj.getMonth()];
        let date = dateObj.getDate();
        
        finalDays[year][month].push(date);
    });

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
        const sql = "INSERT INTO groups (name, amount, days) VALUES ( ?, ?, ?)";
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
        
        // verify admin status
        if (user.status !== "admin") {
            console.error(logs(req).err);
         
            return res.status(403).json({ message: "forbidden" });
        }

        // get groups
        const sql = "SELECT * FROM groups";
        const [results] = await connection.promise().query(sql);

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

module.exports = groupRouter;
