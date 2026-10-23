const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");

const enrollCourse = async (studentId, courseId, batchId = null) => {
  const course = await Course.findById(courseId);
  if (!course) throw new Error("Course not found");

  // Check if already enrolled
  let enrollment = await Enrollment.findOne({
    student: studentId,
    course: courseId,
  });

  // FIX (BUG-001): the condition was inverted. Throw only when the student
  // IS already enrolled, otherwise continue and create the enrollment.
  if (enrollment) {
    throw new Error("Already enrolled in this course");
  }

  // Create new enrollment
  enrollment = await Enrollment.create({
    student: studentId,
    course: courseId,
    batchId,
    progress: { completedLessons: [], percent: 0 },
  });

  return enrollment;
};

const getMyEnrollments = async (studentId) => {
  return Enrollment.find({ student: studentId })
    .populate("course", "title instructorName price category tags")
    .sort({ createdAt: -1 });
};

const completeLesson = async (enrollId, lessonId, studentId) => {
  // FIX (BUG-005): only look up enrollments that belong to the logged-in
  // student, so one user cannot modify another user's progress.
  const enrollment = await Enrollment.findOne({
    _id: enrollId,
    student: studentId,
  });
  if (!enrollment) throw new Error("Enrollment not found");

  // avoid duplicates
  const alreadyDone = enrollment.progress.completedLessons
    .map(String)
    .includes(String(lessonId));

  if (!alreadyDone) {
    enrollment.progress.completedLessons.push(lessonId);
  }

  // calculate percent
  const course = await Course.findById(enrollment.course);
  const totalLessons = course.syllabus.reduce(
    (sum, mod) => sum + mod.lessons.length,
    0
  );

  const completed = enrollment.progress.completedLessons.length;
  enrollment.progress.percent =
    totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100);

  // FIX (BUG-004): await the save so the response is sent only after the
  // data is persisted, and so any save error reaches the controller's catch
  // instead of becoming an unhandled promise rejection.
  await enrollment.save();
  return enrollment;
};

module.exports = { enrollCourse, getMyEnrollments, completeLesson };