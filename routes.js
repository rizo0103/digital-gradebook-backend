const express = require('express');
const connection = require('./db');
const jwt = require("jsonwebtoken");
const { private } = require("./configs");
const { logs } = require('./utils/common');
const authRouter = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');
const groupRouter = require('./routes/groupRoutes');
const studentsRouter = require('./routes/studentsRoutes');
const mobileGroupRouter = require('./routes/mobile/groupRoutes');

const router = express.Router();

router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));
router.use(userRouter);
router.use(authRouter);
router.use(groupRouter);
router.use(studentsRouter);
router.use(mobileGroupRouter);

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

module.exports = router;
