import express from "express";
import JWT from "../util/jwt.js";
import path from "path";

const router = express.Router();



// Simple hard-coded username and password for demonstration
const users = {
  guest: {
    password: "guest",
    admin: false,
  },
  admin: {
    password: "admin",
    admin: true,
  },
};

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

// User needs to login to obtain an authentication token
router.post("/login", (req, res) => {
  // Check the username and password
  const { username, password } = req.body;
  console.log(req.body)
  console.log(`username ${username}`)
  console.log(`password ${password}`)

  const user = users[username];

  if (!user || password !== user.password) {
    return res.sendStatus(401);
  }

  // Get a new authentication token and send it back to the client
  console.log("Successful login by user", username);
  const token = JWT.generateAccessToken({ username });
  res.json({ authToken: token });
});

// Main page protected by our authentication middleware
router.get("/", JWT.authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin page requires admin permissions
router.get("/admin", JWT.authenticateToken, (req, res) => {
  // user info added to the request by JWT.authenticateToken
  // Check user permissions
  const user = users[req.user.username];

  if (!user || !user.admin) {
    // bad user or not admin
    console.log("Unauthorised user requested admin content.");
    return res.sendStatus(403);
  }

  // User permissions verified.
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

export default router;










