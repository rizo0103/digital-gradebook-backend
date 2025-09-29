const express = require('express');
const router = require('./routes');
const cors = require('cors');
const { ip } = require('./configs.js');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(router);

app.listen(PORT, ip, () => {
    console.log(`Server running on http://${ip}:${PORT}`);
});
