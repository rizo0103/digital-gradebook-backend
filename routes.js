const express = require('express');
const connection = require('./db');
const jwt = require("jsonwebtoken");
const { private } = require("./configs");

const router = express.Router();

const logs = (req) => {
    return {
        ok: req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " okay :)",
        err: req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " not okay -_-",
    }
}

router.get("/", (req, res) => {
    console.log(logs(req).ok);

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

router.get("/get-user-data", (req, res) => {
    const { token } = req.headers;

    try {
        let username = "", password = "";

        jwt.verify(token, private, (err, decoded) => {
            if (err) {
                console.error(logs(req).err);
                
                return res.status(400).json({ message: err });
            }
            
            username = decoded.username;
            password = decoded.password;
        });

        if (!username || !password) {
            console.error(logs(req).err);            
            
            return res.status(400).json({ message: "invalid token" });
        }

        const sql = `SELECT * FROM users WHERE username = ? AND password = ?`;
        const filter = [username, password];
        
        connection.query(sql, filter, (err, results) => {
            if (err) return res.status(500).json({ message: "DB error" + err });

            if (results.length) {
                console.log(logs(req).ok);
                
                return res.status(200).json({ message: "success", data: results });
            } else {
                console.error(logs(req).err);
                
                return res.status(404).json({ message: "user data was not found" });
            }
        });

    } catch (error) {
        console.error(logs(req).err);        
        
        return res.status(500).json({ message: "server error" + error });
    }
});

router.post("/register", async (req, res) => {
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

router.post("/get-group-data", async(req, res) => {
    const { name } = await req.body;
    
    try {
        const sql = "SELECT * FROM groups WHERE name = ?";

        connection.query(sql, [name], (err, results) => {
            if (err) console.log(err);
            
            console.log(logs(req).ok);
            
            return res.status(200).json({message: "success", data: results});
        });
    } catch (err) {
        console.error(logs(req).err);        
        
        return res.status(500).json({message: "server error " + err});
    }
});

module.exports = router;
