const express = require('express');
const jwt = require('jsonwebtoken');
const { private } = require('../configs');
const { logs } = require('../utils/common');
const connection = require('../db');

const authRouter = express.Router();

authRouter.post("/login", (req, res) => {
    const { username, password } = req.body;

    try {
        const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
        const filter = [username, password];

        connection.query(sql, filter, (err, results) => {
            if (err) return res.status(500).json({ message: "error occured" + err });

            if (results.length) {
                const token = jwt.sign({ username, password }, private, { expiresIn: "12h" });

                console.log(logs(req).ok);
                
                return res.status(200).json({ message: "success", token: token });
            } else {
                console.error(logs(req).err);
                
                return res.status(404).json({ message: "user was not found..." });
            }

        });
        
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error" + error });
    }
});

authRouter.post("/register", async (req, res) => {
    const { english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, groups } = await req.body;

    try {
        const sql = "INSERT INTO users (english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, groups) VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        connection.query(sql, [english_first_name, english_last_name, korean_first_name, korean_last_name, username, password, groups], (err, results) => {
            if (err) console.log(err);

            console.log(logs(req).ok);
            
            return res.status(200).json({message: "success", data: results});
        });


    } catch (err) {
        console.error(logs(req).err);        
        
        return res.status(500).json({message: "server error " + err});
    }

});


module.exports = authRouter;
