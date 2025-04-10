const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { title: 'University Registration System' });
});

router.get('/student/login', (req, res) => {
    res.render('student-login');
});

router.get('/admin/login', (req, res) => {
    res.render('admin-login');
});

router.get('/student/dashboard', (req, res) => {
    if (req.session.user && req.session.user.role === 'student') {
        res.render('student-dashboard');
    } else {
        res.redirect('/student/login');
    }
});

router.get('/admin/dashboard', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        res.render('admin-dashboard');
    } else {
        res.redirect('/admin/login');
    }
});

router.get('/simulate', async (req, res) => {
    const io = req.app.get('socketio');

    const student = await require('../models/Student').findOne({ rollNumber: '12345' });
    if (!student) {
        return res.status(404).send('Student not found');
    }
    req.session.user = { id: student._id, role: 'student' };
    console.log('Student logged in:', student.name);

    const filteredCourses = await require('../models/Course').find({ department: 'CS', seats: { $gte: 1 } });
    console.log('Filtered courses:', filteredCourses.map(course => course.title));

    const courseToAdd = filteredCourses[0];
    if (courseToAdd) {
        student.registeredCourses.push(courseToAdd.code);
        await student.save();
        console.log('Added course:', courseToAdd.title);

        io.emit('seatUpdate', { code: courseToAdd.code, seats: courseToAdd.seats - 1 });
    }

    const courseToRemove = student.registeredCourses.pop();
    if (courseToRemove) {
        await student.save();
        console.log('Removed course:', courseToRemove);
    }

    const unmetPrerequisites = courseToAdd.prerequisites.filter(prerequisite => !student.completedPrerequisites.includes(prerequisite));
    if (unmetPrerequisites.length > 0) {
        console.log('Unmet prerequisites for', courseToAdd.title, ':', unmetPrerequisites);
    } else {
        console.log('All prerequisites met for', courseToAdd.title);
    }

    const registeredCourses = await require('../models/Course').find({ code: { $in: student.registeredCourses } });
    const overlaps = [];
    for (let i = 0; i < registeredCourses.length; i++) {
        for (let j = i + 1; j < registeredCourses.length; j++) {
            const courseA = registeredCourses[i];
            const courseB = registeredCourses[j];
            if (courseA.schedule.days.some(day => courseB.schedule.days.includes(day))) {
                const startA = new Date(`1970-01-01T${courseA.schedule.startTime}`);
                const endA = new Date(`1970-01-01T${courseA.schedule.endTime}`);
                const startB = new Date(`1970-01-01T${courseB.schedule.startTime}`);
                const endB = new Date(`1970-01-01T${courseB.schedule.endTime}`);
                if (startA < endB && startB < endA) {
                    overlaps.push([courseA.title, courseB.title]);
                }
            }
        }
    }
    if (overlaps.length > 0) {
        console.log('Conflicts detected:', overlaps);
    } else {
        console.log('No conflicts detected');
    }

    res.send('Simulation complete. Check server logs for details.');
});

router.get('/simulate-admin', async (req, res) => {
    const io = req.app.get('socketio');

    const Course = require('../models/Course');
    const newCourse = new Course({
        code: 'CS101',
        title: 'Introduction to Computer Science',
        department: 'CS',
        level: 1,
        schedule: {
            days: ['Monday', 'Wednesday'],
            startTime: '10:00',
            endTime: '11:30'
        },
        seats: 30,
        prerequisites: []
    });
    await newCourse.save();
    console.log('Added course:', newCourse.title);

    const Student = require('../models/Student');
    const student = await Student.findOne({ rollNumber: '12345' });
    if (student) {
        student.registeredCourses.push(newCourse.code);
        await student.save();
        console.log('Overridden registration for student:', student.rollNumber);
    } else {
        console.log('Student not found for overriding registration');
    }

    newCourse.seats = 25;
    await newCourse.save();
    io.emit('seatUpdate', { code: newCourse.code, seats: newCourse.seats });
    console.log('Adjusted seats for course:', newCourse.title);

    const courses = await Course.find();
    const students = await Student.find();
    console.log('Generated course report:', courses.map(course => course.title));
    console.log('Generated student report:', students.map(student => student.rollNumber));

    res.send('Admin simulation complete. Check server logs for details.');
});

module.exports = router;
