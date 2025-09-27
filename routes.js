const express = require('express');
const connection = require('./db');
const router = express.Router();

router.get("/", (req, res) => {
    return res.send("Hello, Rizo!");
});

module.exports = router;
