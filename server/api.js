const fs = require("fs");
const { initializeDatabase, queryDB, insertDB } = require("./database");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const rateLimit = require('express-rate-limit');
let db;

const SECRET_KEY = process.env.SECRET_KEY || "your_super_secret_key";

// Log user actions
const logActivity = (message) => {
  const logEntry = `[${new Date().toISOString()}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFile("user-activity_logs.txt", logEntry, (err) => {
    if (err) console.error("Error writing to user-activity_logs.txt:", err);
  });
};

// Log server errors
const logError = (message) => {
  const logEntry = `[${new Date().toISOString()}] ERROR: ${message}\n`;
  console.error(logEntry.trim());
  fs.appendFile("server_logs.txt", logEntry, (err) => {
    if (err) console.error("Error writing to server_logs.txt:", err);
  });
};

// Rate limiter for login attempts
const visitLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { error: 'Too Many Requests. Try again later.' },
});

// Initialize API with app routes
const initializeAPI = async (app) => {
  try {
    db = await initializeDatabase();
  } catch (error) {
    logError("DB initialization failed: " + error.message);
  }

  app.post("/api/login", visitLimit, login);
  app.get("/api/feed", authenticateToken, getFeed);
  app.post("/api/feed", authenticateToken, postTweet);
};

// Handle login and token generation
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await queryDB(db, `SELECT * FROM users WHERE username = ?`, [username]);
    if (user.length === 1 && await bcrypt.compare(password, user[0].password)) {
      const token = jwt.sign({ userId: user[0].id, username: user[0].username }, SECRET_KEY, { expiresIn: '1h' });
      logActivity(`Login successful for: ${username}`);
      return res.json({ token, username: user[0].username });
    }

    logActivity(`Failed login for: ${username}`);
    res.status(401).json({ message: "Invalid credentials" });

  } catch (error) {
    logError(`Login error for ${username}: ${error.message}`);
    res.status(500).json({ message: "Login error" });
  }
};

// JWT token authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      logError("Token verification failed: " + err.message);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// Fetch tweets
const getFeed = async (req, res) => {
  const query = req.query.q || '';
  const sqlQuery = query ? `SELECT * FROM tweets WHERE text LIKE ? ORDER BY id DESC` : "SELECT * FROM tweets ORDER BY id DESC";

  try {
    const tweets = await queryDB(db, sqlQuery, query ? [`%${query}%`] : []);
    logActivity(`User ${req.user.username} fetched tweets`);
    res.json(tweets);
  } catch (error) {
    logError(`Failed to fetch tweets for ${req.user.username}: ${error.message}`);
    res.status(500).json({ message: "Error fetching tweets" });
  }
};

// Post a new tweet
const postTweet = async (req, res) => {
  const { text } = req.body;
  const { username } = req.user;
  const timestamp = new Date().toISOString();

  try {
    await queryDB(db, "INSERT INTO tweets (username, timestamp, text) VALUES (?, ?, ?)", [username, timestamp, text]);
    logActivity(`User ${username} posted a tweet: "${text}"`);
    res.status(201).json({ message: "Tweet posted successfully" });
  } catch (error) {
    logError(`Failed to post tweet for ${username}: ${error.message}`);
    res.status(500).json({ message: "Error posting tweet" });
  }
};

module.exports = { initializeAPI };
