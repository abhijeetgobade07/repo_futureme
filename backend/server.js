// 1. Imports
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import cron from "node-cron";
import pkg from "pg";

const { Pool } = pkg;

// 2. App setup
const app = express();
app.use(cors());
app.use(express.json());

// 3. PostgreSQL connection (Render gives DATABASE_URL env variable)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required on Render
  },
});

// Helper function for DB queries
async function query(sql, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

// 4. Mail transporter setup (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "abhijeet.gobade07@gmail.com",  // Your Gmail
    pass: "bdkb deau clfy nnkc",          // Gmail App Password
  },
});

// 5. Routes

// Signup route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ message: "Fill all fields" });

  try {
    await query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, password]);
    res.json({ message: "Signup successful!" });
  } catch (err) {
    if (err.code === "23505") return res.json({ message: "Email exists" }); // PostgreSQL duplicate entry
    console.error("DB error:", err);
    res.json({ message: "DB error" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const results = await query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
    if (results.length === 0) return res.json({ message: "Invalid credentials" });

    res.json({ message: "Login successful!" });
  } catch (err) {
    console.error("DB error:", err);
    res.json({ message: "DB error" });
  }
});

// Send letter route
app.post("/send-letter", async (req, res) => {
  const { firstName, lastName, email, deliveryDateTime, letter } = req.body;

  if (!firstName || !lastName || !email || !deliveryDateTime || !letter) {
    return res.json({ message: "Please fill in all fields." });
  }

  // Validate datetime format (YYYY-MM-DD HH:mm:ss)
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(deliveryDateTime)) {
    return res.json({ message: "Invalid datetime format." });
  }

  const sql = `
    INSERT INTO letters (first_name, last_name, email, delivery_datetime, letter_text, sent)
    VALUES ($1, $2, $3, $4, $5, 0)
  `;

  try {
    await query(sql, [firstName, lastName, email, deliveryDateTime, letter]);

    // Confirmation email
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

    await transporter.sendMail(mailOptions);
    res.json({ message: "Letter scheduled and confirmation email sent!" });
  } catch (err) {
    console.error("Error:", err);
    res.json({ message: "Failed to send letter. Try again." });
  }
});

// 6. Cron Job — Run every minute to check and send letters
cron.schedule("* * * * *", async () => {
  const now = new Date();

  // Format datetime (Postgres expects ISO strings)
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
  const endWindow = formatDateTime(new Date(now.getTime() + 60000)); // +1 min

  try {
    const results = await query(
      "SELECT * FROM letters WHERE delivery_datetime BETWEEN $1 AND $2 AND sent = 0",
      [startWindow, endWindow]
    );

    for (let letter of results) {
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

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Letter sent to ${email}`);

        await query("UPDATE letters SET sent = 1 WHERE id = $1", [id]);
      } catch (err) {
        console.error(`❌ Failed to send letter to ${email}:`, err);
      }
    }
  } catch (err) {
    console.error("Cron DB error:", err);
  }
});

// 7. Start the server
app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
