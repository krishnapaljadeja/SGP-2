const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    // console.log("Request Headers:", req.headers);
    // console.log("Cookies:", req.cookies);  // Debugging

    let token;
    
    // Try to get token from Authorization header
    let authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } 
    else if (req.cookies.token) {
        // If not in header, try getting it from cookies
        token = req.cookies.token;
    }

    if (!token) {
        console.log("No token found in headers or cookies.");
        return res.status(401).json({ success: false, message: "No token provided, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY);
        req.user = decoded;
        console.log("Decoded user:", req.user);
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

module.exports = verifyToken;