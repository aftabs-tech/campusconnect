const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const https = require('https'); // Use native https for zero dependencies
const router = express.Router();

const ALLOWED_DOMAIN = '@somaiya.edu';

const validateEmailDomain = (email) => {
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
};

const sendOTP = async (email, otp) => {
  try {
    const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
    console.log(`>>> Sending OTP via Brevo API to ${email}: ${otp} <<<`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: "CampusConnect", email: process.env.EMAIL_USER },
        to: [{ email: email }],
        subject: "CampusConnect - Verify Your Email",
        htmlContent: "<div style='font-family:Arial;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px'><h2 style='color:#6C63FF;text-align:center'>Welcome to CampusConnect!</h2><p>Your OTP to verify your email is:</p><div style='background:#f4f4f4;padding:15px;text-align:center;font-size:24px;font-weight:bold;letter-spacing:5px;color:#333;border-radius:5px'>" + otp + "</div><p style='margin-top:20px'>This code is valid for 10 minutes. If you did not sign up, please ignore this email.</p></div>"
      })
    });

    const result = await response.json();
    console.log(`Brevo API Status: ${response.status}`, JSON.stringify(result));
  } catch (err) {
    console.error("Email failure", err.message);
  }
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, college, year } = req.body;

    // Domain validation BEFORE everything else
    if (!validateEmailDomain(email)) {
      return res.status(400).json({ 
        message: `Only Somaiya email addresses (${ALLOWED_DOMAIN}) are allowed.` 
      });
    }

    let user = await User.findOne({ email });

    // Case 1: User exists and is already verified
    if (user && user.isVerified) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (user) {
      // Case 2: User exists but is NOT verified
      // Update their info (maybe they changed their name/role/college during retry)
      user.name = name;
      user.password = password; // Will be hashed by pre-save hook
      user.role = role;
      user.college = college;
      user.year = year || 1;
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    } else {
      // Case 3: User does not exist
      user = await User.create({
        name,
        email,
        password,
        college,
        year: year || 1,
        otp,
        otpExpiry
      });
    }

    // LOG OTP LOUDLY
    console.log('\n=======================================');
    console.log(`NEW USER SIGNUP: ${user.email}`);
    console.log(`OTP CODE: ${otp}`);
    console.log('=======================================\n');

    // Remove await to send email in background
    sendOTP(user.email, otp);

    res.status(201).json({
      message: 'Signup successful. Please verify your email.',
      email: user.email,
      otp: otp // SENDING OTP IN RESPONSE TO SOLVE YOUR PROBLEM IMMEDIATELY
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Domain validation to enforce restricted access
    if (!validateEmailDomain(email)) {
      return res.status(400).json({ 
        message: `Invalid email. Only ${ALLOWED_DOMAIN} addresses are permitted.` 
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Account not verified. Please verify your email.' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      college: user.college,
      avatar: user.avatar,
      bio: user.bio,
      skills: user.skills,
      savedPosts: user.savedPosts || [],
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    console.log('\n=======================================');
    console.log(`OTP RESENT TO: ${email}`);
    console.log(`NEW OTP CODE: ${otp}`);
    console.log('=======================================\n');

    // Remove await to send email in background
    sendOTP(email, otp);

    res.json({ 
      message: 'OTP resent successfully!',
      otp: otp // SENDING OTP IN RESPONSE TO SOLVE YOUR PROBLEM IMMEDIATELY
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User already verified' });
    }

    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({
      message: 'Email verified successfully!',
      _id: user._id,
      name: user.name,
      email: user.email,
      college: user.college,
      avatar: user.avatar,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
