const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const users = {}; // Simple in-memory user store for authentication

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Passport.js configuration
passport.use(new LocalStrategy((username, password, done) => {
    if (users[username] && users[username].password === password) {
        return done(null, users[username]);
    }
    return done(null, false, { message: 'Incorrect credentials.' });
}));

passport.serializeUser((user, done) => {
    done(null, user.username);
});

passport.deserializeUser((username, done) => {
    done(null, users[username]);
});

// User registration endpoint
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!users[username]) {
        users[username] = { username, password };
        res.send('Registration successful');
    } else {
        res.send('User already exists');
    }
});

// User login endpoint
app.post('/login', passport.authenticate('local'), (req, res) => {
    res.send('Login successful');
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join', (room) => {
        socket.join(room);
        socket.to(room).emit('user joined', socket.id);
    });

    socket.on('offer', (data) => {
        socket.to(data.room).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        socket.to(data.room).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.room).emit('ice-candidate', data.candidate);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
