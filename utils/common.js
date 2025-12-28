const connectToCloudSQL = require("../db");

const logs = (req) => {
    return {
        ok: req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " okay :)",
        err: req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " not okay -_-",
        info: (message) => req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " " + message,
    }
};

const getUserFromToken = async (token, jwt, private) => {
    try {
        const pool = await connectToCloudSQL;
        const decoded = jwt.verify(token, private);
        const username = decoded && decoded.username;
        const password = decoded && decoded.password;

        const [users] = await pool.execute("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);

        if (users.length) {
            return users[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error decoding token: " + error);
        
        return error;
    }
}

const modifyDays = (timeslot) => {
    const modifiedDays = timeslot.map(day => {
        let year = `${day}`.substring(0, 4),
            month = `${day}`.substring(4, 6),
            date = `${day}`.substring(6, 8);

        return `${year}-${month}-${date}`;
    }), months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const finalDays = {};
        
    modifiedDays.map(day => {
        let dateObj = new Date(day);
        let year = dateObj.getFullYear();
        let month = months[dateObj.getMonth()];

        finalDays[year] = finalDays[year] || {};
        finalDays[year][month] = finalDays[month] || [];
    });

        
    modifiedDays.map(day => {
        let dateObj = new Date(day);
        let year = dateObj.getFullYear();
        let month = months[dateObj.getMonth()];
        let date = dateObj.getDate();
        
        finalDays[year][month].push(date);
    });

    return finalDays;
};

module.exports = { logs, getUserFromToken, modifyDays };