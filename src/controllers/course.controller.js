// controller for course-related routes

const courseService = require("../services/course.service");

const getCourses = async (req, res) => {
  try {
    // FIX (BUG-046): the DB connection is already ensured by the middleware
    // in app.js, so the duplicate connectDB() call was removed.
    const data = await courseService.getCourses(req.query);
    res.json(data);
  } catch (err) {
    console.error("Get courses error:", err.message);
    res.status(400).json({ message: err.message || "Failed to fetch courses" });
  }
};

const getCourseById = async (req, res) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    res.json(course);
  } catch (err) {
    // FIX (BUG-016): a malformed id is a client error (400), not "not found"
    const status = err.message === "Invalid course id" ? 400 : 404;
    res.status(status).json({ message: err.message });
  }
};

module.exports = { getCourses, getCourseById };