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

module.exports = mobileGroupRouter;
