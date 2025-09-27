const express = require('express');
const connection = require('./db');
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
            if (err) console.log(err);
            console.log(results);

            return res.status(200).json({ message: "success", data: results });
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
