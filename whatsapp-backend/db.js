const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;
let useFallback = true;
const fallbackPath = path.join(__dirname, 'db_fallback.json');

// Default initial seed data for fallback
const initialData = {
  servicios: [
    { id: 1, nombre: 'Nanoplastia Premium', duracion_minutos: 300, precio_fijo: 3200.00 },
    { id: 2, nombre: 'Balayage Premium', duracion_minutos: 300, precio_fijo: 2100.00 },
    { id: 3, nombre: 'Corte Premium', duracion_minutos: 60, precio_fijo: 800.00 },
    { id: 4, nombre: 'Tinte de Cobertura', duracion_minutos: 120, precio_fijo: 1200.00 },
    { id: 5, nombre: 'Botox Capilar', duracion_minutos: 90, precio_fijo: 850.00 },
    { id: 6, nombre: 'Depilación IPL', duracion_minutos: 60, precio_fijo: 3200.00 },
    { id: 7, nombre: 'Uñas', duracion_minutos: 90, precio_fijo: 400.00 },
    { id: 8, nombre: 'Pestañas', duracion_minutos: 90, precio_fijo: 600.00 },
    { id: 9, nombre: 'Lifting', duracion_minutos: 60, precio_fijo: 500.00 },
    { id: 10, nombre: 'Maquillaje', duracion_minutos: 60, precio_fijo: 1200.00 },
    { id: 11, nombre: 'Microblading', duracion_minutos: 180, precio_fijo: 4800.00 },
    { id: 12, nombre: 'Micropigmentación', duracion_minutos: 180, precio_fijo: 5500.00 }
  ],
  estilistas: [
    { id: 1, nombre: 'Pili', especialidades: ['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Botox Capilar'], color: '#10b981', activo: true },
    { id: 2, nombre: 'Joel', especialidades: ['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Botox Capilar'], color: '#3b82f6', activo: true },
    { id: 3, nombre: 'Rose', especialidades: ['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Depilación IPL', 'Pestañas', 'Lifting', 'Maquillaje', 'Botox Capilar'], color: '#a855f7', activo: true },
    { id: 4, nombre: 'Majo', especialidades: ['Uñas', 'Pestañas'], color: '#ec4899', activo: true },
    { id: 5, nombre: 'Cande', especialidades: ['Uñas'], color: '#f43f5e', activo: true },
    { id: 6, nombre: 'Judith', especialidades: ['Uñas'], color: '#f59e0b', activo: true },
    { id: 7, nombre: 'Laura', especialidades: ['Uñas'], color: '#14b8a6', activo: true },
    { id: 8, nombre: 'Lizbeth', especialidades: ['Microblading', 'Micropigmentación'], color: '#d97706', activo: true },
    { id: 9, nombre: 'Fran', especialidades: ['Corte Premium'], color: '#6366f1', activo: true }
  ],
  inventario: [
    { key_name: 'nanoplastia_elixir', nombre: 'Elixir Nanoplastia (ml)', stock: 1500, min: 500, cost_per_unit: 1.50, price: null, item_type: 'insumo' },
    { key_name: 'jade_tinte', nombre: 'Tinte Jade Green (g)', stock: 380, min: 300, cost_per_unit: 4.00, price: null, item_type: 'insumo' },
    { key_name: 'shampoo_retail', nombre: 'Shampoo Jade Protect (Pzs)', stock: 12, min: 4, cost_per_unit: 200.00, price: 450.00, item_type: 'retail' },
    { key_name: 'mask_retail', nombre: 'Mascarilla Menta (Pzs)', stock: 2, min: 3, cost_per_unit: 300.00, price: 680.00, item_type: 'retail' }
  ],
  nomina: [],
  logs: [
    { time: '14:42:00', username: 'SYSTEM', txt: 'Ecosistema operativo TOP GREEN v2.5 activo.' },
    { time: '14:45:10', username: 'SYSTEM', txt: 'Conexión a pasarela comercial activa y verificada.' },
    { time: '14:48:02', username: 'Tony', txt: 'Almacén auditado. Alerta de stock bajo en Mascarilla Menta activada.' }
  ],
  control_chats: [
    { chat_id_whatsapp: '5215512345678', nombre_cliente: 'Carlos Mendoza', bot_activo: true, zona_geografica: 'CDMX - Polanco' },
    { chat_id_whatsapp: '5215587654321', nombre_cliente: 'Maria Delgado', bot_activo: false, zona_geografica: 'CDMX - Condesa' }
  ],
  citas: [],
  mensajes: [
    { id: 1, chat_id_whatsapp: '5215512345678', remitente: 'cliente', texto: 'Hola, quiero agendar un servicio', fecha_hora: new Date(Date.now() - 600000).toISOString() },
    { id: 2, chat_id_whatsapp: '5215512345678', remitente: 'bot', texto: '¡Hola Carlos! Soy Elena, asistente de TOP GREEN. ¿En qué colonia o CP te encuentras para verificar nuestra cobertura?', fecha_hora: new Date(Date.now() - 540000).toISOString() },
    { id: 3, chat_id_whatsapp: '5215512345678', remitente: 'cliente', texto: 'CP 11560 Polanco', fecha_hora: new Date(Date.now() - 480000).toISOString() },
    { id: 4, chat_id_whatsapp: '5215512345678', remitente: 'bot', texto: 'Excelente, Polanco está dentro de nuestra zona de cobertura. ¿Qué servicio te gustaría agendar? Ofrecemos Nanoplastia Premium, Corte Premium y Nanopore.', fecha_hora: new Date(Date.now() - 420000).toISOString() }
  ]
};

// Load or save fallback data
function loadFallback() {
  if (!fs.existsSync(fallbackPath)) {
    fs.writeFileSync(fallbackPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const raw = fs.readFileSync(fallbackPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading fallback JSON, resetting database...', err);
    return initialData;
  }
}

function saveFallback(data) {
  fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2));
}

// Initialize Database connection/fallback
async function initDb() {
  if (process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
      });
      // Check query
      await pool.query('SELECT NOW()');
      console.log('PostgreSQL database connected successfully. Using SQL storage.');
      
      // Auto-initialize schema if services table does not exist
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name = 'servicios'
        );
      `);
      if (!tableCheck.rows[0].exists) {
        console.log('Table "servicios" not found. Running schema.sql auto-initialization...');
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          await pool.query(schemaSql);
          console.log('Database tables successfully initialized from schema.sql.');
        } else {
          console.warn('schema.sql file not found at ' + schemaPath + '. Cannot auto-initialize.');
        }
      }
      
      useFallback = false;
    } catch (err) {
      console.warn('PostgreSQL connection failed. Falling back to local JSON file storage.\nError:', err.message);
      useFallback = true;
    }
  } else {
    console.log('No DATABASE_URL found in environment. Using local JSON file storage.');
    useFallback = true;
  }

  if (useFallback) {
    loadFallback();
  }
}

// Data access operations
const db = {
  // 1. Chats
  async checkOrCreateChat(chatId, clientName) {
    if (!useFallback) {
      const res = await pool.query(
        `SELECT bot_activo, nombre_cliente, zona_geografica FROM control_chats WHERE chat_id_whatsapp = $1`,
        [chatId]
      );
      if (res.rows.length === 0) {
        const nombre = clientName || `Cliente ${chatId.slice(-4)}`;
        const insertRes = await pool.query(
          `INSERT INTO control_chats (chat_id_whatsapp, nombre_cliente, bot_activo) 
           VALUES ($1, $2, true) 
           RETURNING chat_id_whatsapp, nombre_cliente, bot_activo, zona_geografica`,
          [chatId, nombre]
        );
        return insertRes.rows[0];
      }
      return res.rows[0];
    } else {
      const data = loadFallback();
      let chat = data.control_chats.find(c => c.chat_id_whatsapp === chatId);
      if (!chat) {
        chat = {
          chat_id_whatsapp: chatId,
          nombre_cliente: clientName || `Cliente ${chatId.slice(-4)}`,
          bot_activo: true,
          zona_geografica: ''
        };
        data.control_chats.push(chat);
        saveFallback(data);
      }
      return chat;
    }
  },

  async getChats() {
    if (!useFallback) {
      const res = await pool.query(`
        SELECT 
          c.chat_id_whatsapp,
          c.nombre_cliente,
          c.bot_activo,
          c.zona_geografica,
          (SELECT texto FROM mensajes WHERE chat_id_whatsapp = c.chat_id_whatsapp ORDER BY fecha_hora DESC LIMIT 1) as ultimo_mensaje,
          (SELECT fecha_hora FROM mensajes WHERE chat_id_whatsapp = c.chat_id_whatsapp ORDER BY fecha_hora DESC LIMIT 1) as ultimo_mensaje_fecha
        FROM control_chats c
        ORDER BY ultimo_mensaje_fecha DESC NULLS LAST
      `);
      return res.rows;
    } else {
      const data = loadFallback();
      return data.control_chats.map(chat => {
        const msgs = data.mensajes.filter(m => m.chat_id_whatsapp === chat.chat_id_whatsapp);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        return {
          ...chat,
          ultimo_mensaje: lastMsg ? lastMsg.texto : '',
          ultimo_mensaje_fecha: lastMsg ? lastMsg.fecha_hora : ''
        };
      }).sort((a, b) => new Date(b.ultimo_mensaje_fecha || 0) - new Date(a.ultimo_mensaje_fecha || 0));
    }
  },

  async toggleBot(chatId, active) {
    if (!useFallback) {
      const res = await pool.query(
        `UPDATE control_chats SET bot_activo = $1 WHERE chat_id_whatsapp = $2 RETURNING chat_id_whatsapp, nombre_cliente, bot_activo`,
        [active, chatId]
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      const chat = data.control_chats.find(c => c.chat_id_whatsapp === chatId);
      if (chat) {
        chat.bot_activo = active;
        saveFallback(data);
        return chat;
      }
      return null;
    }
  },

  async updateZone(chatId, zone) {
    if (!useFallback) {
      await pool.query(
        `UPDATE control_chats SET zona_geografica = $1 WHERE chat_id_whatsapp = $2`,
        [zone, chatId]
      );
    } else {
      const data = loadFallback();
      const chat = data.control_chats.find(c => c.chat_id_whatsapp === chatId);
      if (chat) {
        chat.zona_geografica = zone;
        saveFallback(data);
      }
    }
  },

  // 2. Messages
  async getChatMessages(chatId) {
    if (!useFallback) {
      const res = await pool.query(
        `SELECT id, remitente, texto, fecha_hora FROM mensajes WHERE chat_id_whatsapp = $1 ORDER BY fecha_hora ASC`,
        [chatId]
      );
      return res.rows;
    } else {
      const data = loadFallback();
      return data.mensajes.filter(m => m.chat_id_whatsapp === chatId).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
    }
  },

  async saveMessage(chatId, sender, text) {
    if (!useFallback) {
      const res = await pool.query(
        `INSERT INTO mensajes (chat_id_whatsapp, remitente, texto) VALUES ($1, $2, $3) RETURNING *`,
        [chatId, sender, text]
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      const newMsg = {
        id: data.mensajes.length + 1,
        chat_id_whatsapp: chatId,
        remitente: sender,
        texto: text,
        fecha_hora: new Date().toISOString()
      };
      data.mensajes.push(newMsg);
      saveFallback(data);
      return newMsg;
    }
  },

  // 3. Services & Stylists
  async getServiceDetails(name) {
    if (!useFallback) {
      const res = await pool.query(
        `SELECT id, nombre, duracion_minutos, precio_fijo FROM servicios WHERE LOWER(nombre) LIKE LOWER($1)`,
        [`%${name}%`]
      );
      return res.rows[0] || null;
    } else {
      const data = loadFallback();
      return data.servicios.find(s => s.nombre.toLowerCase().includes(name.toLowerCase())) || null;
    }
  },

  async getServiceById(id) {
    if (!useFallback) {
      const res = await pool.query(`SELECT nombre, duracion_minutos, precio_fijo FROM servicios WHERE id = $1`, [id]);
      return res.rows[0] || null;
    } else {
      const data = loadFallback();
      return data.servicios.find(s => s.id === Number(id)) || null;
    }
  },

  async getServices() {
    if (!useFallback) {
      const res = await pool.query('SELECT id, nombre, duracion_minutos, precio_fijo FROM servicios ORDER BY nombre ASC');
      return res.rows;
    } else {
      const data = loadFallback();
      return [...data.servicios].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  },

  async getStylists() {
    if (!useFallback) {
      const res = await pool.query('SELECT id, nombre, especialidades, color, activo FROM estilistas ORDER BY nombre ASC');
      return res.rows;
    } else {
      const data = loadFallback();
      return data.estilistas.filter(s => s.activo);
    }
  },

  // 4. Appointments
  async getAppointments() {
    if (!useFallback) {
      const res = await pool.query(`
        SELECT 
          c.id,
          c.cliente_id,
          COALESCE(cc.nombre_cliente, c.cliente_id) AS nombre_cliente,
          c.estilista_id,
          e.nombre as estilista_nombre,
          c.servicio_id,
          s.nombre as servicio_nombre,
          s.precio_fijo,
          c.fecha_hora_inicio,
          c.fecha_hora_fin,
          c.estado,
          c.link_comprobante
        FROM citas c
        LEFT JOIN control_chats cc ON c.cliente_id = cc.chat_id_whatsapp
        LEFT JOIN estilistas e ON c.estilista_id = e.id
        LEFT JOIN servicios s ON c.servicio_id = s.id
        ORDER BY c.fecha_hora_inicio ASC
      `);
      return res.rows;
    } else {
      const data = loadFallback();
      return data.citas.map(cita => {
        const client = data.control_chats.find(c => c.chat_id_whatsapp === cita.cliente_id) || {};
        const stylist = data.estilistas.find(e => e.id === cita.estilista_id) || {};
        const service = data.servicios.find(s => s.id === cita.servicio_id) || {};
        return {
          id: cita.id,
          cliente_id: cita.cliente_id,
          nombre_cliente: client.nombre_cliente || cita.cliente_id,
          estilista_id: cita.estilista_id,
          estilista_nombre: stylist.nombre || 'Desconocido',
          servicio_id: cita.servicio_id,
          servicio_nombre: service.nombre || 'Desconocido',
          precio_fijo: service.precio_fijo || 0,
          fecha_hora_inicio: cita.fecha_hora_inicio,
          fecha_hora_fin: cita.fecha_hora_fin,
          estado: cita.estado,
          link_comprobante: cita.link_comprobante
        };
      }).sort((a, b) => new Date(a.fecha_hora_inicio) - new Date(b.fecha_hora_inicio));
    }
  },

  async getStylistAppointmentsOnDate(stylistId, dateStr) {
    if (!useFallback) {
      const res = await pool.query(
        `SELECT fecha_hora_inicio, fecha_hora_fin 
         FROM citas 
         WHERE estilista_id = $1 
           AND estado != 'cancelada' 
           AND (fecha_hora_inicio AT TIME ZONE 'America/Mexico_City')::date = $2::date
         ORDER BY fecha_hora_inicio ASC`,
        [stylistId, dateStr]
      );
      return res.rows;
    } else {
      const data = loadFallback();
      return data.citas
        .filter(c => c.estilista_id === Number(stylistId) && c.estado !== 'cancelada' && c.fecha_hora_inicio.startsWith(dateStr))
        .map(c => ({
          fecha_hora_inicio: c.fecha_hora_inicio,
          fecha_hora_fin: c.fecha_hora_fin
        }))
        .sort((a, b) => new Date(a.fecha_hora_inicio) - new Date(b.fecha_hora_inicio));
    }
  },

  async holdAppointment(clientId, stylistId, serviceId, startTimeIso) {
    if (!useFallback) {
      const res = await pool.query(
        `INSERT INTO citas (cliente_id, estilista_id, servicio_id, fecha_hora_inicio, estado)
         VALUES ($1, $2, $3, $4, 'anticipo_pendiente')
         RETURNING id, cliente_id, estilista_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado`,
        [clientId, stylistId, serviceId, startTimeIso]
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      const service = data.servicios.find(s => s.id === Number(serviceId));
      if (!service) throw new Error('Servicio no encontrado');
      
      const inicio = new Date(startTimeIso);
      const fin = new Date(inicio.getTime() + service.duracion_minutos * 60000);

      const newCita = {
        id: data.citas.length + 1,
        cliente_id: clientId,
        estilista_id: Number(stylistId),
        servicio_id: Number(serviceId),
        fecha_hora_inicio: inicio.toISOString(),
        fecha_hora_fin: fin.toISOString(),
        estado: 'anticipo_pendiente',
        link_comprobante: null
      };

      data.citas.push(newCita);
      saveFallback(data);
      return newCita;
    }
  },

  async updateAppointment(id, updateFields) {
    if (!useFallback) {
      let query = 'UPDATE citas SET ';
      const params = [];
      let paramIndex = 1;

      if (updateFields.estado !== undefined || updateFields.status !== undefined) {
        const val = updateFields.status !== undefined ? updateFields.status : updateFields.estado;
        query += `estado = $${paramIndex}, `;
        params.push(val === 'Cobrado' || val === 'confirmada' ? 'confirmada' : 'anticipo_pendiente');
        paramIndex++;
      }

      if (updateFields.link_comprobante !== undefined || updateFields.formula !== undefined) {
        const val = updateFields.formula !== undefined ? updateFields.formula : updateFields.link_comprobante;
        query += `link_comprobante = $${paramIndex}, `;
        params.push(val);
        paramIndex++;
      }

      if (updateFields.customer !== undefined) {
        query += `cliente_id = $${paramIndex}, `;
        params.push(updateFields.customer);
        paramIndex++;
      }

      if (updateFields.stylist !== undefined) {
        const styRes = await pool.query('SELECT id FROM estilistas WHERE nombre = $1', [updateFields.stylist]);
        const styId = styRes.rows.length > 0 ? styRes.rows[0].id : null;
        query += `estilista_id = $${paramIndex}, `;
        params.push(styId);
        paramIndex++;
      }

      if (updateFields.service !== undefined) {
        const svcRes = await pool.query('SELECT id FROM servicios WHERE nombre = $1', [updateFields.service]);
        const svcId = svcRes.rows.length > 0 ? svcRes.rows[0].id : null;
        query += `servicio_id = $${paramIndex}, `;
        params.push(svcId);
        paramIndex++;
      }

      if (updateFields.date !== undefined && updateFields.hour !== undefined) {
        const startTime = new Date(updateFields.date + 'T' + updateFields.hour + ':00-06:00');
        query += `fecha_hora_inicio = $${paramIndex}, `;
        params.push(startTime.toISOString());
        paramIndex++;
      }

      if (params.length === 0) {
        const current = await pool.query('SELECT * FROM citas WHERE id = $1', [id]);
        return current.rows[0] || null;
      }

      query = query.slice(0, -2); // remove trailing comma
      query += ` WHERE id = $${paramIndex} RETURNING *`;
      params.push(id);

      const res = await pool.query(query, params);
      return res.rows[0] || null;
    } else {
      const data = loadFallback();
      const cita = data.citas.find(c => c.id === Number(id));
      if (cita) {
        if (updateFields.estado !== undefined || updateFields.status !== undefined) {
          const val = updateFields.status !== undefined ? updateFields.status : updateFields.estado;
          cita.estado = (val === 'Cobrado' || val === 'confirmada' ? 'confirmada' : 'anticipo_pendiente');
        }
        if (updateFields.link_comprobante !== undefined || updateFields.formula !== undefined) {
          cita.link_comprobante = updateFields.formula !== undefined ? updateFields.formula : updateFields.link_comprobante;
        }
        if (updateFields.customer !== undefined) {
          cita.cliente_id = updateFields.customer;
        }
        if (updateFields.stylist !== undefined) {
          const sty = data.estilistas.find(e => e.nombre === updateFields.stylist);
          cita.estilista_id = sty ? sty.id : null;
        }
        if (updateFields.service !== undefined) {
          const svc = data.servicios.find(s => s.nombre === updateFields.service);
          cita.servicio_id = svc ? svc.id : null;
        }
        if (updateFields.date !== undefined && updateFields.hour !== undefined) {
          cita.fecha_hora_inicio = new Date(`${updateFields.date}T${updateFields.hour}:00-06:00`).toISOString();
          const svc = data.servicios.find(s => s.id === cita.servicio_id);
          const durationMin = svc ? svc.duracion_minutos : 60;
          cita.fecha_hora_fin = new Date(new Date(cita.fecha_hora_inicio).getTime() + durationMin * 60000).toISOString();
        }
        saveFallback(data);
        return cita;
      }
      return null;
    }
  },

  // 5. Inventory (Almacén)
  async getInventory() {
    if (!useFallback) {
      const res = await pool.query('SELECT key_name, nombre, stock, min, cost_per_unit, price, item_type FROM inventario ORDER BY nombre ASC');
      return res.rows;
    } else {
      const data = loadFallback();
      return data.inventario;
    }
  },

  async updateInventoryItem(keyName, stock) {
    if (!useFallback) {
      const res = await pool.query(
        'UPDATE inventario SET stock = $1 WHERE key_name = $2 RETURNING *',
        [stock, keyName]
      );
      return res.rows[0] || null;
    } else {
      const data = loadFallback();
      const item = data.inventario.find(i => i.key_name === keyName);
      if (item) {
        item.stock = Number(stock);
        saveFallback(data);
        return item;
      }
      return null;
    }
  },

  // 6. Payroll (Nómina)
  async getPayroll() {
    if (!useFallback) {
      const res = await pool.query('SELECT stylist, service, amount, commission, type, date FROM nomina ORDER BY id DESC');
      return res.rows;
    } else {
      const data = loadFallback();
      return data.nomina;
    }
  },

  async addPayrollItem(item) {
    if (!useFallback) {
      const res = await pool.query(
        'INSERT INTO nomina (stylist, service, amount, commission, type, date, cita_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [item.stylist, item.service, item.amount, item.commission, item.type, item.date, item.cita_id || null]
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      data.nomina.unshift(item);
      saveFallback(data);
      return item;
    }
  },

  // 7. System Logs (Ledger)
  async getSystemLogs() {
    if (!useFallback) {
      const res = await pool.query('SELECT time, username, txt FROM logs_sistema ORDER BY id DESC');
      return res.rows;
    } else {
      const data = loadFallback();
      return data.logs;
    }
  },

  async addSystemLog(username, txt) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    if (!useFallback) {
      const res = await pool.query(
        'INSERT INTO logs_sistema (time, username, txt) VALUES ($1, $2, $3) RETURNING *',
        [time, username, txt]
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      const newLog = { time, username, txt };
      data.logs.unshift(newLog);
      saveFallback(data);
      return newLog;
    }
  },

  // 8. Custom Appointment Control (Create & Delete)
  async createAppointment(app) {
    if (!useFallback) {
      const svcRes = await pool.query('SELECT id FROM servicios WHERE nombre = $1', [app.service]);
      const styRes = await pool.query('SELECT id FROM estilistas WHERE nombre = $1', [app.stylist]);
      
      const svcId = svcRes.rows.length > 0 ? svcRes.rows[0].id : null;
      const styId = styRes.rows.length > 0 ? styRes.rows[0].id : null;
      
      let startTime = new Date();
      if (app.date && app.hour) {
        startTime = new Date(app.date + 'T' + app.hour + ':00-06:00');
      }
      
      const res = await pool.query(
        `INSERT INTO citas (cliente_id, estilista_id, servicio_id, fecha_hora_inicio, estado)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [app.customer, styId, svcId, startTime.toISOString(), app.status === 'Cobrado' ? 'confirmada' : 'anticipo_pendiente']
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      const newId = data.citas.length + 1;
      const svc = data.servicios.find(s => s.nombre === app.service);
      const sty = data.estilistas.find(e => e.nombre === app.stylist);
      
      let startStr = new Date().toISOString();
      if (app.date && app.hour) {
        startStr = new Date(`${app.date}T${app.hour}:00-06:00`).toISOString();
      }
      const durationMin = svc ? svc.duracion_minutos : (app.duration * 60);
      const endStr = new Date(new Date(startStr).getTime() + durationMin * 60000).toISOString();
      
      const newCita = {
        id: newId,
        cliente_id: app.customer,
        estilista_id: sty ? sty.id : null,
        servicio_id: svc ? svc.id : null,
        fecha_hora_inicio: startStr,
        fecha_hora_fin: endStr,
        estado: app.status === 'Cobrado' ? 'confirmada' : 'anticipo_pendiente',
        link_comprobante: app.formula || null
      };
      
      data.citas.push(newCita);
      saveFallback(data);
      return newCita;
    }
  },

  async deleteAppointment(id) {
    if (!useFallback) {
      await pool.query('DELETE FROM citas WHERE id = $1', [id]);
      return { exito: true };
    } else {
      const data = loadFallback();
      data.citas = data.citas.filter(c => c.id !== Number(id));
      if (data.nomina) {
        data.nomina = data.nomina.filter(n => n.cita_id !== Number(id));
      }
      saveFallback(data);
      return { exito: true };
    }
  },

  async updateServicePrice(id, price) {
    if (!useFallback) {
      const res = await pool.query(
        'UPDATE servicios SET precio_fijo = $1 WHERE id = $2 RETURNING *',
        [price, id]
      );
      return res.rows[0];
    } else {
      const data = loadFallback();
      const svc = data.servicios.find(s => s.id === Number(id));
      if (svc) {
        svc.precio_fijo = Number(price);
        saveFallback(data);
        return svc;
      }
      return null;
    }
  }
};

module.exports = {
  initDb,
  db
};
