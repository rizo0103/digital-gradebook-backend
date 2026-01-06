const express = require('express');
const connectToCloudSQL = require('../../db');
const jwt = require("jsonwebtoken");
const multer = require('multer');
const { private } = require("../../configs");
const { logs, getUserFromToken, modifyDays } = require('../../utils/common');

const mobileGroupRouter = express.Router();

mobileGroupRouter.get("/mobile/get-groups", async (req, res) => {
    try {
        const pool = await connectToCloudSQL;

        const [group_tables] = await pool.execute("SHOW TABLES LIKE 'groups'");
        
        if (group_tables.length === 0) {
            return res.status(200).json({ groups: [] });
        }

        const [groups] = await pool.execute("SELECT * FROM `groups`");

        return res.status(200).json({ message: "Successfuly got groups", groups });
    } catch (error) {
        console.error();
        return res.status(500).json({ message: "Server error", error });
    }
});

mobileGroupRouter.get("/mobile/get-group-data/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
        
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

module.exports = mobileGroupRouter;
