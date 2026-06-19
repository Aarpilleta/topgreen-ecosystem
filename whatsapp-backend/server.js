require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, db } = require('./db');
const { handleConversation } = require('./gemini-agent');
const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { useDbAuthState } = require('./db-auth');
const pino = require('pino');
const QRCode = require('qrcode');


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
// WHATSAPP API & WEBHOOK (QR-BASED BAILEYS SOCKET)
// =====================================================================

let sock = null;
let qrCodeImage = null;
let connectionState = 'connecting'; // 'connecting', 'qr', 'connected'

// Handoff Timers memory map
const handoffTimers = new Map();

function isOutsideBusinessHours() {
  const options = { timeZone: 'America/Mexico_City', hour12: false };
  const dateInMx = new Date(new Date().toLocaleString('en-US', options));
  const day = dateInMx.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hour = dateInMx.getHours();
  const minutes = dateInMx.getMinutes();
  const timeDecimal = hour + (minutes / 60);

  let openTime = 11.0;
  const closeTime = 20.0;

  if (day === 5 || day === 6) { // Friday or Saturday
    openTime = 9.5; // 9:30 AM
  }

  return (timeDecimal < openTime || timeDecimal >= closeTime);
}

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
        const outside = isOutsideBusinessHours();
        let contingencyText;
        if (outside) {
          contingencyText = "¡Hola! Sigo aquí pendiente de tu cotización con la Master Estilista. 🌿\n\nComo estamos fuera de nuestro horario de servicio, te daremos tu cotización a primera hora en cuanto abramos. ✨\n\n🕒 *Horario de atención:*\n📅 Lunes a Jueves — 11:00 am a 8:00 pm\n📅 Viernes y Sábado — 9:30 am a 8:00 pm\n📅 Domingo — 11:00 am a 8:00 pm\n\n¡Gracias por tu paciencia! 💖";
        } else {
          contingencyText = "¡Hola! Sigo aquí pendiente de tu cotización con la Master Estilista. Disculpa la pequeña demora, en un momento te damos la información detallada. 🌿✨";
        }
        
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

// Helper to send message via WhatsApp JID using Baileys socket client
async function sendWhatsAppMessage(to, text) {
  if (!sock || connectionState !== 'connected') {
    console.warn('[WhatsApp Socket] No conectado a WhatsApp. Mensaje no enviado.');
    return null;
  }

  // Clean Mexican numbers: convert 521XXXXXXXXXX to 52XXXXXXXXXX
  let cleanTo = to;
  if (to.startsWith('521') && to.length === 13) {
    cleanTo = '52' + to.substring(3);
  }

  const jid = `${cleanTo}@s.whatsapp.net`;

  try {
    const response = await sock.sendMessage(jid, { text: text });
    console.log('[WhatsApp Socket] Mensaje enviado con éxito a:', cleanTo);
    return response;
  } catch (error) {
    console.error('[WhatsApp Socket] Error al enviar mensaje:', error);
    return null;
  }
}

// Main socket initialization and event loop
async function connectToWhatsApp() {
  console.log('[WhatsApp Socket] Inicializando socket...');
  const logger = pino({ level: 'silent' });
  
  try {
    const { state, saveCreds } = await useDbAuthState(db);

    let version;
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
      console.log(`[WhatsApp Socket] Conectando con versión de WA Web v${version.join('.')}`);
    } catch (err) {
      console.warn('[WhatsApp Socket] No se pudo obtener la última versión de WA Web de Baileys, usando default:', err.message);
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionState = 'qr';
        try {
          qrCodeImage = await QRCode.toDataURL(qr);
          console.log('[WhatsApp Socket] Nuevo código QR generado.');
        } catch (err) {
          console.error('[WhatsApp Socket] Error generating QR code:', err);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('[WhatsApp Socket] Conexión cerrada. Reintentando reconnect:', shouldReconnect, lastDisconnect.error);
        connectionState = 'connecting';
        qrCodeImage = null;
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp Socket] ¡WhatsApp conectado y autenticado exitosamente!');
        connectionState = 'connected';
        qrCodeImage = null;
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;
        if (!msg.key.remoteJid || !msg.key.remoteJid.endsWith('@s.whatsapp.net')) continue;

        const chatId = msg.key.remoteJid.split('@')[0];
        const clienteNombre = msg.pushName || 'Cliente WhatsApp';

        let messageText = '';
        const isMedia = msg.message?.imageMessage || msg.message?.videoMessage;

        if (isMedia) {
          messageText = '[Archivo multimedia recibido]';
        } else if (msg.message?.conversation) {
          messageText = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageText = msg.message.extendedTextMessage.text;
        } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
          messageText = msg.message.buttonsResponseMessage.selectedButtonId;
        } else if (msg.message?.listResponseMessage?.title) {
          messageText = msg.message.listResponseMessage.title;
        }

        if (!messageText) continue;

        console.log(`[WhatsApp Socket] Mensaje de ${clienteNombre} (${chatId}): "${messageText}"`);

        // 1. Get or create chat control
        const chat = await db.checkOrCreateChat(chatId, clienteNombre);
        let botActivo = chat.bot_activo;

        // 2. Media Handoff Logic (Flow A Paso 3)
        if (botActivo && isMedia) {
          console.log(`[Media Handoff] Cliente ${chatId} envió archivo. Activando Handoff.`);
          await db.toggleBot(chatId, false);
          await db.saveMessage(chatId, 'cliente', '📷 [Foto/Video enviado]');

          const outside = isOutsideBusinessHours();
          let transitionText;
          if (outside) {
            transitionText = "¡Recibida! Precioso cabello ✨. En este momento se la estoy pasando a nuestra Master Estilista para que revise tu estructura capilar.\n\nComo estamos fuera de nuestro horario de servicio, te daremos tu cotización a primera hora en cuanto abramos. 🌿\n\n🕒 *Horario de atención:*\n📅 Lunes a Jueves — 11:00 am a 8:00 pm\n📅 Viernes y Sábado — 9:30 am a 8:00 pm\n📅 Domingo — 11:00 am a 8:00 pm\n\n¡Gracias por tu paciencia! 💖";
          } else {
            transitionText = "¡Recibida! Precioso cabello ✨. En este momento se la estoy pasando a nuestra Master Estilista para que revise tu estructura capilar y me dé tu cotización exacta con un regalo especial. Te respondo en menos de 3 minutos. No te vayas ⏱️.";
            scheduleHandoffTimeout(chatId);
          }
          await db.saveMessage(chatId, 'bot', transitionText);
          await sendWhatsAppMessage(chatId, transitionText);
          continue;
        }

        // 3. Bot Eligibility Verification
        if (botActivo) {
          const eligibility = await checkBotEligibility(chatId, messageText);
          if (!eligibility.shouldAnswer) {
            console.log(`[Eligibility] Cliente recurrente activo y sin anuncio para ${chatId}. Desactivando bot.`);
            await db.toggleBot(chatId, false);
            botActivo = false;
            
            const handoffMsg = "Gracias por tu mensaje. 🌿 En este momento no podemos responder de forma directa, pero lo haremos lo antes posible. ✨\n\n🕒 *Horario de atención del salón:*\n📅 Lunes a Jueves — 11:00 am a 8:00 pm\n📅 Viernes y Sábado — 9:30 am a 8:00 pm\n📅 Domingo — 11:00 am a 8:00 pm\n\n¡En un momento un asesor continuará tu atención! 💖";
            await db.saveMessage(chatId, 'bot', handoffMsg);
            await sendWhatsAppMessage(chatId, handoffMsg);
          }
        }

        // 4. Hybrid Routing Logic
        if (!botActivo) {
          console.log(`[Hybrid Logic] Bot inactivo para ${chatId}. Mensaje registrado para atención humana.`);
          await db.saveMessage(chatId, 'cliente', messageText);
          continue;
        }

        // 5. Process with Gemini Elena
        console.log(`[Hybrid Logic] Bot activo para ${chatId}. Procesando mensaje con Elena.`);
        const reply = await handleConversation(chatId, messageText);

        // Send the reply back to the real user JID
        await sendWhatsAppMessage(chatId, reply);
      }
    });
  } catch (err) {
    console.error('[WhatsApp Socket] Fallo crítico al conectar:', err);
    connectionState = 'connecting';
    setTimeout(connectToWhatsApp, 5000);
  }
}

// Anti-Ghosting: DESACTIVADO como job automático.
// El mensaje de reactivación solo se envía MANUALMENTE desde el dashboard
// usando el comando /ghost-beauty en el panel de soporte humano.

// Simulator support endpoint (Dashboard client test tab)
app.post('/webhook/whatsapp', async (req, res) => {
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

// QR and WhatsApp state API routes
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: connectionState,
    qr: !!qrCodeImage
  });
});

app.get('/api/whatsapp/qr', (req, res) => {
  if (connectionState === 'qr' && qrCodeImage) {
    res.json({ qr: qrCodeImage });
  } else {
    res.json({ qr: null, status: connectionState });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
    }
    // Delete session auth data
    if (db.isFallback()) {
      const data = loadFallback();
      data.whatsapp_auth = {};
      saveFallback(data);
    } else {
      await pool.query('TRUNCATE TABLE whatsapp_auth');
    }
    connectionState = 'connecting';
    qrCodeImage = null;
    res.json({ exito: true });
  } catch (err) {
    console.error('Error disconnecting:', err);
    res.status(500).json({ error: 'Error al desconectar WhatsApp.' });
  }
});

app.get('/webhook/whatsapp', (req, res) => {
  return res.send('TOP GREEN Webhook QR Simulator Endpoint');
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

// Process a pending/unread chat manually — runs eligibility check on last client message
app.post('/api/chats/:chatId/process-pending', async (req, res) => {
  const { chatId } = req.params;

  try {
    const history = await db.getChatMessages(chatId);
    const clientMessages = history.filter(m => m.remitente === 'cliente');

    if (clientMessages.length === 0) {
      return res.status(400).json({ error: 'No hay mensajes del cliente para procesar.' });
    }

    const lastClientMsg = clientMessages[clientMessages.length - 1];
    const msgAge = (Date.now() - new Date(lastClientMsg.fecha_hora)) / (1000 * 60 * 60);
    if (msgAge > 24) {
      return res.status(400).json({ error: 'El último mensaje tiene más de 24 horas. No se procesará.' });
    }
    const messageText = lastClientMsg.texto;

    const eligibility = await checkBotEligibility(chatId, messageText);

    if (eligibility.shouldAnswer) {
      // Activate bot and let Elena respond
      await db.toggleBot(chatId, true);
      const reply = await handleConversation(chatId, messageText);
      await sendWhatsAppMessage(chatId, reply);
      console.log(`[Process Pending] Elena respondió a ${chatId}: "${reply.substring(0, 60)}..."`);
      return res.json({ status: 'responded_by_bot', reply });
    } else {
      // Not eligible — send polite fallback and hand off to human
      const fallback = "Gracias por tu mensaje. 🌿 En este momento no podemos responder de forma directa, pero lo haremos lo antes posible. ✨\n\n🕒 *Horario de atención del salón:*\n📅 Lunes a Jueves — 11:00 am a 8:00 pm\n📅 Viernes y Sábado — 9:30 am a 8:00 pm\n📅 Domingo — 11:00 am a 8:00 pm\n\n¡En un momento un asesor continuará tu atención! 💖";
      await db.saveMessage(chatId, 'bot', fallback);
      await sendWhatsAppMessage(chatId, fallback);
      await db.toggleBot(chatId, false);
      console.log(`[Process Pending] Fallback enviado a ${chatId}. Bot desactivado para atención humana.`);
      return res.json({ status: 'fallback_sent', reply: fallback });
    }
  } catch (error) {
    console.error('Error procesando chat pendiente:', error);
    res.status(500).json({ error: 'Error al procesar chat pendiente.' });
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
    if (/^\d+$/.test(chatId)) {
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
  const { stylist, service, amount, commission, type, date, cita_id, propina } = req.body;
  try {
    const item = await db.addPayrollItem({ stylist, service, amount, commission, type, date, cita_id, propina });
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
    connectToWhatsApp();
  });
});
