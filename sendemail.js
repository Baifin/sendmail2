import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './lib/supabaseClient.js';
import transporter from './lib/nodemailer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // to parse JSON request bodies

// 🔽 Your OTP-based email registration endpoint
app.post("/register", async (req, res) => {
  const { email, password, fullName, role, department } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data?.user) return res.status(400).json({ error: error?.message });

  await supabase.from("edutrack").insert({
    id: data.user.id,
    full_name: fullName,
    role,
    dep: department,
    is_verified: false,
    otp,
    otp_expires_at: otpExpiresAt.toISOString()
  });

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Your verification code",
    html: `<p>Your OTP code is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  });

  res.status(200).json({ message: "OTP sent", userId: data.user.id });
});

// 🔽 Your OTP verification endpoint
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const { data: user, error } = await supabase
    .from("edutrack")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !user) return res.status(404).json({ error: "User not found" });
  if (user.is_verified) return res.status(400).json({ error: "Already verified" });

  const now = new Date();
  if (user.otp !== otp || new Date(user.otp_expires_at) < now)
    return res.status(400).json({ error: "Invalid or expired OTP" });

  await supabase
    .from("edutrack")
    .update({ is_verified: true, otp: null, otp_expires_at: null })
    .eq("email", email);

  res.status(200).json({ message: "Email verified" });
});

// Health check route
app.get("/", (req, res) => {
  res.send("Server running...");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
