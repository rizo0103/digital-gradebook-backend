const express = require('express');
const jwt = require('jsonwebtoken');
const { private } = require('../configs');
const { logs } = require('../utils/common');
const { connectToCloudSQL } = require('../db');

const authRouter = express.Router();

authRouter.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = connectToCloudSQL();
        const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
        const filter = [username, password];

        const [results] = await pool.execute(sql, filter);

        if (results.length) {
            const token = jwt.sign({ username, password }, private, { expiresIn: "12h" });

            console.log(logs(req).ok);

            return res.status(200).json({ message: "success", token: token });
        } else {
            console.error(logs(req).err);

            return res.status(404).json({ message: "user was not found..." });
        }

    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error" + error });
    }
});

authRouter.post("/register", async (req, res) => {
    const { english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, status, email } = await req.body;

    try {
        const pool = await connectToCloudSQL();
        const [table] = await pool.query("SHOW TABLES LIKE 'users'");
        if (!table.length) {
            const createTableSQL = `
                CREATE TABLE users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    english_first_name VARCHAR(255),
                    english_last_name VARCHAR(255),
                    korean_first_name VARCHAR(255),
                    korean_last_name VARCHAR(255),
                    username VARCHAR(255) UNIQUE,
                    password VARCHAR(255),
                    status VARCHAR(50),
                    email VARCHAR(255) UNIQUE
                );
            `;
            await pool.query(createTableSQL);
        }

        const sql = `
            INSERT INTO users 
            (english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, status, email) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [results] = await pool.execute(sql, [
            english_first_name,
            english_last_name,
            korean_first_name,
            korean_last_name,
            username,
            password,
            status,
            email,
        ]);

        console.log(logs(req).ok);

        return res.status(200).json({
            message: "success",
            data: results,
        });



    } catch (err) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + err });
    }

});


module.exports = authRouter;
