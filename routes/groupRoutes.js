const express = require('express');
const connection = require('../db');
const jwt = require("jsonwebtoken");
const multer = require('multer');
const { private } = require("../configs");
const { logs, getUserFromToken, modifyDays } = require('../utils/common');

const groupRouter = express.Router();
const upload = multer({
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB limit
});

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

        // check if there is a table for the groups
        const [tables] = await connection.promise().query("SHOW TABLES LIKE 'groups'");

        if (tables.length === 0) {
            // create table if not exists
            await connection.promise().query("CREATE TABLE groups (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), amount INT, days JSON, teacher VARCHAR(255), students JSON NULL)");
            console.log("Groups table created");
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
            filter.push(`${user.korean_last_name} ${user.korean_first_name}`);
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
        if (user.status !== "admin" && user.status !== "teacher") {
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

groupRouter.post("/upload-students", async (req, res) => {
    try {
        const raw = req.body;

        if (!raw) {
            return res.status(400).json({ message: "No students provided" });
        }

        const students = raw;

        await Promise.all(students.map(async student => {
            const group = student.student_group;
            const sql = `
                UPDATE groups
                SET students = JSON_ARRAY_APPEND(
                    COALESCE(students, JSON_ARRAY()),
                    '$',
                    CAST(? AS JSON)
                )
                WHERE name = ?
            `;

            const payload = {
                student_id: student.id,
                korean_last_name: student.last_name_kr,
                korean_first_name: student.name_kr,
                english_last_name: student.last_name_en,
                english_first_name: student.name_en,
                attendance: {}
            };

            await connection.promise().query(sql, [JSON.stringify(payload), group]);
        }));

        console.log(logs(req).ok);

        return res.status(200).json({ message: "processed", count: students.length });
    } catch (error) {
        console.error(logs(req).err);
        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.post("/attendance", async (req, res) => {
    const { payload } = req.body;
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
        const user = await getUserFromToken(token, jwt, private, connection);
        if (!user) {
            console.error(logs(req).err, "unauthorized");
         
            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin or teacher status
        if (user.status !== "admin" && user.status !== "teacher") {
            console.error(logs(req).err, "forbidden");
         
            return res.status(403).json({ message: "forbidden" });
        }

        // process attendance
        if (payload && payload.attendance.length > 0) {
            const studentsSql = "SELECT * FROM groups WHERE id = ?";
            const [groupResults] = await connection.promise().query(studentsSql, [payload.groupId]),
                students = groupResults[0].students;

            // update attendance for each student
            const attendance = payload.attendance;

            for (let i = 0; i < attendance.length; ++i) {
                for (let j = 0; j < students.length; ++j) {
                    if (attendance[i].studentId === students[j].student_id) {
                        if (students[j].attendance[payload.year] === undefined) {
                            students[j].attendance[payload.year] = {};
                        }
                        if (students[j].attendance[payload.year][payload.month] === undefined) {
                            students[j].attendance[payload.year][payload.month] = {};
                        }

                        students[j].attendance[payload.year][payload.month] = attendance[i].days;
                        break;
                    }
                }
            }

            const updateSql = "UPDATE groups SET students = ? WHERE id = ?";
            await connection.promise().query(updateSql, [JSON.stringify(payload.attendance), payload.groupId]);
        
            console.log(logs(req).ok);

            return res.status(200).json({ message: "attendance updated" });
        }
        else {
            console.error(logs(req).err, "no attendance data");
            return res.status(400).json({ message: "no attendance data" });
        }
    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.delete("/drop-database", async (req, res) => {
    // Delete all db except users table
    const { token } = req.headers;

    try {
        const user = await getUserFromToken(token, jwt, private, connection);

        if (!user) {
            console.error(logs(req), " unauthorized");
            return res.status(401).json({ message: "unauthorized" });
        }
        
        if (user.status !== "admin") {
            console.error(logs(req), " forbidden");
            return res.status(403).json({ message: "forbidden" });
        }
        
        // 1. Get table names
        let [tables] = await connection.promise().query("SHOW TABLES");
        
        // Extract the key dynamically (e.g. Tables_in_electronic-gradebook)
        const tableKey = Object.keys(tables[0])[0];
        
        // 2. Create array of table names except "users"
        const tablesToDelete = tables
            .map(row => row[tableKey])
            .filter(name => name !== "users");
        
        await connection.promise().query("SET FOREIGN_KEY_CHECKS = 0");
        
        // 3. Drop each table
        for (const tableName of tablesToDelete) {
            await connection.promise().query(`DROP TABLE IF EXISTS \`${tableName}\``);
            console.log(`Dropped table: ${tableName}`);
        }
        
        await connection.promise().query("SET FOREIGN_KEY_CHECKS = 1");
        
        console.log("All tables cleared except: users");
        
        return res.status(200).json({ message: "kenchana :)" });
        
        } catch (error) {
        console.error(logs(req).err, " server error");

        return res.status(500).json({ message: "server error " + error });
    }
});

module.exports = groupRouter;
