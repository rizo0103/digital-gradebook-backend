const express = require('express');
const connectToCloudSQL = require('../db');
const jwt = require("jsonwebtoken");
const multer = require('multer');
const { private } = require("../configs");
const { logs, getUserFromToken, modifyDays } = require('../utils/common');

const groupRouter = express.Router();

groupRouter.get("/get-timeslots", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

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
        const [results] = await pool.query(sql);

        console.log(logs(req).ok);
        if (results.length === 0) {
            return res.status(404).json({ message: "no timeslots found" });
        }
        
        return res.status(200).json({ message: "success", data: results });

    } catch (error) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.post("/create-group", async (req, res) => {
    const { name, level, time, teacher_name, schedule } = req.body;
    const { token } = req.headers;

    if (!token) {
        return res.status(400).json({ message: "no token provided" });
    }

    try {
        const pool = await connectToCloudSQL;  // FIXED
        const user = await getUserFromToken(token, jwt, private);

        if (!user) return res.status(401).json({ message: "unauthorized" });
        if (user.status !== "admin") return res.status(403).json({ message: "forbidden" });

        const [tables] = await pool.execute("SHOW TABLES LIKE 'groups'");
        if (tables.length === 0) {
            await pool.execute(`
                CREATE TABLE \`groups\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255),
                    level VARCHAR(255),
                    teacher_id INT,
                    teacher_name VARCHAR(255),
                    schedule VARCHAR(255),
                    time VARCHAR(255)
                )
            `);
        }

        const parts = teacher_name.trim().split(" ");
        if (parts.length < 3) {
            return res.status(400).json({ message: "Invalid teacher_name format" });
        }

        const teacher_id = parts[0];
        const teacherName = parts.slice(1).join(" ");

        const sql = `
            INSERT INTO \`groups\` 
            (name, level, time, teacher_id, teacher_name, schedule)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.execute(sql, [
            name,
            level,
            time,
            teacher_id,
            teacherName,
            schedule
        ]);

        console.log(logs(req).ok);
        return res.status(200).json({ message: "group created", data: result });

    } catch (error) {
        console.error("server error:", error);
        return res.status(500).json({ message: "server error " + error });
    }
});


groupRouter.get("/get-groups", async (req, res) => {
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req).err, " unauthorized");

            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin or teacher status
        if (user.status !== "admin" && user.status !== "teacher") {
            console.error(logs(req).err, " forbidden");

            return res.status(403).json({ message: "forbidden" });
        }

        // get groups
        let sql = "SELECT * FROM `groups`",
            filter = [];

        if (user.status === "teacher") {
            sql = "SELECT * FROM `groups` WHERE teacher_id = ?";
            filter.push(user.id);
        }

        const [results] = await pool.execute(sql, filter);

        console.log(logs(req).ok, " groups retrieved");
        return res.status(200).json({ message: "success", data: results });
    } catch (error) {
        console.error(logs(req).err, " server error");

        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.get("/get-group-data/:id", async (req, res) => {
    const { id } = req.params;
    const { token } = req.headers;

    try {
        // verify token (throws if invalid)
        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req).err, " unauthorized");

            return res.status(401).json({ message: "unauthorized" });
        }

        // verify admin status
        if (user.status !== "admin" && user.status !== "teacher") {
            console.error(logs(req).err, " forbidden");

            return res.status(403).json({ message: "forbidden" });
        }

        let sql = "SELECT * FROM `groups` WHERE id = ?",
            [results] = await pool.execute(sql, [id]);

        if (results.length === 0) {
            console.error(logs(req).err, " group not found");

            return res.status(404).json({ message: "group was not found" });
        }

        console.log(logs(req).ok);

        const group_name = results[0].name,
            timeslot_name = results[0].schedule,
            students_sql = `SELECT * FROM group_students WHERE group_name = ?`,
            timeslot_sql = `SELECT * FROM timeslots WHERE name = ?`,
            attendance_sql = `SELECT * FROM attendance WHERE group_name = ?`;

        const [group_students] = await pool.execute(students_sql, [group_name]),
            [timeslot] = await pool.execute(timeslot_sql, [timeslot_name]);

        if (group_students.length === 0) {
            console.log(logs(req).err, " No students in this group");
            return res.status(404).json({ message: "No students in this group" });
        }

        if (timeslot.length === 0) {
            console.log(logs(req).err, " No timeslot with '" + timeslot_name + "' name");
            return res.status(404).json({ message: `No timeslot with '${timeslot_name}' name` });
        }

        let attendance = []; // always initialized

        const [attendance_tables] = await pool.execute("SHOW TABLES LIKE 'attendance'");

        if (attendance_tables.length !== 0) {
            const [rows] = await pool.execute(attendance_sql, [group_name]);

            if (rows.length > 0) {
                rows.forEach(item => item.date = new Date(new Date(item.date).getTime() + (5 * 60 * 60 * 1000)));
                attendance = rows;
            } else {
                console.log(logs(req).ok, " No attendance data for this group");
            }
        } else {
            console.log(logs(req).ok, " No attendance table");
        }

        return res.status(200).json({
            message: "success", data: {
                group_data: results[0],
                group_students: group_students,
                group_schedule: {
                    ...timeslot[0],
                    days: modifyDays(timeslot[0].timeslot),
                },
                group_attendance: attendance,
            }
        });
    } catch (error) {
        console.error(logs(req).err, " server error");

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
        const pool = await connectToCloudSQL;
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
            [results] = await pool.execute(sql, [new_name, new_amount, JSON.stringify(finalDays), id]);

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
        const pool = await connectToCloudSQL;
        const decoded = jwt.verify(token, private);
        const username = decoded && decoded.username;

        timeslot.sort((a, b) => a - b);

        if (!username) {
            console.error(logs(req).err);

            return res.status(400).json({ message: "invalid token" });
        }

        // check if user is admin
        const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
        const user = users && users[0];

        if (!user || user.status !== "admin") {
            console.error(logs(req).err);
            return res.status(403).json({ message: "forbidden" });
        }

        // check if there is table for the timeslots
        const [tables] = await pool.query("SHOW TABLES LIKE 'timeslots'");

        if (tables.length === 0) {
            // create table if not exists
            await pool.query("CREATE TABLE timeslots (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), timeslot JSON)");
            console.log("Timeslots table created");
        }

        const sql = "INSERT INTO timeslots (name, timeslot) VALUES (?, ?)";
        const filter = [name, JSON.stringify(timeslot)];
        await pool.query(sql, filter);

        console.log(logs(req).ok);

        return res.status(200).json({ message: "success" });
    } catch (err) {
        console.error(logs(req).err);

        return res.status(500).json({ message: "server error " + err });
    }
});

groupRouter.post('/save-attendance', async (req, res) => {
    const { records } = req.body;
    const { token } = req.headers;

    try {
        const pool = await connectToCloudSQL;
        // 1. verify token
        const user = await getUserFromToken(token, jwt, private);
        if (!user) return res.status(401).json({ message: "unauthorized" });

        // 2. check teacher/admin
        if (user.status !== "admin" && user.status !== "teacher") {
            return res.status(403).json({ message: "forbidden" });
        }

        // 3. validate data
        if (!records || records.length === 0) {
            return res.status(400).json({ message: "no attendance data" });
        }

        // 4. create table if not exists
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                group_name VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                student_name_english VARCHAR(255),
                student_name_korean VARCHAR(255),
                status ENUM('present', 'absent', 'late') DEFAULT 'present',
                UNIQUE KEY unique_attendance (student_id, group_name, date)
            );
        `);

        // SQL for inserting attendance
        const insertSql = `
            INSERT INTO attendance 
            (student_id, group_name, date, student_name_english, student_name_korean, status) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status)
        `;

        // 5. loop through attendance records
        for (const item of records) {

            // 5.1 get student info from group_students table
            const [studentResult] = await pool.execute(
                `
                SELECT 
                    student_name_english,
                    student_name_korean
                FROM group_students
                WHERE student_id = ? AND group_name = ?
                `,
                [item.student_id, item.group_name]
            );

            if (studentResult.length === 0) {
                console.error("student not found in group_students:", item);
                continue; // skip this record
            }

            const student = studentResult[0];

            // 5.2 insert into attendance
            await pool.execute(insertSql, [
                item.student_id,
                item.group_name,
                item.date,
                student.student_name_english,
                student.student_name_korean,
                item.status
            ]);
        }

        return res.status(200).json({ message: "Success" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "server error" });
    }
});

groupRouter.delete("/drop-database", async (req, res) => {
    // Delete all db except users table
    const { token } = req.headers;

    try {
        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req), " unauthorized");
            return res.status(401).json({ message: "unauthorized" });
        }

        if (user.status !== "admin") {
            console.error(logs(req), " forbidden");
            return res.status(403).json({ message: "forbidden" });
        }

        // 1. Get table names
        let [tables] = await pool.execute("SHOW TABLES");

        // Extract the key dynamically (e.g. Tables_in_electronic-gradebook)
        const tableKey = Object.keys(tables[0])[0];

        // 2. Create array of table names except "users"
        const tablesToDelete = tables
            .map(row => row[tableKey])
            .filter(name => name !== "users");

        await pool.execute("SET FOREIGN_KEY_CHECKS = 0");

        // 3. Drop each table
        for (const tableName of tablesToDelete) {
            await pool.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
            console.log(`Dropped table: ${tableName}`);
        }

        await pool.execute("SET FOREIGN_KEY_CHECKS = 1");

        console.log("All tables cleared except: users");

        return res.status(200).json({ message: "kenchana :)" });

    } catch (error) {
        console.error(logs(req).err, " server error");

        return res.status(500).json({ message: "server error " + error });
    }
});

module.exports = groupRouter;
