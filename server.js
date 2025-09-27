const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
    return res.send("Hello, World!");
});

app.get("/hello/:name", (req, res) => {
    return res.send(`Hello, ${req.params.name}`);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
