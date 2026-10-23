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

  const course = await Course.findById(enrollment.course);
  if (!course) throw new Error("Course not found");

  // FIX (BUG-006): accept only lesson ids that really belong to this course.
  const validLessonIds = course.syllabus.flatMap((mod) =>
    mod.lessons.map((lesson) => String(lesson._id))
  );
  if (!lessonId || !validLessonIds.includes(String(lessonId))) {
    throw new Error("Lesson does not belong to this course");
  }

  // avoid duplicates
  const alreadyDone = enrollment.progress.completedLessons
    .map(String)
    .includes(String(lessonId));

  if (!alreadyDone) {
    enrollment.progress.completedLessons.push(lessonId);
  }

  // calculate percent (never more than 100)
  const totalLessons = validLessonIds.length;
  const completed = enrollment.progress.completedLessons.length;
  enrollment.progress.percent =
    totalLessons === 0
      ? 0
      : Math.min(100, Math.round((completed / totalLessons) * 100));

  // FIX (BUG-004): await the save so the response is sent only after the
  // data is persisted, and so any save error reaches the controller's catch
  // instead of becoming an unhandled promise rejection.
  await enrollment.save();
  return enrollment;
};

module.exports = { enrollCourse, getMyEnrollments, completeLesson };