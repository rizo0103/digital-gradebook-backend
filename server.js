const express = require('express');
const router = require('./routes');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(router);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
