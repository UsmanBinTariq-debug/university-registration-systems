const express = require('express');
const Course = require('../models/Course');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const router = express.Router();

// Fetch all courses with optional filters
router.get('/courses', async (req, res) => {
    const { department, time, days, seats } = req.query;
    const query = {};

    if (department) query.department = department;
    if (days) query['schedule.days'] = days;
    if (time) {
        query['schedule.startTime'] = { $lte: time };
        query['schedule.endTime'] = { $gte: time };
    }
    if (seats) query.seats = { $gte: parseInt(seats, 10) };

    // Only fetch courses with valid schedules
    query['schedule.startTime'] = { $exists: true, $ne: null };
    query['schedule.endTime'] = { $exists: true, $ne: null };

    try {
        const courses = await Course.find(query);
        res.status(200).json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Check seat availability for a course
router.get('/courses/:code/seats', async (req, res) => {
    const { code } = req.params;
    try {
        const course = await Course.findOne({ code });
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json({ seats: course.seats });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Manage course schedules (real-time updates via WebSocket)
router.post('/courses/:code/schedule', async (req, res) => {
    const { code } = req.params;
    const { days, startTime, endTime } = req.body;

    // Log the received data for debugging
    console.log('Received schedule data:', { code, days, startTime, endTime });

    try {
        const course = await Course.findOne({ code });
        if (!course) {
            console.error(`Course not found: ${code}`);
            return res.status(404).json({ message: 'Course not found' });
        }

        // Ensure `days` is an array
        const normalizedDays = Array.isArray(days) ? days : [days];

        // Simplified validation: Ensure required fields are present
        if (!normalizedDays || !startTime || !endTime) {
            console.error(`Missing required schedule data for course: ${code}`);
            console.log('Request body:', req.body); // Log the full request body for debugging
            return res.status(400).json({ message: 'Missing required schedule data' });
        }

        // Update the course schedule and decrement the seat count
        course.schedule = { days: normalizedDays, startTime, endTime };
        course.seats -= 1;
        await course.save();

        // Associate the course with the logged-in student
        if (req.session.user && req.session.user.role === 'student') {
            const studentId = req.session.user.id;
            const Student = require('../models/Student');
            const student = await Student.findById(studentId);

            if (!student) {
                console.error(`Student not found: ${studentId}`);
                return res.status(404).json({ message: 'Student not found' });
            }

            // Add the course to the student's registeredCourses array if not already added
            if (!student.registeredCourses.includes(code)) {
                student.registeredCourses.push(code);
                await student.save();
                console.log(`Course ${code} registered for student ${student.rollNumber}`);
            }
        }

        // Emit seat update to all connected clients
        const io = req.app.get('socketio');
        io.emit('seatUpdate', { code: course.code, seats: course.seats });

        console.log(`Course schedule updated successfully: ${code}`);
        res.status(200).json({ message: 'Schedule updated successfully', course });
    } catch (err) {
        console.error(`Server error while updating schedule for course: ${code}`, err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Add a new course
router.post('/courses', async (req, res) => {
    const { code, title, department, level, schedule, seats, prerequisites } = req.body;
    try {
        if (!schedule || !schedule.startTime || !schedule.endTime) {
            return res.status(400).json({ message: 'Start time and end time are required' });
        }
        const newCourse = new Course({ code, title, department, level, schedule, seats, prerequisites });
        await newCourse.save();
        res.redirect('/admin/dashboard'); // Redirect to admin dashboard after success
    } catch (err) {
        if (err.code === 11000) {
            // Handle duplicate key error
            res.status(400).send('Course with this code already exists. <a href="/admin/dashboard">Go back</a>');
        } else {
            res.status(500).send('Server error occurred. <a href="/admin/dashboard">Go back</a>');
        }
    }
});

// Edit an existing course
router.put('/courses/:code', async (req, res) => {
    const { code } = req.params;
    const updates = req.body;
    try {
        const updatedCourse = await Course.findOneAndUpdate({ code }, updates, { new: true });
        if (!updatedCourse) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json({ message: 'Course updated successfully', course: updatedCourse });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Override course registrations
router.post('/courses/:code/override', async (req, res) => {
    const { code } = req.params;
    const { studentRollNumber } = req.body;
    try {
        const course = await Course.findOne({ code });
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        // Logic to override registration (e.g., bypass prerequisites or seat limits)
        res.status(200).json({ message: `Registration overridden for student ${studentRollNumber}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Adjust seats for a course
router.put('/courses/:code/seats', async (req, res) => {
    const { code } = req.params;
    const { seats } = req.body; // Seats adjustment value (e.g., -1 for decrease, +1 for increase)
    try {
        const course = await Course.findOne({ code });
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Update the seat count
        const newSeatCount = course.seats + seats;
        if (newSeatCount < 0) {
            return res.status(400).json({ message: 'No seats available' });
        }
        course.seats = newSeatCount;
        await course.save();

        // Emit seat update to all connected clients
        const io = req.app.get('socketio');
        io.emit('seatUpdate', { code: course.code, seats: course.seats });

        res.status(200).json({ message: 'Seats adjusted successfully', course });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Generate reports (CSV)
router.get('/courses/report/csv', async (req, res) => {
    try {
        const courses = await Course.find();
        const fields = ['code', 'title', 'department', 'level', 'seats'];
        const parser = new Parser({ fields });
        const csv = parser.parse(courses);
        res.header('Content-Type', 'text/csv');
        res.attachment('courses_report.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Generate reports (PDF)
router.get('/courses/report/pdf', async (req, res) => {
    try {
        const courses = await Course.find();
        const doc = new PDFDocument();
        res.header('Content-Type', 'application/pdf');
        res.attachment('courses_report.pdf');
        doc.pipe(res);
        doc.fontSize(16).text('Courses Report', { align: 'center' });
        courses.forEach(course => {
            doc.fontSize(12).text(`Code: ${course.code}, Title: ${course.title}, Department: ${course.department}, Level: ${course.level}, Seats: ${course.seats}`);
        });
        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Fetch registered courses for the logged-in student
router.get('/registered-courses', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'student') {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const student = await require('../models/Student').findById(req.session.user.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Fetch detailed course information
        const courses = await Course.find({ code: { $in: student.registeredCourses } });
        res.status(200).json(courses);
    } catch (err) {
        console.error('Failed to fetch registered courses:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Fetch courses with unmet prerequisites for a student
router.get('/courses/unmet-prerequisites', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'student') {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const student = await require('../models/Student').findById(req.session.user.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const unmetCourses = await Course.find({
            prerequisites: { $elemMatch: { $nin: student.completedPrerequisites } }
        });

        res.status(200).json(unmetCourses);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Fetch all students and their registered courses
router.get('/students/registrations', async (req, res) => {
    try {
        const Student = require('../models/Student');
        const students = await Student.find().populate('registeredCourses');
        res.status(200).json(students);
    } catch (err) {
        console.error('Failed to fetch student registrations:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Remove a student's registration
router.delete('/students/:id/registrations', async (req, res) => {
    try {
        const { id } = req.params;
        const { courseCode } = req.body; // Optional: Specify the course to remove

        const Student = require('../models/Student');
        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Remove the course from the student's registeredCourses array
        if (courseCode) {
            student.registeredCourses = student.registeredCourses.filter(code => code !== courseCode);
        } else {
            // If no courseCode is provided, clear all registrations
            student.registeredCourses = [];
        }

        await student.save();
        res.status(200).json({ message: 'Student registration removed successfully' });
    } catch (err) {
        console.error('Failed to remove student registration:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
