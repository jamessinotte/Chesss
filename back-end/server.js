require('dotenv').config(); // load env vars from .env into process.env
const express = require('express');
const http = require('http');
const cors = require('cors');
const { connectDB } = require('./src/config/db');

// route files
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const gameRoutes = require('./src/routes/gameRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const friendRoutes = require('./src/routes/friendRoutes');
const datasetRoutes = require('./src/routes/datasetRoutes');

const initSockets = require('./src/socket'); // socket.io setup

const app = express();
const server = http.createServer(app); // needed so sockets and express share the same server

// CORS so frontend can call backend (origin can be set in env)
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));

// parse JSON request bodies
app.use(express.json());

// connect to the database on startup
connectDB();

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/datasets', datasetRoutes);

// attach socket handlers to the same HTTP server
initSockets(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

