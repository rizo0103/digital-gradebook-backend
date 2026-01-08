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
                        group_type ENUM('language', 'topik', 'other') NOT NULL,
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

            if (user.status !== "admin" && user.status !== "teacher" && user.status !== "guest") {
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
                    name VARCHAR(255) NOT NULL UNIQUE,
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

groupRouter.get("/get-group-data/:id", async (req, res) => {
    const { token } = req.headers;
    const { id } = req.params;
    
    try {
        const user = await getUserFromToken(token, jwt, private);
        
        if (!user) {
            console.error(logs(req).err, " unauthorized");
            return res.status(401).json({ message: "unauthorized" });
        }
        
        if (user.status !== "admin" && user.status !== "teacher" && user.status !== "guest") {
            console.error(logs(req).err, " forbidden");
            return res.status(403).json({ message: "forbidden" });
        }
        
        const pool = await connectToCloudSQL;
        const [attendanceTable] = await pool.execute("SHOW TABLES LIKE 'attendance'");

        const group_students_sql = `SELECT * FROM group_students WHERE group_id = ?`,
            group_data_sql = `SELECT * FROM \`groups\` WHERE id = ?`,
            group_schedule_sql = `SELECT * FROM timeslots WHERE name = ?`,
            group_attendance_sql = `SELECT * FROM attendance WHERE group_id = ?`;

        let [group_students] = await pool.execute(group_students_sql, [id]),
            [group_data] = await pool.execute(group_data_sql, [id]),
            [group_schedule] = await pool.execute(group_schedule_sql, [group_data[0].schedule]),
            group_attendance;

        if (attendanceTable.length !== 0) {
            [group_attendance] = await pool.execute(group_attendance_sql, [id]);
        } else {
            group_attendance = [];
        }

        if (group_data.length === 0) {
            console.error(logs(req).err, " no group data found");
            return res.status(404).json({ message: "no data found" });
        }

        if (group_students.length === 0) {
            console.error(logs(req).err, " no group students data found");
            return res.status(404).json({ message: "no data found" });
        }

        if (group_schedule.length === 0) {
            console.error(logs(req).err, " no data found");
            return res.status(404).json({ message: "no group schedule data found" });
        }

        if (group_attendance.length === 0) {
            console.error(logs(req).err, " no group attendance data found");
            group_attendance = [];
        }

        console.log(logs(req).ok, " successfuly get data from `group_students`");

        return res.status(200).json({ message: "success", data: { 
            group_students,
            group_data: group_data[0],
            group_schedule: {
                ...group_schedule[0],
                days: modifyDays(JSON.parse(group_schedule[0].timeslot))
            },
            group_attendance
        }});
    } catch (error) {
        console.error(logs(req).err, error);
        return res.status(500).json({ message: "server error" });
    }
});

groupRouter.post("/save-attendance", async (req, res) => {
    // const { student_id, group_id, date, status, group_name } = req.body;
    const { records } = req.body;
    const { token } = req.headers;

    try {
        const user = await getUserFromToken(token, jwt, private);
        const pool = await connectToCloudSQL;

        if (!user) {
            console.error(logs(req).err, " unauthorized");
            return res.status(401).json({ message: "unauthorized" });
        }

        if (user.status !== "admin" && user.status !== "teacher") {
            console.error(logs(req).err, " forbidden");
            return res.status(403).json({ message: "forbidden" });
        }

        const [table] = await pool.execute("SHOW TABLES LIKE 'attendance'");

        if (table.length === 0) {
            await pool.execute(`
                CREATE TABLE \`attendance\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    group_id INT NOT NULL,
                    date DATE NOT NULL,
                    status ENUM('present', 'absent', 'late') NOT NULL,
                    group_name VARCHAR(255) NOT NULL,
                    UNIQUE KEY unique_attendance (student_id, group_name, date)
                )
            `);
        }

        const sql = `
            INSERT INTO attendance (student_id, group_id, date, status, group_name)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status)
        `
        
        for (const record of records) {
            const [result] = await pool.execute(sql, [record.student_id, record.group_id, record.date, record.status, record.group_name]);

            if (result.affectedRows === 0) {
                console.error(logs(req).err, " failed to save attendance");
                return res.status(500).json({ message: "failed to save attendance, student_id: " + record.student_id });
            } else {
                console.log(logs(req).ok, " successfuly saved attendance");
            }
        }

        console.log(logs(req).ok, " successfuly saved attendance");
        return res.status(200).json({ message: "success" });
    } catch (error) {
        console.error(logs(req).err, "server error" + error);
        return res.status(500).json({ message: "server error" })
    }
});

module.exports = groupRouter;
