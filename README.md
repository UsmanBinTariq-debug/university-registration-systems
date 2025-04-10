# University Registration System

The **University Registration System** is a web-based application designed to manage course registrations for students and administrators. It provides features for students to register for courses, view schedules, and manage prerequisites, while administrators can manage courses, view student registrations, and generate reports.

---

## Features

### **Student Features**
- **Login**: Students can log in using their roll number.
- **View Dashboard**: Access a personalized dashboard to:
  - View available courses.
  - Filter courses by department, time, days, and available seats.
  - Register for courses and add them to a weekly calendar.
  - View unmet prerequisites for courses.
  - Highlight scheduling conflicts in real-time.
- **View Registered Courses**: See a list of registered courses with detailed information.
- **Real-Time Seat Updates**: Receive real-time updates on seat availability using WebSocket.

### **Admin Features**
- **Login**: Admins can log in using their username and password.
- **Manage Courses**:
  - Add new courses with details like code, title, department, schedule, seats, and prerequisites.
  - Edit or update existing courses.
  - Adjust seat availability dynamically.
- **Manage Student Registrations**:
  - View all students and their registered courses.
  - Remove student registrations.
- **Generate Reports**:
  - Download course reports in CSV or PDF format.

---

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB](https://www.mongodb.com/) (running locally or on a server)

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/university-registration-systems.git
   cd university-registration-systems
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the environment variables:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```properties
     PORT=3000
     SESSION_SECRET=your_secret_key
     ```

4. Seed the database:
   ```bash
   npm run seed
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

6. Open the application in your browser:
   ```
   http://localhost:3000
   ```

---

## Project Structure

```
university-registration-systems/
├── config/
│   └── db.js               # MongoDB connection configuration
├── models/
│   ├── Admin.js            # Admin schema
│   ├── Course.js           # Course schema
│   └── Student.js          # Student schema
├── public/
│   ├── css/
│   │   └── styles.css      # Global styles
│   └── js/
│       └── app.js          # Client-side JavaScript
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── course.js           # Course-related routes
│   └── index.js            # Index routes
├── views/
│   ├── admin-dashboard.ejs # Admin dashboard page
│   ├── admin-login.ejs     # Admin login page
│   ├── student-dashboard.ejs # Student dashboard page
│   └── student-login.ejs   # Student login page
├── .env                    # Environment variables
├── package.json            # Project metadata and dependencies
├── seed.js                 # Database seeding script
└── server.js               # Main server file
```

---

## Usage

### **Admin Login**
1. Navigate to `/auth/admin/login`.
2. Use the seeded admin credentials:
   - Username: `admin`
   - Password: `password123`

### **Student Login**
1. Navigate to `/auth/student/login`.
2. Use one of the seeded student roll numbers:
   - Roll Number: `12345`
   - Roll Number: `67890`
   - Roll Number: `22f3662`

---

## API Endpoints

### **Authentication**
- `POST /auth/student/login`: Student login.
- `POST /auth/admin/login`: Admin login.
- `POST /auth/logout`: Logout.

### **Courses**
- `GET /course/courses`: Fetch all courses with optional filters.
- `POST /course/courses`: Add a new course (Admin only).
- `PUT /course/courses/:code`: Edit an existing course (Admin only).
- `POST /course/courses/:code/schedule`: Register a course for a student.
- `PUT /course/courses/:code/seats`: Adjust seats for a course (Admin only).
- `GET /course/courses/report/csv`: Generate a CSV report of courses.
- `GET /course/courses/report/pdf`: Generate a PDF report of courses.

### **Student Registrations**
- `GET /course/students/registrations`: Fetch all students and their registered courses (Admin only).
- `DELETE /course/students/:id/registrations`: Remove a student's registration (Admin only).

---

## Technologies Used

- **Backend**: Node.js, Express.js
- **Frontend**: EJS, HTML, CSS, JavaScript
- **Database**: MongoDB
- **Real-Time Communication**: Socket.io
- **PDF Generation**: PDFKit
- **CSV Generation**: json2csv

---

## Screenshots

### **Student Dashboard**
![Student Dashboard](https://via.placeholder.com/800x400?text=Student+Dashboard)

### **Admin Dashboard**
![Admin Dashboard](https://via.placeholder.com/800x400?text=Admin+Dashboard)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

---

## Contact

For any inquiries or issues, please contact:
- **Email**: tariqusman664@gmail.com
- **GitHub**: [UsmanBinTariq-debug](https://github.com/UsmanBinTariq-debug/university-registration-systems)