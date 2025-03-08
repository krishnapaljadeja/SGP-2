const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser")
const jwt = require("jsonwebtoken")
const collection = require("../models/user");
const transporter = require("../src/otp");
const verifyToken = require("../middlewares/authmiddleware")
const dotenv = require("dotenv").config();
const {adminAuthorization,studentAuthorization} = require("../middlewares/rolemiddleware")
router.use(cookieParser())



const tempUserStore = new Map(); // Temporary store for user details
const otpStore = new Map(); // Temporary storage for OTPs

// Middleware for role-based authorization 
router.get("/admin-dashboard", verifyToken, (req, res) => {
    res.render("admin-dashboard",{username: req.user.name});
});

router.get("/student-dashboard", verifyToken, (req, res) => {
    res.render("student-dashboard",{username: req.user.name});
});

router.get("/home", (req, res) => {
    res.render("home");
});

// Home Route
router.get("/login", (req, res) => {
    res.render("login");
});

// Signup Route (GET)
router.get("/signup", (req, res) => {
    res.render("signup");
});

// OTP Route (GET)
router.get("/otp", (req, res) => {
    res.render("otp");
});

// Home Route
router.post("/logout", (req, res) => {
    res.clearCookie("token")
    res.render("login");
});

// Signup Route (POST)
router.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await collection.findOne({ name: username });
        const existingEmail = await collection.findOne({ email });

        if (existingUser || existingEmail) {
            return res.send(`<script>alert("User already exists."); window.location.href = "/";</script>`);
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
router.post("/otp", async (req, res) => {
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
            return res.status(400).send("User data not found. Please restart signup.");
        }

        const hashedPassword = await bcrypt.hash(tempUser.password, 10);
        const newUser = new collection({ name: tempUser.username, password: hashedPassword, email: tempUser.email, role: "student" });
        await newUser.save();

        otpStore.delete(emailFound);
        tempUserStore.delete(emailFound);

        res.send(`<script>alert("Signup successful! You can now log in."); window.location.href = "/";</script>`);
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).send("Error verifying OTP");
    }
});

// Login Route
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await collection.findOne({ $or: [{ name: username }, { email: username }] });

        if (!user) {
            return res.send(`<script>alert("User not found"); window.location.href = "/";</script>`);
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (isPasswordMatch) {

            const token = jwt.sign({id: user._id, role: user.role, name: user.name},process.env.ACCESS_TOKEN_SECRET_KEY)
            

            res.cookie("token", token, { httpOnly: true, secure: false });

            // console.log("JWT Secret Key:", process.env.ACCESS_TOKEN_SECRET_KEY);

             // Redirect based on user role
             if (user.role === "admin") {
                res.redirect("/admin-dashboard");
            } else if (user.role === "student") {
                res.redirect("/student-dashboard");
            } else {
                res.redirect("/home"); // Default fallback
            }
        } else {
            res.send(`<script>alert("Wrong username or password"); window.location.href = "/";</script>`);
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Login error");
    }
});

// Forgot Password Routes
router.get("/forgot", (req, res) => {
    res.render("forgot");
});

router.post("/forgot", async (req, res) => {
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

router.post("/reset-password", async (req, res) => {
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
        await collection.updateOne({ email: email }, { $set: { password: hashedPassword } });
        otpStore.delete(email);

        res.status(200).send("Password reset successful. You can now log in.");
    } catch (error) {
        console.error("Error during password reset:", error);
        res.status(500).send("Reset password error");
    }
});

module.exports = router;