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

// Helper function to format UTC date for IST display
function formatDate(utcDate) {
  const date = new Date(utcDate);
  // Add 5.5 hours for IST
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (num) => String(num).padStart(2, "0");
  return `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(
    istDate.getDate()
  )} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(
    istDate.getSeconds()
  )}`;
}

// 4. Mail transporter setup (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "abhijeet.gobade07@gmail.com",
    pass: "bdkb deau clfy nnkc",
  },
});

// 5. Routes

//To keep render and db active
app.get("/healthz", async (req, res) => {
  try {
    await query("SELECT 1"); // Simple DB query to keep Neon active
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error" });
  }
});

// Send letter route
app.post("/send-letter", async (req, res) => {
  const { firstName, lastName, email, deliveryDateTime, letter } = req.body;

  // Validate input fields
  if (!firstName || !lastName || !email || !deliveryDateTime || !letter) {
    return res.status(400).json({ message: "Please fill in all fields." });
  }

  // Validate deliveryDateTime is a valid UTC date
  let utcDeliveryDateTime;
  try {
    utcDeliveryDateTime = new Date(deliveryDateTime);
    if (isNaN(utcDeliveryDateTime.getTime())) {
      return res.status(400).json({ message: "Invalid deliveryDateTime format. Please use a valid UTC date." });
    }
    utcDeliveryDateTime = utcDeliveryDateTime.toISOString();
  } catch (err) {
    return res.status(400).json({ message: "Error parsing deliveryDateTime. Please use a valid UTC date." });
  }

  const sql = `
    INSERT INTO letters (first_name, last_name, email, delivery_datetime, letter_text, sent)
    VALUES ($1, $2, $3, $4, $5, false)
    RETURNING id
  `;

  try {
    // Store in database
    await query(sql, [firstName, lastName, email, utcDeliveryDateTime, letter]);

    // Format UTC to IST for email
    const istDeliveryDateTime = formatDate(utcDeliveryDateTime);

    // Send confirmation email
    const mailOptions = {
      from: '"FutureMe Bot" <abhijeet.gobade07@gmail.com>',
      to: email,
      subject: "📬 Your Letter is Scheduled!",
      html: `
        <p>Hi ${firstName},</p>
        <p>Your letter to your future self is scheduled for <strong>${istDeliveryDateTime} IST</strong>.</p>
        <p>Here’s a preview:</p>
        <blockquote style="border-left: 3px solid #ccc; padding-left: 10px; color: #555;">${letter}</blockquote>
        <p>We’ll deliver it on the scheduled date and time. 🎉</p>
        <p>— FutureMe Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Letter scheduled and confirmation email sent!" });
  } catch (err) {
    console.error("Error in /send-letter:", err);
    res.status(500).json({ message: "Failed to schedule letter. Please try again." });
  }
});

// 6. Cron Job — Run every minute to check and send letters
cron.schedule("* * * * *", async () => {
  try {
    const results = await query(
      "SELECT * FROM letters WHERE delivery_datetime <= NOW() AND sent = false"
    );

    for (let letter of results) {
      const { first_name, email, letter_text, delivery_datetime, id } = letter;

      // Format UTC from DB to IST for email
      const istDeliveryDateTime = formatDate(delivery_datetime);

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

// 7. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
