// Add your client-side JavaScript here
console.log('Client-side script loaded');

// Function to check for overlapping events
function checkOverlaps(events) {
    const overlaps = [];
    for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
            const eventA = events[i];
            const eventB = events[j];

            // Check if events overlap on the same day
            if (eventA.extendedProps.daysOfWeek.some(day => eventB.extendedProps.daysOfWeek.includes(day))) {
                const startA = new Date(`1970-01-01T${eventA.startStr}`);
                const endA = new Date(`1970-01-01T${eventA.endStr}`);
                const startB = new Date(`1970-01-01T${eventB.startStr}`);
                const endB = new Date(`1970-01-01T${eventB.endStr}`);

                if (startA < endB && startB < endA) {
                    overlaps.push([eventA, eventB]);
                }
            }
        }
    }
    return overlaps;
}

// Highlight overlapping events
function highlightOverlaps(calendar) {
    const events = calendar.getEvents();
    const overlaps = checkOverlaps(events);

    // Reset event colors
    events.forEach(event => {
        event.setProp('backgroundColor', '#3788d8'); // Default color
        event.setProp('borderColor', '#3788d8');
    });

    // Highlight overlapping events
    overlaps.forEach(([eventA, eventB]) => {
        eventA.setProp('backgroundColor', '#ff4d4d'); // Highlight color
        eventA.setProp('borderColor', '#ff4d4d');
        eventB.setProp('backgroundColor', '#ff4d4d');
        eventB.setProp('borderColor', '#ff4d4d');
    });

    // Show conflict alert if overlaps exist
    const conflictAlert = document.getElementById('conflict-alert');
    if (overlaps.length > 0) {
        conflictAlert.style.display = 'block';
    } else {
        conflictAlert.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize FullCalendar
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        editable: true,
        droppable: true, // Allow external drag-and-drop
        themeSystem: 'standard',
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                // Fetch events dynamically from the server
                const response = await fetch('/course/courses');
                const courses = await response.json();
                const events = courses
                    .filter(course => course.schedule.startTime && course.schedule.endTime) // Ensure valid schedule
                    .map(course => ({
                        title: course.title,
                        start: course.schedule.startTime,
                        end: course.schedule.endTime,
                        daysOfWeek: course.schedule.days.map(day => {
                            return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
                        }),
                        extendedProps: { code: course.code }
                    }));
                successCallback(events);
            } catch (err) {
                console.error('Failed to fetch events:', err);
                failureCallback(err);
            }
        },
        eventReceive: async (info) => {
            console.log('Event added:', info.event);

            // Send a request to the server to save the updated time slot and decrement seat count
            const courseCode = info.event.extendedProps.code;
            const startTime = info.event.start.toISOString();
            const endTime = info.event.end ? info.event.end.toISOString() : null;
            try {
                const response = await fetch(`/course/courses/${courseCode}/schedule`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        days: [info.event.start.getDay()],
                        startTime,
                        endTime
                    })
                });
                if (!response.ok) {
                    throw new Error('Failed to save event');
                }
                console.log(`Event saved for course: ${courseCode}`);
            } catch (err) {
                console.error(err);
                // Remove the event from the calendar if the save fails
                info.event.remove();
                alert('Failed to save the course schedule. Please try again.');
            }
        },
        eventOverlap: false,
        eventClick(info) {
            alert(`Course: ${info.event.title}`);
        }
    });
    calendar.render();

    // Real-time seat counter updates
    const socket = io();
    socket.on('seatUpdate', (data) => {
        console.log(`Seat update for course ${data.code}: ${data.seats} seats available`);
        const seatCounter = document.getElementById('seat-counter');
        if (seatCounter) {
            seatCounter.querySelector('span').textContent = data.seats;
        }
    });

    // Populate the list of available courses
    const response = await fetch('/course/courses');
    const courses = await response.json();
    const courseList = document.getElementById('course-list');
    courses.forEach(course => {
        const li = document.createElement('li');
        li.textContent = `${course.title} (${course.code})`;
        li.setAttribute('draggable', 'true');
        li.dataset.code = course.code;
        li.dataset.title = course.title;
        li.dataset.days = JSON.stringify(course.schedule.days);
        li.dataset.startTime = course.schedule.startTime;
        li.dataset.endTime = course.schedule.endTime;

        // Handle drag-and-drop
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                title: course.title,
                start: course.schedule.startTime,
                end: course.schedule.endTime,
                daysOfWeek: course.schedule.days.map(day => {
                    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
                }),
                code: course.code
            }));
        });

        const button = document.createElement('button');
        button.textContent = 'Add to Calendar';
        button.onclick = () => openModal(course.code);
        li.appendChild(button);

        courseList.appendChild(li);
    });

    // Handle Add to Calendar form submission
    const addToCalendarForm = document.getElementById('add-to-calendar-form');
    addToCalendarForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const courseCode = document.getElementById('course-code').value;
        const day = document.getElementById('day').value;
        const startTime = document.getElementById('start-time').value;
        const endTime = document.getElementById('end-time').value;

        // Log the data being sent to the server for debugging
        console.log('Submitting schedule data:', { courseCode, day, startTime, endTime });

        // Validate the schedule data before sending it to the server
        if (!day || !startTime || !endTime) {
            alert('Please fill out all fields in the form.');
            return;
        }

        try {
            const response = await fetch(`/course/courses/${courseCode}/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    days: [parseInt(day, 10)], // Ensure `days` is sent as an array of integers
                    startTime,
                    endTime
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to add course to calendar:', errorData.message);
                throw new Error(errorData.message || 'Failed to add course to calendar');
            }

            // Dynamically add the course to the calendar
            calendar.addEvent({
                title: courses.find(course => course.code === courseCode).title,
                start: `1970-01-01T${startTime}`,
                end: `1970-01-01T${endTime}`,
                daysOfWeek: [parseInt(day, 10)],
                extendedProps: { code: courseCode }
            });

            alert('Course added to calendar successfully!');
            closeModal();
        } catch (err) {
            console.error(err);
            alert(`Failed to add course to calendar. Please try again. Error: ${err.message}`);
        }
    });

    // Highlight overlaps initially
    highlightOverlaps(calendar);
});

// Handle course filters
document.getElementById('filter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const department = document.getElementById('department').value;
    const time = document.getElementById('time').value;
    const days = document.getElementById('days').value;
    const seats = document.getElementById('seats').value;

    // Fetch filtered courses from the server
    const response = await fetch(`/course/courses?department=${department}&time=${time}&days=${days}&seats=${seats}`);
    const courses = await response.json();

    // Update calendar with filtered courses
    calendar.removeAllEvents();
    courses.forEach(course => {
        calendar.addEvent({
            title: course.title,
            start: course.schedule.startTime,
            end: course.schedule.endTime,
            daysOfWeek: course.schedule.days.map(day => {
                // Map day names to FullCalendar day indices
                return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
            })
        });
    });
});

// Handle course filters dynamically
document.getElementById('filter-form').addEventListener('input', async (e) => {
    e.preventDefault();
    const department = document.getElementById('department').value;
    const time = document.getElementById('time').value;
    const days = document.getElementById('days').value;
    const seats = document.getElementById('seats').value;

    // Fetch filtered courses from the server
    const response = await fetch(`/course/courses?department=${department}&time=${time}&days=${days}&seats=${seats}`);
    const courses = await response.json();

    // Update calendar with filtered courses
    const calendarEl = document.getElementById('calendar');
    const calendar = FullCalendar.getCalendar(calendarEl);
    calendar.removeAllEvents();
    courses.forEach(course => {
        calendar.addEvent({
            title: course.title,
            start: course.schedule.startTime,
            end: course.schedule.endTime,
            daysOfWeek: course.schedule.days.map(day => {
                // Map day names to FullCalendar day indices
                return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
            })
        });
    });
});

// Real-time seat counter
setInterval(async () => {
    const response = await fetch('/course/courses');
    const courses = await response.json();
    const totalSeats = courses.reduce((sum, course) => sum + course.seats, 0);
    document.getElementById('seat-counter').querySelector('span').textContent = totalSeats;
}, 5000);

// Prerequisite tooltips
const prerequisiteList = document.getElementById('prerequisite-list');
prerequisiteList.innerHTML = ''; // Clear existing prerequisites
fetch('/course/courses').then(res => res.json()).then(courses => {
    courses.forEach(course => {
        const li = document.createElement('li');
        li.textContent = course.title;
        li.title = `Prerequisites: ${course.prerequisites.join(', ') || 'None'}`;
        prerequisiteList.appendChild(li);
    });
});

// Dependency graph (example using Canvas)
const canvas = document.getElementById('dependencyCanvas');
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'black';
ctx.font = '16px Arial';
ctx.fillText('Dependency Graph Placeholder', 10, 50);
// Add logic to dynamically draw the dependency graph
fetch('/course/courses/unmet-prerequisites')
    .then(res => res.json())
    .then(unmetCourses => {
        unmetCourses.forEach(course => {
            ctx.fillStyle = 'red';
            ctx.fillText(`${course.title} (${course.code})`, 10, 100); // Example positioning
        });
    });

// Connect to WebSocket server
const socket = io();

// Listen for seat updates
socket.on('seatUpdate', (data) => {
    console.log(`Seat update for course ${data.code}: ${data.seats} seats available`);
    // Update the seat counter or UI dynamically
    const seatCounter = document.getElementById('seat-counter');
    if (seatCounter) {
        seatCounter.querySelector('span').textContent = data.seats;
    }
});
