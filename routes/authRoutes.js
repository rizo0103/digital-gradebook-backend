const express = require('express');
const jwt = require('jsonwebtoken');
const { private } = require('../configs');
const { logs } = require('../utils/common');
const connectToCloudSQL = require('../db');

const authRouter = express.Router();

authRouter.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await connectToCloudSQL;
        const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
        const filter = [username, password];

        const [results] = await pool.execute(sql, filter);

        if (results.length) {
            const token = jwt.sign({ username, password }, private, { expiresIn: "12h" });

            console.log(logs(req).info(`User ${username} logged in successfully`));

            return res.status(200).json({ message: "success", token: token });
        } else {
            console.error(logs(req).err, `User ${username} not found`);
            return res.status(404).json({ message: "user was not found..." });
        }

    } catch (error) {
        console.error(logs(req).err, error);
        return res.status(500).json({ message: "server error" + error });
    }
});

authRouter.post("/register", async (req, res) => {
    const { name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, username, password, status, email, phone } = req.body;

    try {
        const pool = await connectToCloudSQL;
        const [table] = await pool.query("SHOW TABLES LIKE 'users'");
        if (!table.length) {
            console.log(logs(req).info("Creating 'users' table"));
            const createTableSQL = `
                CREATE TABLE users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name_tj VARCHAR(255),
                    last_name_tj VARCHAR(255),
                    name_en VARCHAR(255),
                    last_name_en VARCHAR(255),
                    name_kr VARCHAR(255),
                    last_name_kr VARCHAR(255),
                    username VARCHAR(255) UNIQUE,
                    password VARCHAR(255),
                    status VARCHAR(50),
                    email VARCHAR(255) UNIQUE,
                    phone VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;
            await pool.query(createTableSQL);
        }

        const sql = `
            INSERT INTO users 
            (name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, username, password, status, email, phone) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [results] = await pool.execute(sql, [
            name_tj,
            last_name_tj,
            name_en,
            last_name_en,
            name_kr,
            last_name_kr,
            username,
            password,
            status,
            email,
            phone,
        ]);

        console.log(logs(req).info(`User ${username} registered successfully`));

        return res.status(200).json({
            message: "success",
            data: results,
        });

    } catch (err) {
        console.error(logs(req).err, err);
        return res.status(500).json({ message: "server error " + err });
    }
});

module.exports = authRouter;
