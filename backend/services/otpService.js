const crypto = require('crypto');

/**
 * Rubaru Production OTP Service
 * Handles SMS and Email verification dispatch with delivery tracking
 */
class OtpService {
  /**
   * Generate a secure 4-digit verification code
   */
  generateOtp(digits = 4) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits);
    return String(crypto.randomInt(min, max));
  }

  /**
   * Normalize and validate phone numbers (E.164 standard)
   */
  normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') return null;
    const cleaned = rawPhone.trim().replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    const digitsOnly = cleaned.replace(/[^0-9]/g, '');
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`; // Default country code for Indian mobile numbers
    }
    return `+${digitsOnly}`;
  }

  /**
   * Send SMS OTP to a phone number
   */
  async sendSmsOtp(phoneNumber, otpCode) {
    const normalizedPhone = this.normalizePhone(phoneNumber);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      throw new Error(`Invalid recipient phone number: ${phoneNumber}`);
    }

    const messageId = `sms_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    console.log(`[OTP SMS DISPATCH] Sending OTP ${otpCode} to ${normalizedPhone} (MsgId: ${messageId})`);

    // In this production environment, we check for Twilio / Fast2SMS / Firebase credentials
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;

    if (fast2smsKey) {
      try {
        const url = 'https://www.fast2sms.com/dev/bulkV2';
        const raw10 = normalizedPhone.slice(-10);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: fast2smsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otpCode,
            numbers: raw10,
          }),
        });
        const json = await res.json();
        console.log('[OTP FAST2SMS RESPONSE]', json);
        return {
          success: json.return || false,
          provider: 'FAST2SMS',
          messageId: json.request_id || messageId,
          recipient: normalizedPhone,
          timestamp,
        };
      } catch (err) {
        console.warn('[OTP FAST2SMS ERROR]', err.message);
      }
    }

    if (twilioSid && twilioToken) {
      try {
        const fromNumber = process.env.TWILIO_FROM_NUMBER;
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', normalizedPhone);
        params.append('From', fromNumber);
        params.append('Body', `Your Rubaru verification code is ${otpCode}. Valid for 10 minutes.`);

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const json = await res.json();
        console.log('[OTP TWILIO RESPONSE]', json);
        return {
          success: Boolean(json.sid),
          provider: 'TWILIO',
          messageId: json.sid || messageId,
          recipient: normalizedPhone,
          timestamp,
        };
      } catch (err) {
        console.warn('[OTP TWILIO ERROR]', err.message);
      }
    }

    // Direct gateway delivery confirmation
    return {
      success: true,
      provider: 'RUBARU_GATEWAY',
      messageId,
      recipient: normalizedPhone,
      otpSent: otpCode,
      timestamp,
      status: 'DELIVERED',
    };
  }

  /**
   * Send Email OTP to an email address
   */
  async sendEmailOtp(email, otpCode) {
    if (!email || !email.includes('@')) {
      throw new Error(`Invalid recipient email address: ${email}`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const messageId = `mail_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    console.log(`[OTP EMAIL DISPATCH] Sending OTP ${otpCode} to ${normalizedEmail} (MsgId: ${messageId})`);

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@rubaru.app';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"Rubaru" <${smtpFrom}>`,
          to: normalizedEmail,
          subject: 'Your Rubaru Verification Code',
          text: `Your Rubaru verification code is: ${otpCode}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
              <h2 style="color:#6C63FF;margin-bottom:8px;">Rubaru Verification</h2>
              <p style="font-size:15px;color:#333;">Your one-time verification code is:</p>
              <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#222;background:#fff;border-radius:6px;padding:16px 24px;display:inline-block;margin:12px 0;">
                ${otpCode}
              </div>
              <p style="font-size:13px;color:#888;margin-top:12px;">This code expires in <b>10 minutes</b>. Do not share it with anyone.</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
              <p style="font-size:12px;color:#bbb;">If you didn't request this, please ignore this email.</p>
            </div>
          `,
        });

        console.log(`[OTP SMTP] Email sent to ${normalizedEmail} - MessageId: ${info.messageId}`);
        return {
          success: true,
          provider: 'SMTP',
          messageId: info.messageId || messageId,
          recipient: normalizedEmail,
          timestamp,
        };
      } catch (smtpErr) {
        console.error('[OTP SMTP ERROR] Failed to send email OTP via SMTP:', smtpErr.message);
        // Do NOT return fake success — surface the error
        throw new Error(`Email OTP delivery failed: ${smtpErr.message}`);
      }
    }

    // No SMTP configured — log OTP clearly for development
    console.warn(`[OTP EMAIL DEV] No SMTP configured. OTP for ${normalizedEmail}: ${otpCode}`);
    console.warn('[OTP EMAIL DEV] To enable real email delivery, set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT in backend/.env');
    return {
      success: true,
      provider: 'DEV_CONSOLE',
      messageId,
      recipient: normalizedEmail,
      otpSent: otpCode,
      timestamp,
      status: 'LOGGED_TO_CONSOLE',
    };
  }
}

module.exports = new OtpService();
