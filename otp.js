const nodemailer = require("nodemailer");
// const bcrypt = require("bcrypt");
// const dotenv = require("dotenv");

// dotenv.config();



// Configure nodemailer for sending emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "quizify54@gmail.com",
        pass: 'mjhs dszr iiuo cpht',
    },
});

module.exports = transporter;