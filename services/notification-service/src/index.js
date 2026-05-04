const express = require('express');
const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'notifications';

// Email transporter (using a test service for demo)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'test@example.com',
    pass: process.env.EMAIL_PASS || 'testpass'
  }
});

let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('Connected to RabbitMQ');

    // Consume messages
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const notification = JSON.parse(msg.content.toString());
        console.log('Received notification:', notification);

        try {
          await sendNotification(notification);
          channel.ack(msg);
        } catch (error) {
          console.error('Failed to send notification:', error);
          channel.nack(msg, false, true); // Requeue
        }
      }
    });
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
  }
}

async function sendNotification(notification) {
  const { type, email, subject, message } = notification;

  if (type === 'email') {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email credentials not configured. Logging email instead of sending.');
      console.log(`Email to ${email}: ${subject} - ${message}`);
      return;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: message
    });
    console.log(`Email sent to ${email}`);
  } else if (type === 'sms') {
    // For demo, just log SMS
    console.log(`SMS to ${email}: ${message}`);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

// API endpoint to send notification directly (for testing)
app.post('/notify', async (req, res) => {
  const { type, email, subject, message } = req.body;

  try {
    await sendNotification({ type, email, subject, message });
    res.json({ status: 'sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to enqueue notifications via RabbitMQ
app.post('/publish', async (req, res) => {
  const notification = req.body;

  if (!channel) {
    return res.status(503).json({ error: 'Notification queue is unavailable' });
  }

  try {
    await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(notification)), {
      persistent: true
    });
    res.json({ status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8005;
app.listen(PORT, () => {
  console.log(`Notification service running on port ${PORT}`);
  connectRabbitMQ();
});