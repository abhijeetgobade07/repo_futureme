// 1. Imports
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

// 2. App setup
const app = express();
app.use(cors());
app.use(express.json());

// 3. MySQL connection
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "Abhijeet@07",
  database: "futureme",
  port: 3306,
  timezone: "local"  // Important: Use local timezone (IST) for datetime queries
});

// 4. Mail transporter setup (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "abhijeet.gobade07@gmail.com",  // Your Gmail
    pass: "bdkb deau clfy nnkc",           // Gmail App Password
  },
});

// 5. Routes

// Signup route
app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ message: "Fill all fields" });

  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, password],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") return res.json({ message: "Email exists" });
        return res.json({ message: "DB error" });
      }
      res.json({ message: "Signup successful!" });
    }
  );
});

// Login route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, results) => {
      if (err) return res.json({ message: "DB error" });
      if (results.length === 0) return res.json({ message: "Invalid credentials" });

      res.json({ message: "Login successful!" });
    }
  );
});

// Send letter route
app.post("/send-letter", (req, res) => {
  const { firstName, lastName, email, deliveryDateTime, letter } = req.body;

  if (!firstName || !lastName || !email || !deliveryDateTime || !letter) {
    return res.json({ message: "Please fill in all fields." });
  }

  // Validate datetime format (simple check, expects 'YYYY-MM-DD HH:mm:ss')
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(deliveryDateTime)) {
    return res.json({ message: "Invalid datetime format." });
  }

  const sql = `
    INSERT INTO letters (first_name, last_name, email, delivery_datetime, letter_text, sent)
    VALUES (?, ?, ?, ?, ?, 0)
  `;

  db.query(sql, [firstName, lastName, email, deliveryDateTime, letter], (err, result) => {
    if (err) {
      console.error("Database insert error:", err);
      return res.json({ message: "Failed to send letter. Try again." });
    }

    // Confirmation email (show datetime as IST, already stored as IST)
    const mailOptions = {
      from: '"FutureMe Bot" <abhijeet.gobade07@gmail.com>',
      to: email,
      subject: "📬 Your Letter is Scheduled!",
      html: `
        <p>Hi ${firstName},</p>
        <p>Your letter to your future self is scheduled for <strong>${deliveryDateTime} IST</strong>.</p>
        <p>Here’s a preview:</p>
        <blockquote style="border-left: 3px solid #ccc; padding-left: 10px; color: #555;">${letter}</blockquote>
        <p>We’ll deliver it on the scheduled date and time. 🎉</p>
        <p>— FutureMe Team</p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Confirmation email error:", error);
        return res.json({ message: "Letter saved, but confirmation email failed." });
      }

      console.log("Confirmation email sent:", info.response);
      res.json({ message: "Letter scheduled and confirmation email sent!" });
    });
  });
});

// 6. Cron Job — Run every minute to check and send letters
cron.schedule("* * * * *", () => {
  const now = new Date();

  // Format current time and 1 min later as MySQL DATETIME strings (IST assumed)
  const pad = (num) => (num < 10 ? "0" + num : num);

  const formatDateTime = (date) => {
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      " " +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes()) +
      ":00"
    );
  };

  const startWindow = formatDateTime(now);
  const endWindow = formatDateTime(new Date(now.getTime() + 60000)); // +1 minute

  const query = `
    SELECT * FROM letters
    WHERE delivery_datetime BETWEEN ? AND ? AND sent = 0
  `;

  db.query(query, [startWindow, endWindow], (err, results) => {
    if (err) {
      console.error("Cron DB query error:", err);
      return;
    }

    results.forEach((letter) => {
      const { first_name, email, letter_text, delivery_datetime, id } = letter;

      const mailOptions = {
        from: '"FutureMe Bot" <abhijeet.gobade07@gmail.com>',
        to: email,
        subject: "📨 A Letter from Your Past Self",
        html: `
          <p>Hi ${first_name},</p>
          <p>You asked us to deliver this letter on <strong>${delivery_datetime} IST</strong>.</p>
          <p>Here it is:</p>
          <blockquote style="border-left: 3px solid #ccc; padding-left: 10px; color: #555;">${letter_text}</blockquote>
          <p>— FutureMe Team</p>
        `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(`❌ Failed to send letter to ${email}:`, error);
        } else {
          console.log(`✅ Letter sent to ${email} - ${info.response}`);

          // Mark letter as sent
          db.query("UPDATE letters SET sent = 1 WHERE id = ?", [id], (err) => {
            if (err) console.error("Error updating sent flag:", err);
          });
        }
      });
    });
  });
});

// 7. Start the server
app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));