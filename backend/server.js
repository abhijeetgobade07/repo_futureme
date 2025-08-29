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

// 3. PostgreSQL connection (Render provides DATABASE_URL env variable)
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

// ------------------ UTC <-> IST Helper ------------------
function utcToIST(utcDateTime) {
  const date = new Date(utcDateTime);
  // IST offset = +5:30 hours
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return (
    istDate.getFullYear() +
    "-" +
    String(istDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(istDate.getDate()).padStart(2, "0") +
    " " +
    String(istDate.getHours()).padStart(2, "0") +
    ":" +
    String(istDate.getMinutes()).padStart(2, "0") +
    ":" +
    String(istDate.getSeconds()).padStart(2, "0")
  );
}
// --------------------------------------------------------

// 4. Mail transporter setup (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "abhijeet.gobade07@gmail.com", // Your Gmail
    pass: "bdkb deau clfy nnkc",         // Gmail App Password
  },
});

// 5. Routes

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

  // Convert incoming IST datetime to UTC before storing
  const [datePart, timePart] = deliveryDateTime.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  const istDate = new Date(year, month - 1, day, hours, minutes, seconds);
  const utcDateTime = new Date(istDate.getTime() - 5.5 * 60 * 60 * 1000); // IST -> UTC

  const sql = `
    INSERT INTO letters (first_name, last_name, email, delivery_datetime, letter_text, sent)
    VALUES ($1, $2, $3, $4, $5, false)
  `;

  try {
    await query(sql, [firstName, lastName, email, utcDateTime.toISOString(), letter]);

    // Confirmation email (display in IST)
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

  // Format datetime in UTC for DB query
  const pad = (num) => (num < 10 ? "0" + num : num);
  const formatUTC = (date) => {
    return (
      date.getUTCFullYear() +
      "-" +
      pad(date.getUTCMonth() + 1) +
      "-" +
      pad(date.getUTCDate()) +
      " " +
      pad(date.getUTCHours()) +
      ":" +
      pad(date.getUTCMinutes()) +
      ":00"
    );
  };

  const startWindow = formatUTC(now);
  const endWindow = formatUTC(new Date(now.getTime() + 60000)); // +1 min

  try {
    const results = await query(
      "SELECT * FROM letters WHERE delivery_datetime BETWEEN $1 AND $2 AND sent = false",
      [startWindow, endWindow]
    );

    for (let letter of results) {
      const { first_name, email, letter_text, delivery_datetime, id } = letter;

      // Convert UTC from DB to IST for email display
      const istDeliveryDateTime = utcToIST(delivery_datetime);

      const mailOptions = {
        from: '"FutureMe Bot" <abhijeet.gobade07@gmail.com>',
        to: email,
        subject: "📨 A Letter from Your Past Self",
        html: `
          <p>Hi ${first_name},</p>
          <p>You asked us to deliver this letter on <strong>${istDeliveryDateTime} IST</strong>.</p>
          <p>Here it is:</p>
          <blockquote style="border-left: 3px solid #ccc; padding-left: 10px; color: #555;">${letter_text}</blockquote>
          <p>— FutureMe Team</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Letter sent to ${email}`);

        await query("UPDATE letters SET sent = true WHERE id = $1", [id]);
      } catch (err) {
        console.error(`❌ Failed to send letter to ${email}:`, err);
      }
    }
  } catch (err) {
    console.error("Cron DB error:", err);
  }
});

// 7. Start the server (PORT from Render or fallback to 5000 locally)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
