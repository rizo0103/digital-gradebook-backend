const express = require('express');
const connectToCloudSQL = require('../db');
const jwt = require("jsonwebtoken");
const multer = require('multer');
const { private } = require("../configs");
const { logs, getUserFromToken, modifyDays } = require('../utils/common');

const studentsRouter = express.Router();
studentsRouter.use(express.json());

const upload = multer({
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB limit
});

studentsRouter.post("/upload-students", upload.single("file"), async (req, res) => {
    try {
        const pool = await connectToCloudSQL;
        const jsonString = req.file.buffer.toString("utf8");
        const students = JSON.parse(jsonString);
        const { token } = req.headers;

        if (!Array.isArray(students)) {
            return res.status(400).json({ message: "Invalid JSON format" });
        }

        if (!token) {
            return res.status(400).json({ message: "no token provided" });
        }

        // verify token
        const user = await getUserFromToken(token, jwt, private);
        if (!user || user.status !== "admin") {
            return res.status(403).json({ message: "forbidden" });
        }

        // ensure table exists
        const [tables] = await pool.execute("SHOW TABLES LIKE 'students'");

        if (tables.length === 0) {
            await pool.execute(`
                CREATE TABLE students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    english_first_name VARCHAR(255),
                    english_last_name VARCHAR(255),
                    korean_first_name VARCHAR(255),
                    korean_last_name VARCHAR(255),
                    phone_number VARCHAR(255),
                    email VARCHAR(255),
                    student_id INT,
                    start_date DATE,
                    end_date DATE NULL
                )
            `);
        }

        const sql = `
            INSERT INTO group_students 
            (english_first_name, english_last_name, korean_first_name, korean_last_name, phone_number, email, student_id, start_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const student of students[2].data) {
            await pool.execute(sql, [
                student.name_en,
                student.last_name_en,
                student.name_kr,
                student.last_name_kr,
                student.phone,
                student.email,
                Number(student.id),
                student.created_at.split(" ")[0], // date only
            ]);
        }

        return res.status(200).json({ message: "Students uploaded!" });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ message: "server error " + error });
    }
});

groupRouter.get("/get-students", async (req, res) => {
    const { token } = req.headers;

    try {
        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req).err, " unauthorized");
        
            return res.status(401).json({ message: "unauthorized" })
        };

        // 2. check teacher/admin
        if (user.status !== "admin" && user.status !== "teacher") {
            console.error(logs(req).err, " forbidden");

            return res.status(403).json({ message: "forbidden" });
        }

        const [ students ] = await pool.execute("SELECT * FROM `group_students`");

        // 3. validate data
        if (!students || students.length === 0) {
            console.error(logs(req).err, " no students");
        
            return res.status(400).json({ message: "no students" });
        }

        return res.status(200).json({ message: "success", data: students });
    } catch (error) {
        console.error(error);

        return res.status(500).json({ message: "server error" });
    }
});

groupRouter.get('/export-attendance-matrix/:groupId', async (req, res) => {
    const groupId = req.params.groupId;
    const { year, month, group_name } = req.query;
    const monthNumber = parseInt(month, 10);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const ExcelJS = require("exceljs");

    try {
        const pool = await connectToCloudSQL;
        // 1. Get group students
        const [students] = await pool.execute(
            `SELECT id, student_name_english, student_name_korean
             FROM group_students
             WHERE group_name = ?
             ORDER BY student_name_english`,
            [group_name]
        );

        // 2. Get attendance for this month
        const [attendance] = await pool.execute(
            `SELECT student_id, date, status
             FROM attendance
             WHERE group_name = ?
             AND YEAR(date) = ?
             AND MONTH(date) = ?`,
            [group_name, year, monthNumber]
        );

        // 3. Build attendance map and collect unique dates
        const attendanceMap = {};
        const uniqueDates = new Set();

        attendance.forEach(item => {
            const dateOnly = item.date instanceof Date ? new Date(new Date(item.date).getTime() + (5 * 60 * 60 * 1000)).toISOString().split("T")[0].split("-")[2] : item.date;
            attendanceMap[`${dateOnly}_${item.student_id}`] = item.status;
            uniqueDates.add(dateOnly);
        });

        // 4. Sort dates ascending
        const sortedDates = Array.from(uniqueDates).sort();

        // 5. Prepare Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Attendance");
        sheet.addRow([group_name])
        sheet.addRow([months[month - 1]]);

        // 6. Header row: Student + sorted dates
        const headerRow = ["Student", ...sortedDates];
        sheet.addRow(headerRow);

        const convert = (s) => s === "present" ? "" : s === "absent" ? "x" : s === "late" ? "△" : "";

        // 7. Rows for each student
        students.forEach(student => {
            const rowData = [student.student_name_english];

            // 1. Формируем данные строки
            sortedDates.forEach(date => {
                rowData.push(convert(attendanceMap[`${date}_${student.id}`]));
            });

            // 2. Добавляем строку в Excel
            const row = sheet.addRow(rowData);

            // 3. Раскрашиваем ячейки по статусу
            sortedDates.forEach((date, idx) => {
                const status = attendanceMap[`${date}_${student.id}`];
                const cell = row.getCell(idx + 2); // +2, потому что 1-й столбец — Student

                if (status === "absent") {
                    // Светло-красный фон
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFC7CE' } // мягкий красный
                    };
                }

                if (status === "late") {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFFFCC' } // мягкий желтый
                    };
                }

                if (status === "present") {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFD9EAD3' } // мягкий зеленый
                    };
                }
            });
        });


        // 8. Set headers for download
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        const fileName = `attendance_${group_name}_${year}_${month}.xlsx`;
        res.setHeader(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        );

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "server error" });
    }
});

module.exports = studentsRouter;
