const express = require('express');
const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

const router = express.Router();

// Student Login
router.post('/student/login', async (req, res) => {
    const { rollNumber } = req.body;
    try {
        const student = await Student.findOne({ rollNumber });
        if (!student) {
            return res.status(401).json({ message: 'Invalid roll number' });
        }
        req.session.user = { id: student._id, role: 'student' };
        res.redirect('/student/dashboard'); // Redirect to student dashboard
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin Login
router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        req.session.user = { id: admin._id, role: 'admin' };
        res.redirect('/admin/dashboard'); // Redirect to admin dashboard
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed', error: err.message });
        }
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

module.exports = router;
