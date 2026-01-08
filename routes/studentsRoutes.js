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

studentsRouter.post("/create-student", async(req, res) => {
    const { name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, email, phone, groups } = req.body;
    const { token } = req.headers;

    if (!token) {
        console.error(logs(req).err, " No token provided");
        return res.status(401).json({ message: "no token provided" });
    }
    
    try {
        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

        if (!user || user.status !== "admin") {
            console.error(logs(req).err, " forbidden user");
            return res.status(403).json({ message: "forbidden user" });
        }

        const [tables] = await pool.execute("SHOW TABLES LIKE 'students'");

        if (tables.length === 0) {
            await pool.execute(`
                CREATE TABLE students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name_tj VARCHAR(255),
                    last_name_tj VARCHAR(255),
                    name_en VARCHAR(255),
                    last_name_en VARCHAR(255),
                    name_kr VARCHAR(255),
                    last_name_kr VARCHAR(255),
                    phone VARCHAR(255),
                    email VARCHAR(255),
                    start_date DATE,
                    end_date DATE NULL
                )
            `);
        }

        const sql = `
            INSERT INTO students 
            (name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, phone, email, start_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, startDate = new Date().toISOString().slice(0, 10);
        
        const [result] = await pool.execute(sql, [name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, phone, email, startDate]);

        
        const [groupStudentsTable] = await pool.execute("SHOW TABLES LIKE 'group_students'");
        
        if (groupStudentsTable.length === 0) {
            await pool.execute(`
                CREATE TABLE \`group_students\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_id INT NOT NULL,
                    student_id INT NOT NULL,
                    group_name VARCHAR(255),
                    student_name_en VARCHAR(255),
                    student_name_kr VARCHAR(255),
                    student_name_tj VARCHAR(255)
                )
            `);
        }

        const insertGroupStudentSQL = `
        INSERT INTO group_students (group_id, student_id, group_name, student_name_en, student_name_kr, student_name_tj)
        VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        for (const group of groups) {
            const [group_result] = await pool.execute(insertGroupStudentSQL, [
                group.id, 
                result.insertId, 
                group.name,
                `${last_name_en} ${name_en}`, 
                `${last_name_kr} ${name_kr}`,
                `${last_name_tj} ${name_tj}`
            ]);

            
            if (group_result.affectedRows === 0) {
                console.error(logs(req).err, " Failed to create group student");
            }
        }

        console.log(logs(req).ok, `Created student with id ${result.insertId}`);
        
        return res.status(201).json({ message: "Student created", studentId: result.insertId });
    } catch (error) {
        console.error(logs(req).err, "SERVER ERROR", error);
        return res.status(500).json({ error: "SERVER ERROR" + error });
    }
});

studentsRouter.post("/upload-students", upload.single("file"), async (req, res) => {
    try {
        const pool = await connectToCloudSQL;
        const jsonString = req.file.buffer.toString("utf8");
        const studentsData = JSON.parse(jsonString);
        const { token } = req.headers;

        if (!token) {
            console.error(logs(req).err, "No token provided");
            return res.status(400).json({ message: "no token provided" });
        }

        const user = await getUserFromToken(token, jwt, private);
        if (!user || user.status !== "admin") {
            console.error(logs(req).err, `Forbidden: user ${user.username} is not an admin`);
            return res.status(403).json({ message: "forbidden" });
        }

        const getStudentsArray = (data) => {
            if (Array.isArray(data)) {
                if (data.length > 2 && data[2] && Array.isArray(data[2].data)) {
                    return data[2].data;
                }
                return data;
            }
            if (data && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        };

        const students = getStudentsArray(studentsData);

        if (students.length === 0) {
            console.error(logs(req).err, "No student data found in the uploaded file");
            return res.status(400).json({ message: "No student data found in the uploaded file" });
        }

        const [tables] = await pool.execute("SHOW TABLES LIKE 'students'");
        if (tables.length === 0) {
            console.log(logs(req).info, "Creating 'students' table");
            await pool.execute(`
                CREATE TABLE students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name_tj VARCHAR(255),
                    last_name_tj VARCHAR(255),
                    name_en VARCHAR(255),
                    last_name_en VARCHAR(255),
                    name_kr VARCHAR(255),
                    last_name_kr VARCHAR(255),
                    phone VARCHAR(255),
                    email VARCHAR(255),
                    start_date DATE,
                    end_date DATE NULL
                )
            `);
        }

        const insertStudentSQL = `
            INSERT INTO students
            (name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, phone, email, start_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const findGroupSQL = "SELECT id FROM `groups` WHERE name = ?";
        const [groupStudentsTable] = await pool.execute("SHOW TABLES LIKE 'group_students'");

        if (groupStudentsTable.length === 0) {
            console.log(logs(req).info, "Creating 'group_students' table");
            await pool.execute(`
                CREATE TABLE \`group_students\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_id INT NOT NULL,
                    student_id INT NOT NULL,
                    group_name VARCHAR(255),
                    student_name_en VARCHAR(255),
                    student_name_kr VARCHAR(255),
                    student_name_tj VARCHAR(255)
                )
            `);
        }
        
        const insertGroupStudentSQL = `
            INSERT INTO group_students (group_id, student_id, group_name, student_name_en, student_name_kr, student_name_tj)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        console.log(logs(req).info, `Processing ${students.length} students`);

        for (const student of students) {
            const [groupRows] = await pool.execute(findGroupSQL, [student.student_group]);

            
            let startDate = null;
            try {
                if (student.created_at) {
                    startDate = new Date(student.created_at.split(" ")[0]).toISOString().slice(0, 10);
                }
            } catch (e) {
                console.warn(logs(req).info, `Invalid date format for student ${student.name_en || ''}: ${student.created_at}`);
            }
            
            const [result] = await pool.execute(insertStudentSQL, [
                student.name_tj,
                student.last_name_tj,
                student.name_en,
                student.last_name_en,
                student.name_kr,
                student.last_name_kr,
                student.phone,
                student.email,
                startDate,
            ]);

            const studentId = result.insertId;
            if (groupRows.length === 0) {
                console.warn(logs(req).info, `Group not found: ${student.student_group}`);
                continue;
            }
            const groupId = groupRows[0].id;
            
            await pool.execute(insertGroupStudentSQL, [
                groupId, 
                studentId, 
                student.student_group, 
                `${student.last_name_en} ${student.name_en}`, 
                `${student.last_name_kr} ${student.name_kr}`, 
                `${student.last_name_tj} ${student.name_tj}`
            ]);
        }

        console.log(logs(req).ok, "Uploaded students successfully");
        return res.status(200).json({ message: "Students uploaded!" });

    } catch (error) {
        console.error(logs(req).err, "Server Error:", error);
        return res.status(500).json({ message: "server error " + error });
    }
});

studentsRouter.get("/get-students", async (req, res) => {
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

        let [ students ] = await pool.execute("SHOW TABLES LIKE 'students'");

        // 3. validate data
        if (students.length === 0) {
            console.error(logs(req).err, " no students");
        
            return res.status(400).json({ message: "no students" });
        }

        [students] = await pool.execute("SELECT * FROM students");

        return res.status(200).json({ message: "success", data: students });
    } catch (error) {
        console.error(error);

        return res.status(500).json({ message: "server error" });
    }
});

studentsRouter.get('/export-attendance-matrix/:groupId', async (req, res) => {
    const groupId = req.params.groupId;
    const { year, month, group_name } = req.query;
    const monthNumber = parseInt(month, 10);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const ExcelJS = require("exceljs");

    try {
        const pool = await connectToCloudSQL;
        // 1. Get group students
        const [students] = await pool.execute(
            `SELECT id, student_name_en, student_name_kr
             FROM group_students
             WHERE group_name = ?
             ORDER BY student_name_en`,
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
        sheet.addRow([group_name]);
        sheet.addRow([year ,months[month - 1]]);

        // 6. Header row: Student + sorted dates
        const headerRow = ["Student / Day", ...sortedDates];
        sheet.addRow(headerRow);

        const convert = (s) => s === "present" ? "" : s === "absent" ? "x" : s === "late" ? "△" : "";

        // 7. Rows for each student
        students.forEach(student => {
            const rowData = [student.student_name_en];

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

        sheet.addRow(["Total Students: " + students.length]);
        sheet.addRow(["x: absent, △: late, '': present" ]);
        sheet.addRow(["Generated on: " + new Date().toLocaleString()]);

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

studentsRouter.get("/get-student-groups/:id", async (req, res) => {
    const { token } = req.headers;
    const { id } = req.params;

    if (!token) {
        console.error(logs(req).err, " No token provided");
        return ;
    }

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

        const sql = `SELECT * FROM group_students WHERE student_id = ?`;
        const [results] = await pool.execute(sql, [id]);

        if (results.length === 0) {
            console.error(logs(req).err, " no data found");
            return res.status(404).json({ message: "no data found" });
        }

        const group_type_sql = `SELECT group_type FROM \`groups\` WHERE id = ?`;
        
        const promises = results.map(async (result) => {
            const [group_types] = await pool.execute(group_type_sql, [result.group_id]);
            if (group_types.length > 0) {
                result.group_type = group_types[0].group_type;
            }
            return result;
        });

        const data = await Promise.all(promises);
        
        console.log(logs(req).ok, " successfuly get data from `group_students`");
        return res.status(200).json({ message: "success", data: data});
    } catch (error) {
        console.error(logs(req).err, " server error " + error);
        return res.status(500).json({ message: "server error " + error });
    }
});

studentsRouter.post("/update-student", async (req, res) => {
    const { token } = req.headers;
    const { name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, groups, email, phone, id } = req.body;

    try {
        if (!token) {
            console.error(logs(req).err, " no token provided");
        }

        const pool = await connectToCloudSQL;
        const user = await getUserFromToken(token, jwt, private);

        if (!user) {
            console.error(logs(req).err, " unauthorized");
            return res.status(401).json({ message: "unauthorized" });
        }

        if (user.status !== "teacher" && user.status !== "admin") {
            console.error(logs(req).err, " forbidden");
            return res.status(403).json({ message: "forbidden" });
        }

        const update_sql = `UPDATE students SET name_tj = ?, last_name_tj = ?, name_en = ?, last_name_en = ?, name_kr = ?, last_name_kr = ?, email = ?, phone = ? WHERE id = ?`;
        const [result] = await pool.execute(update_sql, [name_tj, last_name_tj, name_en, last_name_en, name_kr, last_name_kr, email, phone, id]);

        if (result.affectedRows === 0) {
            console.error(logs(req).err, " no data updated");
            return res.status(404).json({ message: "no data updated" });
        }

        const get_student_groups_sql = `SELECT * FROM \`group_students\` WHERE student_id = ?`;
        const [student_groups] = await pool.execute(get_student_groups_sql, [id]);

        // delete group if groups are not in studenr_groups
        const groupsToDelete = [];
        for (let i = 0; i < student_groups.length; ++i) {
            let flag = false;
            for (let j = 0; j < groups.length; ++j) {
                if (student_groups[i].group_id === groups[j].id) {
                    flag = true;
                    break;
                }
            }
            if (!flag) {
                groupsToDelete.push(student_groups[i].group_id);
            }
        }

        if (groupsToDelete.length !== 0) {
            const delete_student_groups_sql = `DELETE FROM \`group_students\` WHERE student_id = ? AND group_id = ?`;
            
            for (const group of groupsToDelete) {
                await pool.execute(delete_student_groups_sql, [id, group]);
            }
            console.log(logs(req).ok, " successfully deleted student groups");
        }

        const insert_student_groups_sql = `INSERT INTO \`group_students\` (group_id, student_id, group_name, student_name_en, student_name_kr, student_name_tj) VALUES (?, ?, ?, ?, ?, ?)`;
        const groupsToAdd = [];

        for (let i = 0; i < groups.length; ++i) {
            let flag = false;
            for (let j = 0; j < student_groups.length; ++j) {
                if (student_groups[j].group_id === groups[i].id) {
                    flag = true;
                    break;
                }
            }
            if (!flag) {
                groupsToAdd.push(groups[i]);
            }
        }

        if (groupsToAdd.length !== 0) {
            for (const group of groupsToAdd) {
                await pool.execute(insert_student_groups_sql, [group.id, id, group.name, `${last_name_en} ${name_en}`, `${last_name_kr} ${name_kr}`, `${last_name_tj} ${name_tj}`]);
            }
            console.log(logs(req).ok, " successfully added student groups");
        }

        console.log(logs(req).ok, " successfully updated student");

        return res.status(200).json({ message: "successfully updated student" });
    } catch (error) {
        console.error(logs(req).err, " server error " + error);
        return res.status(500).json({ message: " server error" + error });
    }
});

module.exports = studentsRouter;
