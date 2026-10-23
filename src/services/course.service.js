// service to handle course-related operations

const Course = require("../models/Course");

// FIX (BUG-027): escape user input before using it inside a RegExp so that
// characters like ( or * are treated as plain text (no regex injection/ReDoS).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCourses = async (query) => {
  const {
    page = 1,
    limit = 8,
    search = "",
    sort = "",
    category,
    tags,
  } = query;

  // Validate and sanitize pagination parameters
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 8)); // Max 100 items per page

  const filter = {};

  if (search && typeof search === "string") {
    filter.$or = [
      { title: { $regex: escapeRegex(search.trim()), $options: "i" } },
      { instructorName: { $regex: escapeRegex(search.trim()), $options: "i" } },
    ];
  }

  if (category && typeof category === "string") {
    filter.category = category;
  }

  if (tags && typeof tags === "string") {
    const tagArray = tags.split(",").map(t => t.trim()).filter(t => t); // "mern,react"
    if (tagArray.length > 0) {
      filter.tags = { $in: tagArray };
    }
  }

  // FIX (BUG-036): always sort in a stable order (newest first by default),
  // so pagination never repeats or skips courses between pages.
  let sortObj = { createdAt: -1, _id: -1 };
  if (sort === "price_asc") sortObj = { price: 1, _id: 1 };
  if (sort === "price_desc") sortObj = { price: -1, _id: 1 };

  const skip = (pageNum - 1) * limitNum;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      // FIX (BUG-009): never send quiz answers in the public course list
      .select("-syllabus.lessons.quiz.correctIndex")
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  return {
    courses,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

const getCourseById = async (id) => {
  // FIX (BUG-016): reject malformed ids before they reach Mongoose, so the
  // client gets a clean message instead of an internal CastError text.
  if (!/^[0-9a-fA-F]{24}$/.test(String(id))) {
    throw new Error("Invalid course id");
  }
  const course = await Course.findById(id);
  if (!course) throw new Error("Course not found");
  return course;
};

module.exports = { getCourses, getCourseById };