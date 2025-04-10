const express = require('express');
const Course = require('../models/Course');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const router = express.Router();

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

    query['schedule.startTime'] = { $exists: true, $ne: null };
    query['schedule.endTime'] = { $exists: true, $ne: null };

    try {
        const courses = await Course.find(query);
        res.status(200).json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

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

router.post('/courses/:code/schedule', async (req, res) => {
    const { code } = req.params;
    const { days, startTime, endTime } = req.body;

    console.log('Received schedule data:', { code, days, startTime, endTime });

    try {
        const course = await Course.findOne({ code });
        if (!course) {
            console.error(`Course not found: ${code}`);
            return res.status(404).json({ message: 'Course not found' });
        }

        const normalizedDays = Array.isArray(days) ? days : [days];

        if (!normalizedDays || !startTime || !endTime) {
            console.error(`Missing required schedule data for course: ${code}`);
            console.log('Request body:', req.body); 
            return res.status(400).json({ message: 'Missing required schedule data' });
        }

        course.schedule = { days: normalizedDays, startTime, endTime };
        course.seats -= 1;
        await course.save();

        if (req.session.user && req.session.user.role === 'student') {
            const studentId = req.session.user.id;
            const Student = require('../models/Student');
            const student = await Student.findById(studentId);

            if (!student) {
                console.error(`Student not found: ${studentId}`);
                return res.status(404).json({ message: 'Student not found' });
            }

            if (!student.registeredCourses.includes(code)) {
                student.registeredCourses.push(code);
                await student.save();
                console.log(`Course ${code} registered for student ${student.rollNumber}`);
            }
        }

        const io = req.app.get('socketio');
        io.emit('seatUpdate', { code: course.code, seats: course.seats });

        console.log(`Course schedule updated successfully: ${code}`);
        res.status(200).json({ message: 'Schedule updated successfully', course });
    } catch (err) {
        console.error(`Server error while updating schedule for course: ${code}`, err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

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
            res.status(400).send('Course with this code already exists. <a href="/admin/dashboard">Go back</a>');
        } else {
            res.status(500).send('Server error occurred. <a href="/admin/dashboard">Go back</a>');
        }
    }
});

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

router.post('/courses/:code/override', async (req, res) => {
    const { code } = req.params;
    const { studentRollNumber } = req.body;
    try {
        const course = await Course.findOne({ code });
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json({ message: `Registration overridden for student ${studentRollNumber}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/courses/:code/seats', async (req, res) => {
    const { code } = req.params;
    const { seats } = req.body; // Seats adjustment value (e.g., -1 for decrease, +1 for increase)
    try {
        const course = await Course.findOne({ code });
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const newSeatCount = course.seats + seats;
        if (newSeatCount < 0) {
            return res.status(400).json({ message: 'No seats available' });
        }
        course.seats = newSeatCount;
        await course.save();

        const io = req.app.get('socketio');
        io.emit('seatUpdate', { code: course.code, seats: course.seats });

        res.status(200).json({ message: 'Seats adjusted successfully', course });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

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

router.get('/registered-courses', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'student') {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const student = await require('../models/Student').findById(req.session.user.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const courses = await Course.find({ code: { $in: student.registeredCourses } });
        res.status(200).json(courses);
    } catch (err) {
        console.error('Failed to fetch registered courses:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

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

router.delete('/students/:id/registrations', async (req, res) => {
    try {
        const { id } = req.params;
        const { courseCode } = req.body;

        const Student = require('../models/Student');
        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (courseCode) {
            student.registeredCourses = student.registeredCourses.filter(code => code !== courseCode);
        } else {
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
