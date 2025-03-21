const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db'); // Updated path for database connection
const http = require('http'); // Required for Socket.io
const { Server } = require('socket.io'); // Import Socket.io

dotenv.config();

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = new Server(server); // Initialize Socket.io

// Middleware
app.set('view engine', 'ejs');
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: true
}));

// Database Connection
connectDB(); // Use the new database connection function

// Routes
app.use('/', require('./routes/index')); // Adjusted path for routes
app.use('/auth', require('./routes/auth')); // Add auth routes
app.use('/course', require('./routes/course')); // Add course routes

// WebSocket for seat updates
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Export io for use in other files
app.set('socketio', io);

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
