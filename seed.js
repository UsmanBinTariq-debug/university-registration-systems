const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Student = require('./models/Student');
const Course = require('./models/Course');
const Admin = require('./models/Admin');

const seedData = async () => {
    try {
        await connectDB();

        // Clear existing data
        await Student.deleteMany();
        await Course.deleteMany();
        await Admin.deleteMany();

        // Seed students
        const students = [
            { rollNumber: '12345', name: 'John Doe', registeredCourses: [], completedPrerequisites: [] },
            { rollNumber: '67890', name: 'Jane Smith', registeredCourses: [], completedPrerequisites: [] },
            { rollNumber: '22f3662', name: 'Usman Bin Tariq', registeredCourses: [], completedPrerequisites: [] }
        ];
        await Student.insertMany(students);

        // Seed courses
        const courses = [
            {
                code: 'CS101',
                title: 'Introduction to Computer Science',
                department: 'CS',
                level: 1,
                schedule: { days: ['Monday', 'Wednesday'], startTime: '10:00', endTime: '11:30' },
                seats: 30,
                prerequisites: []
            },
            {
                code: 'CS102',
                title: 'Data Structures',
                department: 'CS',
                level: 2,
                schedule: { days: ['Tuesday', 'Thursday'], startTime: '12:00', endTime: '13:30' },
                seats: 25,
                prerequisites: ['CS101']
            }
        ];
        await Course.insertMany(courses);

        // Seed admin
        const admin = new Admin({
            username: 'admin',
            password: 'password123' // Will be hashed by the pre-save hook
        });
        await admin.save();

        console.log('Database seeded successfully!');
        process.exit();
    } catch (err) {
        console.error('Error seeding database:', err);
        process.exit(1);
    }
};

seedData();
