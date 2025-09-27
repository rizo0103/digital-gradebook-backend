const express = require('express');
const connection = require('./db');
const jwt = require("jsonwebtoken");
const { private } = require("./configs");

const router = express.Router();

router.get("/", (req, res) => {
    return res.send("Hello, Rizo!");
});


router.post("/login", (req, res) => {
    const { username, password } = req.body;

    try {
        const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
        const filter = [username, password];

        connection.query(sql, filter, (err, results) => {
            if (err) return res.status(500).json({ message: "error occured" + err });

            if (results.length) {
                const token = jwt.sign({ username, password }, private);
                return res.status(200).json({ message: "success", data: token });
            } else {
                return res.status(404).json({ message: "user was not found..." });
            }

        });
        
    } catch (error) {
        return res.status(500).json({ message: "server error" + error });
    }
});

router.get("/get-user-data", (req, res) => {
    const { token } = req.headers;

    try {
        let username = "", password = "";

        jwt.verify(token, private, (err, decoded) => {
            if (err) {
                return res.status(400).json({ message: err });
            }
            
            username = decoded.username;
            password = decoded.password;
        });

        if (!username || !password) {
            return res.status(400).json({ message: "invalid token" });
        }

        const sql = `SELECT * FROM users WHERE username = ? AND password = ?`;
        const filter = [username, password];
        
        connection.query(sql, filter, (err, results) => {
            if (err) return res.status(500).json({ message: "DB error" + err });

            if (results.length) {
                return res.status(200).json({ message: "success", data: results });
            } else {
                return res.status(404).json({ message: "user data was not found" });
            }
        });

    } catch (error) {
        return res.status(500).json({ message: "server error" + error });
    }
});

router.post("/register", async (req, res) => {
    const { firstName, lastName, username, password, groups } = await req.body;

    try {
        const sql = "INSERT INTO users (first_name, last_name, username, password, groups) VALUES (?, ?, ?, ?, ?)";
        
        connection.query(sql, [firstName, lastName, username, password, groups], (err, results) => {
            if (err) console.log(err);
            console.log(results);

            return res.status(200).json({message: "success", data: results});
        });


    } catch (err) {
        return res.status(500).json({message: "server error " + err});
    }

});

module.exports = router;
