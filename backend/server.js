const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const otpStore = new Map();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'prathiyuman4452@gmail.com';

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: "HealthKee Security", email: SENDER_EMAIL },
                to: [{ email: email }],
                subject: "Your HealthKee Login Code",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #2196f3;">Verification Code</h2>
                        <p>Use the code below to sign in:</p>
                        <div style="font-size: 32px; font-weight: bold; background: #f4f4f4; padding: 15px; text-align: center; letter-spacing: 5px;">
                            ${otp}
                        </div>
                        <p style="color: #888; margin-top: 20px;">This code expires in 5 minutes.</p>
                    </div>`
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Brevo API Error Details:', data);
            throw new Error(`Brevo Error: ${data.message || response.statusText}`);
        }

        console.log(`OTP sent to ${email} via Brevo`);
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Final Error Catch:', error.message);
        res.status(500).json({ error: error.message || 'Failed to send OTP' });
    }
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const storedData = otpStore.get(email);
    if (!storedData || Date.now() > storedData.expiresAt) return res.status(400).json({ error: 'OTP expired or not found' });

    if (storedData.otp === otp) {
        otpStore.delete(email);
        res.status(200).json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid OTP' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});


