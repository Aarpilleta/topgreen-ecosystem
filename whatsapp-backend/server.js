require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, db } = require('./db');
const { handleConversation } = require('./gemini-agent');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders: function (res, path, stat) {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// =====================================================================
// WHATSAPP API & WEBHOOK
// =====================================================================

// Helper to send message via WhatsApp Cloud API
async function sendWhatsAppMessage(to, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp API] Advertencia: Faltan credenciales de WhatsApp (WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID).');
    return null;
  }

  // Clean Mexican numbers: convert 521XXXXXXXXXX to 52XXXXXXXXXX
  let cleanTo = to;
  if (to.startsWith('521') && to.length === 13) {
    cleanTo = '52' + to.substring(3);
  }

  const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'text',
    text: {
      body: text
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[WhatsApp API] Error al enviar mensaje:', data);
    } else {
      console.log('[WhatsApp API] Mensaje enviado con éxito a:', to, data);
    }
    return data;
  } catch (error) {
    console.error('[WhatsApp API] Error de red al enviar mensaje:', error);
    return null;
  }
}

// Handoff Timers memory map
const handoffTimers = new Map();

function scheduleHandoffTimeout(chatId) {
  if (handoffTimers.has(chatId)) {
    clearTimeout(handoffTimers.get(chatId));
  }

  const timer = setTimeout(async () => {
    try {
      const history = await db.getChatMessages(chatId);
      const lastMsg = history[history.length - 1];

      // If the last message is NOT from a human agent, send contingency message
      if (lastMsg && lastMsg.remitente !== 'humano') {
        const contingencyText = "¡Hola! Sigo aquí pendiente de tu cotización con la Master Estilista. Disculpa la pequeña demora, en un momento te damos la información detallada. 🌿✨";
        
        await db.saveMessage(chatId, 'bot', contingencyText);
        await sendWhatsAppMessage(chatId, contingencyText);
        console.log(`[Handoff Timeout] Mensaje de contingencia enviado a ${chatId}.`);
      }
    } catch (err) {
      console.error('Error en handoff timeout:', err);
    } finally {
      handoffTimers.delete(chatId);
    }
  }, 5 * 60 * 1000); // 5 minutes

  handoffTimers.set(chatId, timer);
}

// Helper to determine if the bot is eligible to answer
async function checkBotEligibility(chatId, messageText) {
  // 1. Always answer if it's an ad message
  const isAd = /nanoplastia/i.test(messageText) || /ipl/i.test(messageText) || /micropigmentacion|micropigmentación/i.test(messageText);
  if (isAd) return { shouldAnswer: true, isAd: true };

  // 2. Load history to check for first-time or 2 months inactivity
  const history = await db.getChatMessages(chatId);
  const clientMessages = history.filter(m => m.remitente === 'cliente');

  if (clientMessages.length === 0) {
    return { shouldAnswer: true, isAd: false, isFirstTime: true };
  }

  const lastClientMsg = clientMessages[clientMessages.length - 1];
  const lastMsgDate = new Date(lastClientMsg.fecha_hora);
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  if (lastMsgDate < twoMonthsAgo) {
    return { shouldAnswer: true, isAd: false, isInactive: true };
  }

  return { shouldAnswer: false, isAd: false };
}

// Background job for Anti-Ghosting (checks every 1 hour)
setInterval(async () => {
  try {
    const chats = await db.getChats();
    const now = new Date();

    for (const chat of chats) {
      if (chat.bot_activo) {
        const history = await db.getChatMessages(chat.chat_id_whatsapp);
        if (history.length > 0) {
          const lastMsg = history[history.length - 1];
          const lastMsgTime = new Date(lastMsg.fecha_hora);
          const diffHours = (now - lastMsgTime) / (1000 * 60 * 60);

          const ghostMessage = "¡Hola, hermosa! 🌿 Pasaba a saludarte y ver si tenías alguna duda sobre tu cita en TOP GREEN. ✨ Nos encantaría consentirte. ¿Te gustaría ver nuestros horarios disponibles para esta semana? 📆";

          // If inactive for > 24 hours and the last message wasn't already the ghost message
          if (diffHours >= 24 && lastMsg.texto !== ghostMessage) {
            console.log(`[Anti-Ghosting] Enviando resucitación (/ghost-beauty) a ${chat.chat_id_whatsapp}`);
            await db.saveMessage(chat.chat_id_whatsapp, 'bot', ghostMessage);
            await sendWhatsAppMessage(chat.chat_id_whatsapp, ghostMessage);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error en job de Anti-Ghosting:', err);
  }
}, 60 * 60 * 1000);

app.post('/webhook/whatsapp', async (req, res) => {
  // 1. Check if it is a real webhook payload from Meta
  if (req.body.object === 'whatsapp_business_account') {
    try {
      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messageObj = value?.messages?.[0];

      // Meta sends status updates (sent, delivered, read) without messages. Ignore those.
      if (!messageObj) {
        return res.sendStatus(200);
      }

      const chatId = messageObj.from;
      let messageText = '';
      const isMedia = messageObj.type === 'image' || messageObj.type === 'video';

      if (isMedia) {
        messageText = '[Archivo multimedia recibido]';
      } else if (messageObj.type === 'text') {
        messageText = messageObj.text?.body;
      } else if (messageObj.type === 'interactive') {
        const interactive = messageObj.interactive;
        if (interactive.type === 'button_reply') {
          messageText = interactive.button_reply?.title;
        } else if (interactive.type === 'list_reply') {
          messageText = interactive.list_reply?.title;
        }
      }

      if (!messageText) {
        console.log(`[WhatsApp Webhook] Mensaje recibido sin texto interpretable (tipo: ${messageObj.type}).`);
        return res.sendStatus(200);
      }

      const contact = value?.contacts?.[0];
      const clienteNombre = contact?.profile?.name || 'Cliente WhatsApp';

      console.log(`[WhatsApp Webhook] Mensaje real de ${clienteNombre} (${chatId}): "${messageText}"`);

      // 1. Get or create chat control
      const chat = await db.checkOrCreateChat(chatId, clienteNombre);
      let botActivo = chat.bot_activo;

      // 2. Media Handoff Logic (Flow A Paso 3)
      if (botActivo && isMedia) {
        console.log(`[Media Handoff] Cliente ${chatId} envió archivo. Activando Handoff.`);
        await db.toggleBot(chatId, false);
        await db.saveMessage(chatId, 'cliente', '📷 [Foto/Video enviado]');

        const transitionText = "¡Recibida! Precioso cabello ✨. En este momento se la estoy pasando a nuestra Master Estilista para que revise tu estructura capilar y me dé tu cotización exacta con un regalo especial. Te respondo en menos de 3 minutos. No te vayas ⏱️.";
        await db.saveMessage(chatId, 'bot', transitionText);
        await sendWhatsAppMessage(chatId, transitionText);

        // Schedule the 5-minute timeout for agent response
        scheduleHandoffTimeout(chatId);

        return res.sendStatus(200);
      }

      // 3. Bot Eligibility Verification
      if (botActivo) {
        const eligibility = await checkBotEligibility(chatId, messageText);
        if (!eligibility.shouldAnswer) {
          console.log(`[Eligibility] Cliente recurrente activo y sin anuncio para ${chatId}. Desactivando bot.`);
          await db.toggleBot(chatId, false);
          botActivo = false;
        }
      }

      // 4. Hybrid Routing Logic
      if (!botActivo) {
        console.log(`[Hybrid Logic] Bot inactivo para ${chatId}. Mensaje registrado para atención humana.`);
        await db.saveMessage(chatId, 'cliente', messageText);
        return res.sendStatus(200);
      }

      // 5. Process with Gemini Elena
      console.log(`[Hybrid Logic] Bot activo para ${chatId}. Procesando mensaje con Elena.`);
      const reply = await handleConversation(chatId, messageText);

      // Send the reply back to the real user via Meta API
      await sendWhatsAppMessage(chatId, reply);

      return res.sendStatus(200);
    } catch (error) {
      console.error('Error al procesar webhook real de WhatsApp:', error);
      return res.sendStatus(500);
    }
  }

  // 2. Fallback to simulator format
  const { chatId, message, clienteNombre } = req.body;

  if (!chatId || !message) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios: chatId, message' });
  }

  try {
    const chat = await db.checkOrCreateChat(chatId, clienteNombre);
    let botActivo = chat.bot_activo;

    const isSimulatedMedia = message.startsWith('[IMAGEN]') || message.startsWith('[VIDEO]') || message.startsWith('[FOTO]');

    if (botActivo && isSimulatedMedia) {
      console.log(`[Media Handoff Sim] Cliente ${chatId} envió archivo simulado. Activando Handoff.`);
      await db.toggleBot(chatId, false);
      await db.saveMessage(chatId, 'cliente', '📷 [Foto/Video enviado]');

      const transitionText = "¡Recibida! Precioso cabello ✨. En este momento se la estoy pasando a nuestra Master Estilista para que revise tu estructura capilar y me dé tu cotización exacta con un regalo especial. Te respondo en menos de 3 minutos. No te vayas ⏱️.";
      await db.saveMessage(chatId, 'bot', transitionText);

      scheduleHandoffTimeout(chatId);

      return res.json({
        status: 'handoff_triggered',
        reply: transitionText
      });
    }

    if (botActivo) {
      const eligibility = await checkBotEligibility(chatId, message);
      if (!eligibility.shouldAnswer) {
        console.log(`[Eligibility Sim] Cliente recurrente activo y sin anuncio para ${chatId}. Desactivando bot.`);
        await db.toggleBot(chatId, false);
        botActivo = false;
      }
    }

    if (!botActivo) {
      console.log(`[Hybrid Logic Sim] Bot inactivo para ${chatId}. Mensaje registrado para atención humana.`);
      await db.saveMessage(chatId, 'cliente', message);
      return res.json({ 
        status: 'ignored_by_bot', 
        message: 'Bot inactivo para este chat. Mensaje registrado para atención humana.' 
      });
    }

    console.log(`[Hybrid Logic Sim] Bot activo para ${chatId}. Procesando mensaje con Elena.`);
    const reply = await handleConversation(chatId, message);

    return res.json({
      status: 'processed_by_bot',
      reply: reply
    });

  } catch (error) {
    console.error('Error en webhook/whatsapp (simulador):', error);
    return res.status(500).json({ error: 'Error al procesar el mensaje en el servidor.' });
  }
});

app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'topgreen_token')) {
      console.log('Webhook verificado con éxito.');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }
  return res.send('TOP GREEN Webhook Simulator Endpoint');
});

// Lightweight ping endpoint for uptime monitors / keep-alive crons
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

// =====================================================================
// CRM FRONTEND API ROUTES
// =====================================================================

// Get database status
app.get('/api/db-status', (req, res) => {
  res.json({
    storage: db.isFallback() ? 'JSON Fallback (Volatile/Ephemeral)' : 'PostgreSQL (Persistent)',
    configured: !!process.env.DATABASE_URL,
    port: process.env.DATABASE_URL ? (process.env.DATABASE_URL.match(/:(\d+)\//)?.[1] || 'default') : null
  });
});

// Get all chats
app.get('/api/chats', async (req, res) => {
  try {
    const chats = await db.getChats();
    res.json(chats);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ error: 'Error al obtener chats.' });
  }
});

// Get message history
app.get('/api/chats/:chatId/messages', async (req, res) => {
  const { chatId } = req.params;
  try {
    const messages = await db.getChatMessages(chatId);
    res.json(messages);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error al obtener mensajes.' });
  }
});

// Toggle Bot Active status
app.post('/api/chats/:chatId/toggle-bot', async (req, res) => {
  const { chatId } = req.params;
  const { bot_activo } = req.body;

  if (bot_activo === undefined) {
    return res.status(400).json({ error: 'Falta campo bot_activo.' });
  }

  try {
    const chat = await db.toggleBot(chatId, bot_activo);
    if (!chat) {
      return res.status(404).json({ error: 'Chat no encontrado.' });
    }
    res.json(chat);
  } catch (error) {
    console.error('Error al cambiar bot_activo:', error);
    res.status(500).json({ error: 'Error al actualizar estado del bot.' });
  }
});

// Send a manual message from support
app.post('/api/chats/:chatId/send-message', async (req, res) => {
  const { chatId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Falta el mensaje.' });
  }

  // Clear 5-minute handoff timeout if human agent replies
  if (handoffTimers.has(chatId)) {
    clearTimeout(handoffTimers.get(chatId));
    handoffTimers.delete(chatId);
  }

  let finalMessage = message;
  if (message.trim() === '/ghost-beauty') {
    finalMessage = "¡Hola, hermosa! 🌿 Pasaba a saludarte y ver si tenías alguna duda sobre tu cita en TOP GREEN. ✨ Nos encantaría consentirte. ¿Te gustaría ver nuestros horarios disponibles para esta semana? 📆";
  }

  try {
    const savedMsg = await db.saveMessage(chatId, 'humano', finalMessage);

    // If it's a numeric chatId (real WhatsApp phone number format), send via WhatsApp API
    if (/^\d+$/.test(chatId) && process.env.WHATSAPP_ACCESS_TOKEN) {
      await sendWhatsAppMessage(chatId, finalMessage);
    }

    res.json(savedMsg);
  } catch (error) {
    console.error('Error al enviar mensaje manual:', error);
    res.status(500).json({ error: 'Error al registrar mensaje.' });
  }
});

// Get all appointments
app.get('/api/citas', async (req, res) => {
  try {
    const appointments = await db.getAppointments();
    res.json(appointments);
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({ error: 'Error al obtener citas.' });
  }
});

// Update appointment status (confirm/cancel/upload receipt link)
app.post('/api/citas/:id/update-status', async (req, res) => {
  const { id } = req.params;
  const { estado, link_comprobante } = req.body;

  try {
    const cita = await db.updateAppointment(id, { estado, link_comprobante });
    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }
    res.json(cita);
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({ error: 'Error al actualizar la cita.' });
  }
});

// Update appointment details generally
app.post('/api/citas/:id/update', async (req, res) => {
  const { id } = req.params;
  try {
    const cita = await db.updateAppointment(id, req.body);
    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }
    res.json(cita);
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({ error: 'Error al actualizar la cita.' });
  }
});

// Get list of stylists
app.get('/api/estilistas', async (req, res) => {
  try {
    const stylists = await db.getStylists();
    res.json(stylists);
  } catch (error) {
    console.error('Error al obtener estilistas:', error);
    res.status(500).json({ error: 'Error al obtener estilistas.' });
  }
});

// Get list of services
app.get('/api/servicios', async (req, res) => {
  try {
    const services = await db.getServices();
    res.json(services);
  } catch (error) {
    console.error('Error al obtener servicios:', error);
    res.status(500).json({ error: 'Error al obtener servicios.' });
  }
});

// Get list of inventory
app.get('/api/inventario', async (req, res) => {
  try {
    const inv = await db.getInventory();
    res.json(inv);
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error al obtener inventario.' });
  }
});

// Update inventory stock item
app.post('/api/inventario/update', async (req, res) => {
  const { key_name, stock } = req.body;
  try {
    const item = await db.updateInventoryItem(key_name, stock);
    res.json(item);
  } catch (error) {
    console.error('Error al actualizar inventario:', error);
    res.status(500).json({ error: 'Error al actualizar inventario.' });
  }
});

// Get payroll
app.get('/api/nomina', async (req, res) => {
  try {
    const payroll = await db.getPayroll();
    res.json(payroll);
  } catch (error) {
    console.error('Error al obtener nomina:', error);
    res.status(500).json({ error: 'Error al obtener nomina.' });
  }
});

// Add payroll item
app.post('/api/nomina/create', async (req, res) => {
  const { stylist, service, amount, commission, type, date, cita_id } = req.body;
  try {
    const item = await db.addPayrollItem({ stylist, service, amount, commission, type, date, cita_id });
    res.json(item);
  } catch (error) {
    console.error('Error al registrar nomina:', error);
    res.status(500).json({ error: 'Error al registrar nomina.' });
  }
});

// Get system logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db.getSystemLogs();
    res.json(logs);
  } catch (error) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({ error: 'Error al obtener logs.' });
  }
});

// Add system log
app.post('/api/logs/create', async (req, res) => {
  const { username, txt } = req.body;
  try {
    const log = await db.addSystemLog(username, txt);
    res.json(log);
  } catch (error) {
    console.error('Error al registrar log:', error);
    res.status(500).json({ error: 'Error al registrar log.' });
  }
});

// Create custom appointment
app.post('/api/citas/create', async (req, res) => {
  const { customer, service, duration, cost, status, formula, stylist, date, hour, phone } = req.body;
  try {
    const app = await db.createAppointment({ customer, service, duration: Number(duration), cost: Number(cost), status, formula, stylist, date, hour, phone });
    res.json(app);
  } catch (error) {
    console.error('Error al crear cita:', error);
    res.status(500).json({ error: 'Error al crear cita.' });
  }
});

// Delete appointment
app.delete('/api/citas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const exito = await db.deleteAppointment(id);
    res.json(exito);
  } catch (error) {
    console.error('Error al eliminar cita:', error);
    res.status(500).json({ error: 'Error al eliminar cita.' });
  }
});

// Update service price base tariff
app.post('/api/servicios/update', async (req, res) => {
  const { id, price } = req.body;
  try {
    const svc = await db.updateServicePrice(id, price);
    res.json(svc);
  } catch (error) {
    console.error('Error al actualizar tarifa:', error);
    res.status(500).json({ error: 'Error al actualizar tarifa.' });
  }
});

// Initialize database and start server
initDb().then(() => {
  app.listen(port, () => {
    console.log(`TOP GREEN Backend listening at http://localhost:${port}`);
  });
});
