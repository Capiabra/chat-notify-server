const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

// Инициализация Firebase Admin из .env
const serviceAccount = require('./service-account.json'); // ← просто require
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors({ origin: true })); // Разрешить запросы с любого origin (для MVP)
app.use(express.json());

// Эндпоинт для отправки уведомления
app.post('/notify', async (req, res) => {
  try {
    const { senderName, messageText, receiverUid } = req.body;

    if (!receiverUid || !messageText) {
      return res.status(400).json({ error: 'receiverUid и messageText обязательны' });
    }

    // Получаем FCM-токен получателя
    const userDoc = await db.collection('users').doc(receiverUid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const fcmToken = userDoc.data().fcmToken;
    if (!fcmToken) {
      return res.status(400).json({ error: 'У пользователя нет FCM-токена' });
    }

    // Отправляем push
    const message = {
      notification: {
        title: `Сообщение от ${senderName || 'Пользователь'}`,
        body: messageText,
      },
      token: fcmToken,
      android: {
        notification: {
          channelId: 'chat',
          sound: 'default',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Уведомление отправлено:', response);

    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});