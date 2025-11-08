const express = require('express');
const connection = require('./db');
const jwt = require("jsonwebtoken");
const { private } = require("./configs");
const { logs } = require('./utils/common');
const authRouter = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');
const groupRouter = require('./routes/groupRoutes');

const router = express.Router();

router.use(userRouter);
router.use(authRouter);
router.use(groupRouter);

router.get("/", (req, res) => {
    console.log(logs(req).ok);

    return res.send("Hello, Rizo!");
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

router.get("/get-all-groups", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
        const decoded = jwt.verify(token, private);
        const username = decoded && decoded.username;

        if (!username) {
            console.error(logs(req).err);

            return res.status(400).json({ message: "invalid token" });
        }

        // Use promise-based queries so we can await results in sequence
        const [users] = await connection.promise().query("SELECT * FROM users WHERE username = ?", [username]);
        const user = users && users[0];

        if (!user) {
            console.error(logs(req).err);
            
            return res.status(404).json({ message: "user not found" });
        }

        if (user.status === "teacher") {
            const [groups] = await connection.promise().query("SELECT * FROM groups WHERE teacher = ?", [username]);
            
            console.log(logs(req).ok);
            
            return res.status(200).json({ message: "success", data: groups });
        } else if (user.status === "admin") {
            const [groups] = await connection.promise().query("SELECT * FROM groups");
            
            console.log(logs(req).ok);
            
            return res.status(200).json({ message: "success", data: groups });
        } else {
            console.error(logs(req).err);
            
            return res.status(403).json({ message: "forbidden" });
        }

    } catch (error) {
        console.error(logs(req).err);
        
        return res.status(500).json({ message: "server error" + error });
    }
});

router.post('/create-timeslot', async(req, res) => {
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

module.exports = router;
