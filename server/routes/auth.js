const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already registered" });

    const colors = ["#6C63FF", "#1a9cb0", "#3ecfcf", "#f5a623", "#ff5e5e", "#a78bfa", "#34d399"];
    const count = await User.countDocuments();

    const user = await User.create({
      name,
      email,
      password,
      role: role || "User",
      color: colors[count % colors.length],
      // UPDATED: Set status to Online on register
      status: "Online",
      lastSeen: new Date(),
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      color: user.color,
      status: user.status, // Return status
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // UPDATED: Only set to 'Online' if they aren't 'On Leave'
  if (user.status !== "On Leave") {
    user.status = "Online";
  }
  
  user.lastSeen = new Date();
  await user.save(); 

  res.json({
    _id: user._id,
    name: user.name,
    role: user.role,
    color: user.color,
    status: user.status, // This will now correctly return 'On Leave' if applicable
    leaveUntil: user.leaveUntil, // Ensure this is also returned
    token: generateToken(user._id),
  });
});

// UPDATED: Added Logout Route
// POST /api/auth/logout
router.post("/logout", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      // Don't flip to Offline if they are explicitly On Leave
      if (user.status !== "On Leave") {
        user.status = "Offline";
        user.lastSeen = new Date();
        await user.save();
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => {
  res.json(req.user);
});

// POST /api/auth/seed  (dev only - seeds demo accounts)
router.post("/seed", async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.json({ message: "Already seeded" });

    const colors = ["#6C63FF", "#1a9cb0", "#3ecfcf", "#f5a623", "#ff5e5e"];
    const users = await User.insertMany([
      {
        name: "Aisha Khan",
        email: "admin@taskflow.io",
        password: "admin123",
        role: "Admin",
        color: colors[0],
      },
      {
        name: "Dev Sharma",
        email: "pm@taskflow.io",
        password: "pm123",
        role: "PM",
        color: colors[1],
      },
      {
        name: "Priya Patel",
        email: "priya@taskflow.io",
        password: "user123",
        role: "User",
        color: colors[2],
      },
      {
        name: "Rahul Gupta",
        email: "rahul@taskflow.io",
        password: "user123",
        role: "User",
        color: colors[3],
      },
      {
        name: "Sara Mehta",
        email: "sara@taskflow.io",
        password: "user123",
        role: "User",
        color: colors[4],
      },
    ]);

    // Re-hash passwords (insertMany bypasses pre-save hook)
    const bcrypt = require("bcryptjs");
    for (const u of users) {
      u.password = await bcrypt.hash(
        u.email === "admin@taskflow.io"
          ? "admin123"
          : u.email === "pm@taskflow.io"
            ? "pm123"
            : "user123",
        10,
      );
      await u.save();
    }

    const Task = require("../models/Task");
    const [admin, pm, priya, rahul, sara] = users;
    await Task.insertMany([
      {
        title: "Setup MongoDB schema",
        description: "Design user and task collections with indexes",
        assignedTo: priya._id,
        createdBy: pm._id,
        priority: "High",
        status: "Completed",
        dueDate: new Date("2025-04-10"),
      },
      {
        title: "Build JWT Auth API",
        description: "Login, register, and token refresh endpoints",
        assignedTo: rahul._id,
        createdBy: pm._id,
        priority: "High",
        status: "Completed",
        dueDate: new Date("2025-04-12"),
      },
      {
        title: "Kanban Dashboard UI",
        description: "React Kanban board with role-based views",
        assignedTo: priya._id,
        createdBy: pm._id,
        priority: "High",
        status: "In Progress",
        dueDate: new Date("2025-04-18"),
      },
      {
        title: "Email Notification System",
        description: "Nodemailer integration for task alerts",
        assignedTo: sara._id,
        createdBy: pm._id,
        priority: "Medium",
        status: "Pending",
        dueDate: new Date("2025-04-25"),
      },
      {
        title: "Mobile Responsive Design",
        description: "Tailwind responsive breakpoints across pages",
        assignedTo: rahul._id,
        createdBy: pm._id,
        priority: "Medium",
        status: "In Progress",
        dueDate: new Date("2025-04-20"),
      },
      {
        title: "Analytics Chart Module",
        description: "Chart.js burn-down and velocity charts",
        assignedTo: sara._id,
        createdBy: pm._id,
        priority: "Low",
        status: "Pending",
        dueDate: new Date("2025-05-01"),
      },
      {
        title: "AWS S3 File Upload",
        description: "Allow users to attach files to task cards",
        assignedTo: priya._id,
        createdBy: pm._id,
        priority: "Medium",
        status: "Pending",
        dueDate: new Date("2025-05-05"),
      },
      {
        title: "Socket.io Real-time",
        description: "Live Kanban updates via WebSocket",
        assignedTo: rahul._id,
        createdBy: pm._id,
        priority: "High",
        status: "Pending",
        dueDate: new Date("2025-04-30"),
      },
    ]);

    res.json({
      message: "Seeded successfully",
      users: users.map((u) => ({ name: u.name, email: u.email, role: u.role })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
