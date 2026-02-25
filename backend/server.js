const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for OTPs (For production, use a database like Redis or MongoDB)
const otpStore = new Map();

// Resend API Key (uses HTTPS port 443, works on Render free tier)
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_Ptjn5uQk_EPJdAmMBA4vVQ2QGN1EYTWDD';

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store the OTP with a 5-minute expiration time
    otpStore.set(email, {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 mins in milliseconds
    });

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0f172a; text-align: center;">Welcome to HealthKee!</h2>
            <p style="color: #334155; font-size: 16px;">Here is your verification code to securely access your account:</p>
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #2196f3; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">This code will expire in 5 minutes.</p>
            <hr style="border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
    `;

    try {
        // Send email via Resend HTTP API (port 443, not blocked by Render)
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'HealthKee Security <onboarding@resend.dev>',
                to: [email],
                subject: 'Your HealthKee Login Code',
                html: emailHtml,
            }),
        });

        const resendData = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Resend API Error:', resendData);
            return res.status(500).json({ error: `Failed to send email: ${resendData.message || 'Unknown error'}` });
        }

        console.log(`OTP sent to ${email} via Resend (ID: ${resendData.id})`);
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending email via Resend:', error);
        res.status(500).json({ error: `Failed to send email: ${error.message}` });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const storedData = otpStore.get(email);

    if (!storedData) {
        return res.status(400).json({ error: 'OTP request not found or expired' });
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiresAt) {
        otpStore.delete(email); // Clean up expired OTP
        return res.status(400).json({ error: 'OTP has expired' });
    }

    if (storedData.otp === otp) {
        // OTP verified successfully
        otpStore.delete(email); // Prevent reuse of the OTP
        res.status(200).json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid OTP' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (Accessible via Wi-Fi)`);
});
