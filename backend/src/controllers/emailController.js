const { sendEmail } = require('../config/email');

const sendMail = async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and text or html' 
      });
    }

    const result = await sendEmail({ to, subject, text, html });
    
    if (result.success) {
      res.json({ message: 'Email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ error: 'Failed to send email', details: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const sendReport = async (req, res) => {
  try {
    const { subject, reportData } = req.body;
    const to = process.env.EMAIL_TO;

    if (!subject || !reportData) {
      return res.status(400).json({ error: 'Missing subject or reportData' });
    }

    const html = `
      <h1>${subject}</h1>
      <pre>${JSON.stringify(reportData, null, 2)}</pre>
    `;

    const result = await sendEmail({ to, subject, html });
    
    if (result.success) {
      res.json({ message: 'Report sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send report' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { sendMail, sendReport };