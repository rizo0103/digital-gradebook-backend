const logs = (req) => {
    return {
        ok: req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " okay :)",
        err: req.method + " " + req.protocol + "://" + req.ip + " " + req.path + " not okay -_-",
    }
};

const getUserFromToken = async (token, jwt, private, connection) => {
    try {
        const decoded = jwt.verify(token, private);
        const username = decoded && decoded.username;
        const password = decoded && decoded.password;

        const [users] = await connection.promise().query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);

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

module.exports = { logs, getUserFromToken };