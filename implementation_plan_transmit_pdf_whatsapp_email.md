# PDF Transmission (WhatsApp & Email)

Enable digital delivery of payslips, KETs, and leave reports to employees.

## User Review Required

> [!IMPORTANT]
> **Email Configuration**: Sending emails requires an SMTP service. The backend will include a configurable `nodemailer` setup. You will need to provide your own SMTP credentials (e.g., SendGrid, Mailtrap, or Gmail App Password) for this to work in production.

## Proposed Changes

### [Component Name] Backend: Transmission Service

#### [NEW] [transmit.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/transmit.js)
- Implement `/api/transmit/email` endpoint.
- Use `nodemailer` to send emails with PDF attachments (received as base64 from the client).
- Use employee's `email` from the database.

#### [MODIFY] [index.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/index.js)
- Register the new `transmit` route.

### [Component Name] Frontend: UI Integration

#### [MODIFY] [Payslip.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx)
#### [MODIFY] [EmployeeKETs.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeKETs.jsx)
#### [MODIFY] [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx)
- Add a "Transmit" button (or a dropdown with Email/WhatsApp options).
- **Email Flow**: Generate PDF blob -> Convert to Base64 -> Send to `/api/transmit/email`.
- **WhatsApp Flow**: Open `https://wa.me/[phone]?text=[message]` in a new tab.

## Verification Plan

### Manual Verification
1. Open a Payslip.
2. Click "Transmit" -> "Send via Email".
3. Check the server console for the sent email confirmation (or verify receipt if SMTP is configured).
4. Click "Transmit" -> "Share via WhatsApp".
5. Verify it opens the correct `wa.me` link with a personalized message.
