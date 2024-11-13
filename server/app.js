// Import necessary modules
const express = require("express");
const http = require("http");
const fs = require("fs");
const { initializeAPI } = require("./api");

// Initialize the express server
const app = express();
app.use(express.json());

// Remove the "X-Powered-By" header for security reasons
app.use((req, res, next) => {
  app.disable("X-Powered-By");
  next();
});

// Middleware for logging requests
const requestLogger = (req, res, next) => {
  const ignoredPaths = [
    '/styles.css', '/scripts/index.js', '/scripts/login.js', 
    '/img/tweet.png', '/api/feed', '/', '/login.html', 
    '/api/login', 'favicon.ico'
  ];

  // Skip logging for specified paths
  if (ignoredPaths.includes(req.path)) {
    return next();
  }

  // Log timestamp, user, HTTP method, URL, and response status code
  const timestamp = new Date().toISOString();
  const user = req.user ? req.user.username : "Unauthenticated User";
  const logMessage = `[${timestamp}] User: ${user}, Method: ${req.method}, URL: ${req.originalUrl}, Status: ${res.statusCode}\n`;

  console.log(logMessage.trim());

  // Append log to file
  fs.appendFile("server_logs.txt", logMessage, (err) => {
    if (err) {
      console.error("Failed to write log:", err);
    }
  });

  next();
};

// Apply logging middleware
app.use(requestLogger);

// Serve static files from the "client" directory
app.use(express.static("client"));

// Routes for the homepage and login page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/client/index.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/client/login.html");
});

// Initialize API routes
initializeAPI(app);

// Global error-handling middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const errorLog = `[${timestamp}] Error: ${err.message}\n`;

  console.error(errorLog.trim());

  // Append error to server_logs.txt
  fs.appendFile("server_logs.txt", errorLog, (fileErr) => {
    if (fileErr) {
      console.error("Failed to write error log:", fileErr);
    }
  });

  // Send a generic error response
  res.status(500).json({ message: "An internal server error occurred." });
});

// Start the server
const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log(`Server running on port ${port}`);
});
