const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { getDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

// Utility to convert sql.js results to objects
const toObjects = (result) => {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
};

// 📧 Transmit PDF via Email
router.post('/email', authMiddleware, async (req, res) => {
    const { employeeId, pdfBase64, subject, message, fileName } = req.body;
    const entityId = req.user.entityId;

    if (!employeeId || !pdfBase64) {
        return res.status(400).json({ error: 'Missing employeeId or PDF data' });
    }

    try {
        const db = await getDb();

        // 1. Fetch employee email
        const empRes = db.exec('SELECT full_name, email FROM employees WHERE id = ? AND entity_id = ?', [employeeId, entityId]);
        const employee = toObjects(empRes)[0];

        if (!employee || !employee.email) {
            return res.status(404).json({ error: 'Employee email not found' });
        }

        // 2. Setup Transporter
        // NOTE: In production, these should be environment variables. 
        // We'll use a dummy/placeholder config that the user can update.
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || 'placeholder@example.com',
                pass: process.env.SMTP_PASS || 'placeholder_password',
            },
        });

        // 3. Send Email
        const mailOptions = {
            from: `"ezyHR Payroll" <noreply@ezyhr.sg>`,
            to: employee.email,
            subject: subject || 'Your Document from ezyHR',
            text: message || `Dear ${employee.full_name},\n\nPlease find your attached document.\n\nRegards,\nezyHR Team`,
            attachments: [
                {
                    filename: fileName || 'document.pdf',
                    content: pdfBase64.split('base64,')[1] || pdfBase64,
                    encoding: 'base64'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL_SENT]', info.messageId);

        res.json({ message: 'Email sent successfully', messageId: info.messageId });
    } catch (err) {
        console.error('[EMAIL_TRANSMIT_ERROR]', err);
        res.status(500).json({ error: 'Failed to send email: ' + err.message });
    }
});

module.exports = router;
