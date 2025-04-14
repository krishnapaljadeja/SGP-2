const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const QuizTitle = require("./models/title");
const jwt = require("jsonwebtoken");
const Question = require("./models/question");
const title = require("./models/title");
const collection = require("./models/user");
const transporter = require("./otp");
const verifyToken = require("./middlewares/authmiddleware");
const trackActivity = require("./middlewares/activityMiddleware");
const dotenv = require("dotenv").config();
const bcrypt = require("bcrypt");
const QuizResult = require("./models/quizResult");
const moment = require("moment");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 5000;

const tempUserStore = new Map(); // Temporary store for user details
const otpStore = new Map();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.use(trackActivity);

////////////////////////////////////////////////////////////////////////////////////////

// app.get("/home", (req, res) => {
//     res.render("home");

app.use("/assets", express.static(__dirname + "/assets"));

// });

// Home Route
app.get("/", (req, res) => {
  res.render("landing");
});

//logout route
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// Signup Route (GET)
app.get("/signup", (req, res) => {
  res.render("signup");
});

// OTP Route (GET)
app.get("/otp", (req, res) => {
  res.render("otp");
});

// Signup Route (POST)
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await collection.findOne({ name: username });
    const existingEmail = await collection.findOne({ email });

    if (existingUser || existingEmail) {
      return res.send(
        `<script>alert("User already exists."); window.location.href = "/";</script>`
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 2 * 60 * 1000 });
    tempUserStore.set(email, { username, email, password });

    const mailOptions = {
      from: "digitalworld2511@gmail.com",
      to: email,
      subject: "Your OTP for Signup",
      text: `Your OTP for signup is: ${otp}. It expires in 2 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    res.redirect("/otp");
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send("Error during signup");
  }
});

// OTP Verification Route
app.post("/otp", async (req, res) => {
  try {
    const { otp } = req.body;
    let emailFound = null;
    for (const [email, otpData] of otpStore.entries()) {
      if (otpData.otp === otp && Date.now() <= otpData.expiresAt) {
        emailFound = email;
        break;
      }
    }

    if (!emailFound) {
      return res.status(400).send("Invalid or expired OTP.");
    }

    const tempUser = tempUserStore.get(emailFound);
    if (!tempUser) {
      return res
        .status(400)
        .send("User data not found. Please restart signup.");
    }

    const hashedPassword = await bcrypt.hash(tempUser.password, 10);
    const newUser = new collection({
      name: tempUser.username,
      password: hashedPassword,
      email: tempUser.email,
      role: "student",
    });
    await newUser.save();

    otpStore.delete(emailFound);
    tempUserStore.delete(emailFound);

    res.send(
      `<script>alert("Signup successful! You can now log in."); window.location.href = "/";</script>`
    );
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send("Error verifying OTP");
  }
});

// Login Route (GET)
app.get("/login", (req, res) => {
  res.render("login");
});

// Login Route (POST)
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await collection.findOne({
      $or: [{ name: username }, { email: username }],
    });

    if (!user) {
      return res.send(
        `<script>alert("User not found"); window.location.href = "/login";</script>`
      );
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (isPasswordMatch) {
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
          name: user.name,
          email: user.email,
        },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        { expiresIn: "24h" }
      );

      // Set cookie with proper options
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Send token in response for localStorage
      res.send(`
        <script>
          localStorage.setItem('token', '${token}');
          window.location.href = '${
            user.role === "admin" ? "/admin-dashboard" : "/student-dashboard"
          }';
        </script>
      `);
    } else {
      res.send(
        `<script>alert("Wrong username or password"); window.location.href = "/login";</script>`
      );
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Login error");
  }
});

// Forgot Password Routes
app.get("/forgot", (req, res) => {
  res.render("forgot");
});

// Forgot (POST)
app.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await collection.findOne({ email });

    if (!user) {
      return res.send("User not exist");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 2 * 60 * 1000 });

    const mailOptions = {
      from: "quizify54@gmail.com",
      to: email,
      subject: "Your OTP for Reset Password",
      text: `Your OTP for Reset Password is: ${otp}. It expires in 2 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).send("OTP sent successfully. Please check your email.");
  } catch (error) {
    console.error("Error during forgot password:", error);
    res.status(500).send("Forgot password error");
  }
});

//reset(POST)
app.post("/reset-password", async (req, res) => {
  try {
    const { email, fotp, newpassword, cnfpassword } = req.body;
    if (newpassword !== cnfpassword) {
      return res.status(400).send("Passwords do not match.");
    }

    const otpData = otpStore.get(email);
    if (!otpData || otpData.otp !== fotp) {
      return res.status(400).send("Invalid OTP.");
    }

    const hashedPassword = await bcrypt.hash(newpassword, 10);
    await collection.updateOne(
      { email: email },
      { $set: { password: hashedPassword } }
    );
    otpStore.delete(email);

    res.status(200).send("Password reset successful. You can now log in.");
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(500).send("Reset password error");
  }
});

////////////////////////////////////////////////////////////////////////////////////////

//admin dashboard route
app.get("/admin-dashboard", verifyToken, async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).send("Access denied");
    }

    let allQuizzes = await QuizTitle.find().populate("questions");
    const totalQuizzes = await QuizTitle.countDocuments();

    // Get recent results for all users
    const recentResults = await QuizResult.find()
      .populate("quiz")
      .sort({ completedAt: -1 })
      .limit(5);

    // Get active users count (users who have taken quizzes in the last 30 days)
    const activeUsers = await QuizResult.distinct("user", {
      completedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    // Calculate completion rate
    const totalQuizAttempts = await QuizResult.countDocuments();
    const totalUsers = await collection.countDocuments();
    const totalPossibleAttempts = totalUsers * totalQuizzes;
    const completionRate =
      totalPossibleAttempts > 0
        ? Math.min(
            Math.round((totalQuizAttempts / totalPossibleAttempts) * 100),
            100
          )
        : 0;

    let quizzesWithStatus = allQuizzes.map((quiz) => ({
      ...quiz.toObject(),
      isComplete: quiz.questions.length === quiz.que,
    }));

    res.render("index", {
      totalQuizzes,
      users: quizzesWithStatus,
      activeUsersCount: activeUsers.length,
      recentResults: recentResults || [],
      completionRate: completionRate,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.render("index", {
      totalQuizzes: 0,
      users: [],
      activeUsersCount: 0,
      recentResults: [],
      completionRate: 0,
    });
  }
});

// Add Quiz Page
app.get("/add", (req, res) => res.render("add"));

//Analytics page demo
app.get("/analytics", (req, res) => res.render("analytics"));

// Create a new quiz
app.post("/created", verifyToken, async (req, res) => {
  const { title, que, time } = req.body;

  try {
    const existingQuiz = await QuizTitle.findOne({ title });

    if (existingQuiz) {
      return res.send(
        `<script>alert("Quiz already exists!"); window.location.href = "/admin-dashboard";</script>`
      );
    }

    await QuizTitle.create({ title, que, time });
    res.send(
      `<script>alert("Quiz successfully created!"); window.location.href = "/admin-dashboard";</script>`
    );
  } catch (err) {
    console.error(err);
    res.send(
      `<script>alert("Error creating quiz."); window.location.href = "/admin-dashboard";</script>`
    );
  }
});

app.get("/api/quiz-count", async (req, res) => {
  try {
    const totalQuizzes = await QuizTitle.countDocuments();
    res.json({ total: totalQuizzes });
  } catch (error) {
    console.error("Error fetching quiz count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a question to a quiz
app.post("/submitque", async (req, res) => {
  const {
    quiz_title,
    question,
    option1,
    option2,
    option3,
    option4,
    correct_answer,
    points,
  } = req.body;

  if (!question || !correct_answer) {
    return res.send(
      `<script>alert("Error: Missing required fields!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`
    );
  }

  try {
    const quiz = await QuizTitle.findOne({ title: quiz_title });

    if (!quiz) {
      return res.send(
        `<script>alert("Error: Quiz not found!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`
      );
    }

    if (quiz.questions.length >= quiz.que) {
      return res.send(
        `<script>alert("Error: Maximum question limit reached!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`
      );
    }

    // Check if any option already exists in the database
    const existingOptions = await Question.find({
      options: { $in: [option1, option2, option3, option4] },
    });

    // Compare the options after sorting them to avoid order issues
    const optionsArray = [option1, option2, option3, option4].sort();

    if (existingOptions.length > 0) {
      const duplicateQuestion = existingOptions.find((item) => {
        const itemOptionsSorted = item.options.sort(); // Sort options for proper comparison
        return (
          item.question === question &&
          JSON.stringify(itemOptionsSorted) === JSON.stringify(optionsArray)
        );
      });

      if (duplicateQuestion) {
        return res.send(
          `<script>alert("Error: The same question with the same options already exists!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`
        );
      }
    }

    // Create the new question
    const newQuestion = await Question.create({
      question,
      options: [option1, option2, option3, option4],
      correct_answer,
      points,
    });

    // Update the quiz with the new question
    await QuizTitle.findOneAndUpdate(
      { title: quiz_title },
      { $push: { questions: newQuestion._id } },
      { new: true }
    );
    res.send(
      `<script>alert("Question added successfully!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`
    );
  } catch (err) {
    console.error("Error adding question:", err);
    res.send(
      `<script>alert("Error adding question."); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`
    );
  }
});

// Manage Quizzes
app.get("/manageview", async (req, res) => {
  let allQuizzes = await QuizTitle.find();
  res.render("manageview", { users: allQuizzes });
});

// Display the list of questions
app.get("/api/questions/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      console.error("Invalid Quiz ID:", quizId);
      return res.status(400).json({ error: "Invalid Quiz ID" });
    }

    const quiz = await QuizTitle.findById(quizId).populate("questions");
    if (!quiz) {
      console.error("Quiz not found", quizId);
      return res.status(404).json({ error: "Quiz not found" });
    }

    const formattedQuestions = quiz.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
    }));

    res.json({ questions: formattedQuestions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a question
app.delete("/delete/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const deletedQuestion = await Question.findByIdAndDelete(questionId);
    if (!deletedQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    await QuizTitle.updateMany(
      { questions: questionId },
      { $pull: { questions: questionId } }
    );

    res.redirect("/manageview");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Edit a question
app.get("/edit/:id", async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).send("Question not found");
    }
    res.render("edit", { question });
    res.render("edit", { question });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/edit/:id", async (req, res) => {
  try {
    const { question, options, correct_answer } = req.body;
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      { question, options, correct_answer },
      { new: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ message: "Question updated successfully!", updatedQuestion });
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Manage Page
app.get("/manage", async (req, res) => {
  let allQuizzes = await QuizTitle.find();
  res.render("manage", { users: allQuizzes });
});

// Delete Quiz
app.delete("/api/quiz/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params;
    const deletedQuiz = await QuizTitle.findById(quizId);

    if (!deletedQuiz) return res.status(404).json({ error: "Quiz not found" });

    // Delete all questions associated with the quiz
    await Question.deleteMany({ _id: { $in: deletedQuiz.questions } });

    // Delete all quiz results associated with the quiz
    await QuizResult.deleteMany({ quiz: quizId });

    // Finally delete the quiz itself
    await QuizTitle.findByIdAndDelete(quizId);

    res.json({ message: "Quiz deleted successfully" });
  } catch (err) {
    console.error("Error deleting quiz:", err);
    res.status(500).json({ error: err.message });
  }
});

// Student dashboard
app.get("/student-dashboard", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await collection.findById(userId);
    let allQuizzes = await QuizTitle.find().populate("questions");
    let validQuizzes = allQuizzes.filter(
      (quiz) => quiz.questions.length === quiz.que
    );
    const userResults = await QuizResult.find({ user: userId })
      .populate("quiz")
      .sort({ completedAt: -1 })
      .limit(5);
    res.render("user", {
      user: user,
      users: validQuizzes,
      recentResults: userResults || [],
    });
  } catch (error) {
    res.status(500).render("user", {
      user: null,
      users: [],
      recentResults: [],
    });
  }
});

app.get("/profile", verifyToken, async (req, res) => {
  try {
    // Get user details with populated quiz results
    const user = await collection
      .findById(req.user.id)
      .select("-password")
      .populate({
        path: "quizResults",
        populate: { path: "quiz" },
        options: { sort: { completedAt: -1 } },
      });

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Calculate statistics
    const totalAttempts = user.quizResults.length;
    const completedQuizzes = user.quizResults.filter(
      (result) => result.score > 0
    );
    const completionRate = (completedQuizzes.length / totalAttempts) * 100 || 0;

    // Calculate average score
    const averageScore =
      user.quizResults.length > 0
        ? user.quizResults.reduce((acc, result) => acc + result.percentage, 0) /
          user.quizResults.length
        : 0;

    // Get performance data for chart (last 10 quizzes)
    const performanceData = user.quizResults
      .slice(0, 10)
      .reverse()
      .map((result) => {
        // Check if result.quiz exists before accessing its properties
        if (result.quiz) {
          return {
            quizName: result.quiz.title,
            score: result.percentage,
            date: result.completedAt,
          };
        } else {
          // Handle cases where result.quiz is null or undefined
          return {
            quizName: "Quiz not found", // Fallback if quiz is missing
            score: result.percentage,
            date: result.completedAt,
          };
        }
      });

    // Get latest quiz attempt
    const latestAttempt = user.quizResults[0];

    res.render("profile", {
      user,
      stats: {
        totalAttempts,
        completionRate: completionRate.toFixed(1),
        averageScore: averageScore.toFixed(1),
      },
      performanceData,
      latestAttempt,
      moment, // Pass moment directly
    });
  } catch (error) {
    console.error("Profile page error:", error);
    res.status(500).send("Error loading profile");
  }
});

// Update profile
app.post("/profile/update", verifyToken, async (req, res) => {
  try {
    const { displayName } = req.body;

    const updatedUser = await collection.findByIdAndUpdate(
      req.user.id,
      {
        displayName,
        lastActive: new Date(),
      },
      { new: true }
    );

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, message: "Error updating profile" });
  }
});

// Start Quiz
app.post("/startQuiz", verifyToken, async (req, res) => {
  try {
    const { quizId, answers, timeTaken } = req.body;
    const quiz = await QuizTitle.findById(quizId).populate("questions");
    const user = await collection.findById(req.user.id);

    if (!quiz) {
      return res.status(404).send("Quiz not found.");
    }

    let totalScore = 0;
    let correctAnswers = {};
    let correctcount = 0,
      totalquecount = 0;

    // Process each question
    quiz.questions.forEach((q) => {
      totalquecount++;
      correctAnswers[q._id] = q.correct_answer;
      if (answers && answers[q._id] && answers[q._id] === q.correct_answer) {
        correctcount++;
        totalScore += q.points;
      }
    });

    // Calculate total possible points and percentage
    const totalPossiblePoints = quiz.questions.reduce(
      (sum, q) => sum + q.points,
      0
    );
    const percentage = (totalScore / totalPossiblePoints) * 100;

    // Create quiz result with time information and answers
    const quizResult = await QuizResult.create({
      user: req.user.id,
      quiz: quizId,
      score: totalScore,
      totalPossibleScore: totalPossiblePoints,
      percentage: percentage,
      userName: req.user.name,
      timeTaken: timeTaken || 0,
      timeLimit: quiz.time || 0,
      completedAt: new Date(),
      answers: answers, // Store the user's answers
    });

    // Update user statistics
    const userResults = await QuizResult.find({ user: req.user.id });
    const averageScore =
      userResults.reduce((acc, result) => acc + result.percentage, 0) /
      userResults.length;

    await collection.findByIdAndUpdate(req.user.id, {
      $push: { quizResults: quizResult._id },
      $inc: { totalQuizAttempts: 1 },
      averageScore: averageScore,
    });

    // Render quiz results
    res.render("quizResult", {
      quiz,
      totalScore,
      totalPossiblePoints,
      correctcount,
      totalquecount,
      timeTaken,
      timeLimit: quiz.time,
    });
  } catch (error) {
    console.error("Error processing quiz:", error);
    res.status(500).send("Error processing quiz.");
  }
});

app.get("/quiz/:id", async (req, res) => {
  try {
    const quiz = await QuizTitle.findById(req.params.id).populate("questions");
    if (!quiz) {
      console.log("Quiz not found in the database.");
      return res.status(404).send("Quiz not found");
    }

    res.render("startQuiz", { quiz });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    res.status(500).send("Error loading quiz");
  }
});

//analytics

app.get("/api/analytics", async (req, res) => {
  try {
    const totalParticipants = await collection.countDocuments();
    const averageScore = await QuizResult.aggregate([
      { $group: { _id: null, avgScore: { $avg: "$percentage" } } },
    ]);
    const passedTests = await QuizResult.countDocuments({
      percentage: { $gte: 50 },
    });
    const failedTests = await QuizResult.countDocuments({
      percentage: { $lt: 50 },
    });

    // Calculate average time taken
    const averageTime = await QuizResult.aggregate([
      { $group: { _id: null, avgTime: { $avg: "$timeTaken" } } },
    ]);

    // Calculate completion rate (quizzes completed within time limit)
    const totalQuizzes = await QuizResult.countDocuments();
    const completedOnTime = await QuizResult.countDocuments({
      timeTaken: { $exists: true },
      $expr: { $lte: ["$timeTaken", "$timeLimit"] },
    });
    const completionRate =
      totalQuizzes > 0 ? (completedOnTime / totalQuizzes) * 100 : 0;

    const recentResults = await QuizResult.find()
      .populate("quiz")
      .sort({ completedAt: -1 })
      .limit(5);

    res.json({
      totalParticipants,
      averageScore: averageScore[0]?.avgScore || 0,
      passedTests,
      failedTests,
      averageTime: averageTime[0]?.avgTime || 0,
      completionRate: completionRate,
      recentResults: recentResults.map((result) => ({
        studentName: result.userName,
        score: `${result.percentage}%`,
        timeTaken: `${result.timeTaken || "N/A"} mins`,
        timeLimit: result.timeLimit || "N/A",
        date: result.completedAt.toISOString().split("T")[0],
        status: result.percentage >= 50 ? "Passed" : "Failed",
      })),
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// User dashboard route
app.get("/user", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await collection.findById(userId);
    let allQuizzes = await QuizTitle.find().populate("questions");
    let validQuizzes = allQuizzes.filter(
      (quiz) => quiz.questions.length === quiz.que
    );
    const userResults = await QuizResult.find({ user: userId })
      .populate("quiz")
      .sort({ completedAt: -1 })
      .limit(5);
    res.render("user", {
      user: user,
      users: validQuizzes,
      recentResults: userResults || [],
    });
  } catch (error) {
    res.status(500).render("user", {
      user: null,
      users: [],
      recentResults: [],
    });
  }
});

// Get quiz history
app.get("/api/quiz-history/:resultId", verifyToken, async (req, res) => {
  try {
    const resultId = req.params.resultId;
    const quizResult = await QuizResult.findById(resultId).populate({
      path: "quiz",
      populate: {
        path: "questions",
      },
    });

    if (!quizResult) {
      return res.status(404).json({ error: "Quiz result not found" });
    }

    // Format the response
    const formattedResult = {
      quizTitle: quizResult.quiz.title,
      questions: quizResult.quiz.questions.map((question) => ({
        question: question.question,
        userAnswer: quizResult.answers
          ? quizResult.answers[question._id] || "Not answered"
          : "Not answered",
        correctAnswer: question.correct_answer,
        isCorrect: quizResult.answers
          ? quizResult.answers[question._id] === question.correct_answer
          : false,
        points: question.points,
      })),
    };

    res.json(formattedResult);
  } catch (error) {
    console.error("Error fetching quiz history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// AI Quiz Route
app.get("/ai-quiz", verifyToken, async (req, res) => {
  try {
    const { title, count = 5 } = req.query;
    if (!title) {
      return res.status(400).json({
        error: "Quiz title is required",
        success: false,
      });
    }

    // Check if API key exists
    if (!process.env.GOOGLE_API_KEY) {
      console.error("GOOGLE_API_KEY is not set in environment variables");
      return res.status(500).json({
        error: "API key not configured",
        success: false,
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction:
        "IMPORTANT: give different question instead of repeating previous question",
    });

    const prompt = `Create a ${count} question quiz with options and answers about ${title}. Format the response as a JSON array of objects, where each object has the following structure:
    {
      "question": "The question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "The correct option"
    }`;

    const result = await model.generateContent(prompt);

    if (!result || !result.response || !result.response.text()) {
      console.error("Invalid response from Gemini API");
      return res.status(500).json({
        error: "Invalid response from AI service",
        success: false,
      });
    }

    const quizData = result.response.text();

    try {
      const cleanQuizDataString = quizData
        .replace(/```json\n|\n```/g, "")
        .trim();
      const parsedQuizData = JSON.parse(cleanQuizDataString);

      if (!Array.isArray(parsedQuizData) || parsedQuizData.length === 0) {
        console.error("Invalid quiz data format");
        return res.status(500).json({
          error: "Invalid quiz data format",
          success: false,
        });
      }

      return res.status(200).json({
        quiz: parsedQuizData,
        success: true,
      });
    } catch (parseError) {
      console.error("Error parsing quiz data:", parseError);
      return res.status(500).json({
        error: "Error parsing quiz data",
        success: false,
      });
    }
  } catch (err) {
    console.error("AI Quiz Error:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
      success: false,
    });
  }
});

// AI Quiz Score Update Route
app.post("/ai-quiz/marks", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { score } = req.body;

    const user = await collection.findById(userId);
    if (!user.aiQuizScore || user.aiQuizScore < score) {
      user.aiQuizScore = score;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: `Your max score is ${user.aiQuizScore}`,
    });
  } catch (err) {
    console.error("AI Quiz Score Update Error:", err);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
