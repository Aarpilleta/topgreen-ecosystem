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
// WHATSAPP WEBHOOK EMULATOR
// =====================================================================

app.post('/webhook/whatsapp', async (req, res) => {
  const { chatId, message, clienteNombre } = req.body;

  if (!chatId || !message) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios: chatId, message' });
  }

  try {
    // 1. Get or create chat control
    const chat = await db.checkOrCreateChat(chatId, clienteNombre);
    const botActivo = chat.bot_activo;

    // 2. Hybrid Routing Logic
    if (!botActivo) {
      console.log(`[Hybrid Logic] Bot inactivo para ${chatId}. Mensaje registrado para atención humana.`);
      
      // Save client message to DB/fallback
      await db.saveMessage(chatId, 'cliente', message);

      return res.json({ 
        status: 'ignored_by_bot', 
        message: 'Bot inactivo para este chat. Mensaje registrado para atención humana.' 
      });
    }

    // 3. Bot is active, process with Gemini Agent
    console.log(`[Hybrid Logic] Bot activo para ${chatId}. Procesando mensaje con Elena.`);
    const reply = await handleConversation(chatId, message);

    return res.json({
      status: 'processed_by_bot',
      reply: reply
    });

  } catch (error) {
    console.error('Error en webhook/whatsapp:', error);
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

// =====================================================================
// CRM FRONTEND API ROUTES
// =====================================================================

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

  try {
    const savedMsg = await db.saveMessage(chatId, 'humano', message);
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
  const { stylist, service, amount, commission, type, date } = req.body;
  try {
    const item = await db.addPayrollItem({ stylist, service, amount, commission, type, date });
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
  const { customer, service, duration, cost, status, formula, stylist, date, hour } = req.body;
  try {
    const app = await db.createAppointment({ customer, service, duration: Number(duration), cost: Number(cost), status, formula, stylist, date, hour });
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
