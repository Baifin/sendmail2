const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase admin client (with service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Nodemailer transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

// ✅ Send email with optional image and verification link
app.post("/send-email", async (req, res) => {
  const { to, subject, text, html, image, userId } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).send("Missing required fields");
  }

  let finalHtml = html;
  if (userId) {
    const verificationUrl = `https://732d-2406-7400-c2-12bf-eccc-3875-a32b-cf8.ngrok-free.app/verify-email/${userId}`;
    finalHtml += `
      <p>Click the link below to verify your account:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
    `;
  }

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    text: text || "No text content provided",
    html: finalHtml || "<p>No HTML content provided</p>",
  };

  if (image) {
    const imageBuffer = Buffer.from(image.split(";base64,").pop(), "base64");
    mailOptions.attachments = [
      {
        filename: "visitor-qrcode.png",
        content: imageBuffer,
        encoding: "base64",
      },
    ];
  }

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("Email sent successfully");
  } catch (error) {
    console.error("Email send failed:", error);
    res.status(500).send("Failed to send email");
  }
});

// ✅ Verification endpoint
// ✅ Verification endpoint
app.get("/verify-email/:id", async (req, res) => {
  const userId = req.params.id;
  console.log("Received verification request for ID:", userId);

  try {
    const { data, error } = await supabase
      .from("edutrack")
      .update({ is_verified: true })
      .eq("id", userId)
      .select();

    if (error || !data || data.length === 0) {
      console.error("Verification failed:", error);
      return res.status(400).send("Verification failed or user not found");
    }

    return res.send(`
      <html>
        <head><title>Verification Success</title></head>
        <body style="text-align:center; font-family:Arial; padding:50px;">
          <h2>✅ Email Verified</h2>
          <p>You may now log in to your account.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).send("Server error during verification");
  }
});




app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
