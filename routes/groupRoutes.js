const express = require('express');
const connectToCloudSQL = require('../db');
const jwt = require("jsonwebtoken");
const multer = require('multer');
const { private } = require("../configs");
const { logs, getUserFromToken, modifyDays } = require('../utils/common');

const groupRouter = express.Router();

groupRouter.post("/create-group", async(req, res) => {
    const { name, group_type, teacher_id, teacher_name_tj, teacher_name_en, teacher_name_kr, schedule, time } = req.body;
    const { token } = req.headers;

    if (!token) {
        console.error(logs(req).err, " no token provided");

        return res.status(401).json({ message: "no token provided" });
    }

    try {
        const pool = await connectToCloudSQL,
            user = await getUserFromToken(token, jwt, private);
    
        const [groupTables] = await pool.execute("SHOW TABLES LIKE 'groups'");

        if (groupTables.length === 0) {
            try {
                await pool.execute(`
                    CREATE TABLE \`groups\` (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        group_type ENUM('language', 'topic', 'other') NOT NULL,
                        teacher_id INT,
                        teacher_name_tj VARCHAR(255),
                        teacher_name_en VARCHAR(255),
                        teacher_name_kr VARCHAR(255),
                        schedule VARCHAR(255),
                        time VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            } catch (error) {
                console.error(logs(req).err, error);

                return res.status(400).json({ message: error });
            }

        }

        console.log(logs(req).ok, " successfuly craeted groups table");

        const sql = `
            INSERT INTO \`groups\` 
            (name, group_type, teacher_id, teacher_name_tj, teacher_name_en, teacher_name_kr, schedule, time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, filter = [name, group_type, teacher_id, teacher_name_tj, teacher_name_en, teacher_name_kr, schedule, time];

        await pool.execute(sql, filter);

        console.log(logs(req).ok, " successfuly inserter data to `groups`");

        return res.status(200).json({ message: "success" });

    } catch (error) {
        console.error(logs(req).err, error);

        return res.status(500).json({ message: "Server error", error });
    }
});

groupRouter.get("/get-groups", async(req, res) => {
    const { token } = req.headers;

    try {
        const pool = await connectToCloudSQL,
            user = await getUserFromToken(token, jwt, private);
        
            if (!user) {
                console.error(logs(req).err, " unauthorized");

                return res.status(401).json({ message: "unauthorized" });
            }

            if (user.status !== "admin" && user.status !== "teacher") {
                console.error(logs(req).err, " forbidden");

                return res.status(403).json({ message: "forbidden" });
            
            }

            const [table] = await pool.execute("SHOW TABLES LIKE 'groups'");

            if (table.length === 0) {
                console.error(logs(req).err, " groups table not found");

                return res.status(404).json({ message: "groups table not found", data: [] });
            }

            if (user.status === "teacher") {
                const teacherId = user.id;
                const sql = `SELECT * FROM \`groups\` WHERE teacher_id = ?`;
                const [results] = await pool.execute(sql, [teacherId]);

                console.log(logs(req).ok, " successfuly get data from `groups`");
                return res.status(200).json({ message: "success", data: results });
            }

            const sql = `SELECT * FROM \`groups\``;
            const [results] = await pool.execute(sql);

            console.log(logs(req).ok, " successfuly get data from `groups`");
            return res.status(200).json({ message: "success", data: results });
    } catch (error) {
        console.error(logs(req).err, error);

    }
});

groupRouter.post("/create-timeslot", async(req, res) => {
    const { name, timeslot } = req.body;
    const { token } = req.headers;

    try {
        if (!name || !timeslot) {
            console.error(logs(req).err, " data not provided");

            return res.status(400).json({ message: "data not provided" });        
        }

        const user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req).err, " unauthorized");

            return res.status(401).json({ message: "unauthorized" });
        }

        if (user.status !== "admin") {
            console.error(logs(req).err, " forbidden");

            return res.status(403).json({ message: "forbidden" });
        }

        const pool = await connectToCloudSQL;
        const [table] = await pool.execute("SHOW TABLES LIKE 'timeslots'");

        if (table.length === 0) {
            await pool.execute(`
                CREATE TABLE \`timeslots\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    timeslot VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }

        const sql = `INSERT INTO timeslots (name, timeslot) VALUES (?, ?)`;
        const [result] = await pool.execute(sql, [name, timeslot]);

        console.log(logs(req).ok, " successfuly inserter data to `timeslots`");

        return res.status(200).json({ message: "success", data: result });
        
    } catch (error) {
        console.error(logs(req).err, error);

        return res.status(500).json({ message: "Server error", error });
    }
});

groupRouter.get("/get-timeslots", async(req, res) => {
    const { token } = req.headers;

    try {
        const pool = await connectToCloudSQL
            user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req).err, " unauthorized");

            return res.status(401).json({ message: "unauthorized" });
        }

        if (user.status !== "admin") {
            console.error(logs(req).err, " forbidden");

            return res.status(403).json({ message: "forbidden" });
        }

        const [table] = await pool.execute("SHOW TABLES LIKE 'timeslots'");

        if (table.length === 0) {
            console.error(logs(req).err, " timeslots table not found");

            return res.status(404).json({ message: "timeslots table not found", data: [] });
        }

        const sql = `SELECT * FROM timeslots`,
            [results] = await pool.execute(sql);
        
        console.log(logs(req).ok, " successfuly get data from `timeslots`");

        return res.status(200).json({ message: "success", data: results });
    } catch (error) {
        console.error(logs(req).err, " server error");
        
        return res.status(500).json({ message: "server error" });
    }
});

module.exports = groupRouter;
