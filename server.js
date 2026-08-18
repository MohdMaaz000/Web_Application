const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let twilioClient = null;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM_NUMBER;
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;

if (twilioAccountSid && twilioAuthToken) {
  const twilio = require("twilio");
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

app.get("/", (req, res) => {
  res.json({ message: "RPM Bikes Dubai notification API is running." });
});

app.post("/api/notify", async (req, res) => {
  const { name, phone, message, type } = req.body;
  console.log(`[API] Received notification request for ${name} (${phone}) - Type: ${type}`);

  if (!name || !phone || !message) {
    return res.status(400).json({ error: "name, phone and message are required" });
  }

  if (!twilioClient) {
    return res.status(501).json({ error: "Twilio client not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env." });
  }

  try {
    let cleanPhone = phone.replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = `+${cleanPhone}`;
    }

    if (type === "whatsapp") {
      if (!twilioWhatsAppFrom) {
        return res.status(501).json({ error: "TWILIO_WHATSAPP_FROM is required for WhatsApp messages." });
      }

      let cleanWhatsAppFrom = twilioWhatsAppFrom.replace(/[^\d+]/g, "");
      if (!cleanWhatsAppFrom.startsWith("+")) {
        cleanWhatsAppFrom = `+${cleanWhatsAppFrom}`;
      }
      console.log(`[Twilio] Sending WhatsApp from ${cleanWhatsAppFrom} to ${cleanPhone}`);
      const result = await twilioClient.messages.create({
        body: message,
        from: `whatsapp:${cleanWhatsAppFrom}`,
        to: `whatsapp:${cleanPhone}`
      });

      console.log(`[Twilio] WhatsApp successfully sent. SID: ${result.sid}`);
      return res.json({ success: true, sid: result.sid });
    }

    if (!twilioFrom) {
      return res.status(501).json({ error: "TWILIO_FROM_NUMBER is required for SMS messages." });
    }

    let cleanFrom = twilioFrom.replace(/[^\d+]/g, "");
    if (!cleanFrom.startsWith("+")) {
      cleanFrom = `+${cleanFrom}`;
    }
    console.log(`[Twilio] Sending SMS from ${cleanFrom} to ${cleanPhone}`);
    const result = await twilioClient.messages.create({
      body: message,
      from: cleanFrom,
      to: cleanPhone
    });

    console.log(`[Twilio] SMS successfully sent. SID: ${result.sid}`);
    return res.json({ success: true, sid: result.sid });
  } catch (error) {
    console.error("Notification error:", error);
    return res.status(500).json({ error: error.message || "Failed to send notification." });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`RPM Bikes Dubai notification API listening on port ${port}`);
  });
}

module.exports = app;
