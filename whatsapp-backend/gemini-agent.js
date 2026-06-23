const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('./db');

// Check coverage zones
async function dbCheckZone(coloniaOrCp, chatId) {
  const cleanInput = (coloniaOrCp || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const coverageKeywords = [
    'polanco', 'condesa', 'roma', 'lomas', 'del valle', 'santa fe', 
    'satelite', 'lomas verdes', 'zona esmeralda', 'naucalpan', 'tlalnepantla', 'mundo e',
    '11560', '06100', '06700', '11000', '03100', '53100', '54054'
  ];
  
  const isCovered = coverageKeywords.some(keyword => cleanInput.includes(keyword));
  
  // Save/update the client's zone in control_chats
  await db.updateZone(chatId, coloniaOrCp);
  
  if (isCovered) {
    return {
      coberto: true,
      mensaje: `La zona "${coloniaOrCp}" está dentro de nuestra cobertura premium.`
    };
  } else {
    // If not covered, turn off the bot so human can handle if they want to override
    await db.toggleBot(chatId, false);
    return {
      coberto: false,
      mensaje: `La zona "${coloniaOrCp}" está fuera de nuestra cobertura. Atendemos en Satélite, Lomas Verdes, Zona Esmeralda, Naucalpan, Tlalnepantla, Polanco, Condesa, Roma, Lomas, Del Valle, Santa Fe y Mundo E. El bot se desactivará para atención manual.`
    };
  }
}

// Get service details
async function dbGetServiceDetails(servicioName) {
  const service = await db.getServiceDetails(servicioName);
  if (service) {
    return {
      encontrado: true,
      servicio: service
    };
  }
  return {
    encontrado: false,
    mensaje: `No encontramos un servicio con el nombre "${servicioName}". Ofrecemos: Nanoplastia Premium, Balayage Premium, Corte Premium, Tinte de Cobertura, Botox Capilar y Depilación IPL.`
  };
}

// Check availability and return exactly 2 options
async function dbCheckAvailability(servicioId, fechaStr) {
  // Get service details
  const service = await db.getServiceById(servicioId);
  if (!service) {
    return { error: 'Servicio no encontrado.' };
  }
  const { nombre: svcNombre, duracion_minutos: duracion } = service;

  // Get active stylists
  const activeStylists = await db.getStylists();
  const eligibleStylists = activeStylists.filter(s => 
    s.especialidades && s.especialidades.some(e => e.toLowerCase() === svcNombre.toLowerCase())
  );

  if (eligibleStylists.length === 0) {
    return { mensaje: 'No hay estilistas activos disponibles para esta especialidad.' };
  }

  // Parse target date (YYYY-MM-DD)
  const targetDate = new Date(fechaStr);
  if (isNaN(targetDate.getTime())) {
    return { error: 'Fecha inválida. Use el formato YYYY-MM-DD.' };
  }

  const slots = [];
  
  // For each eligible stylist, find availability
  for (const stylist of eligibleStylists) {
    // Get non-cancelled appointments for this stylist on this date
    const appts = await db.getStylistAppointmentsOnDate(stylist.id, fechaStr);
    const appointments = appts.map(r => ({
      inicio: new Date(r.fecha_hora_inicio),
      fin: new Date(r.fecha_hora_fin)
    }));

    // Working hours: 11:00 to 20:00 (11am to 8pm) in salon local timezone
    // Friday & Saturday: 9:30 to 20:00
    let workStartHour = 11;
    let workStartMins = 0;
    const workEndHour = 20;

    // Get day of week in CST (UTC-6)
    const targetDate = new Date(`${fechaStr}T12:00:00-06:00`);
    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      workStartHour = 9;
      workStartMins = 30;
    }

    for (let hour = workStartHour; hour < workEndHour; hour++) {
      for (const mins of [0, 30]) {
        if (hour === 9 && mins === 0) continue; // Skip 9:00 if start is 9:30
        if (hour + mins / 60 >= workEndHour) continue;

        const hh = String(hour).padStart(2, '0');
        const mm = String(mins).padStart(2, '0');
        const potentialStart = new Date(`${fechaStr}T${hh}:${mm}:00-06:00`);
        const potentialEnd = new Date(potentialStart.getTime() + duracion * 60 * 1000);

        // Check overlap with existing appointments
        const hasOverlap = appointments.some(appt => {
          return (potentialStart < appt.fin && potentialEnd > appt.inicio);
        });

        if (!hasOverlap) {
          // Format start time string (HH:MM)
          const hh = String(hour).padStart(2, '0');
          const mm = String(mins).padStart(2, '0');
          slots.push({
            estilista_id: stylist.id,
            estilista_nombre: stylist.nombre,
            fecha: fechaStr,
            hora_inicio: `${hh}:${mm}`,
            start_iso: potentialStart.toISOString(),
            label: `${stylist.nombre} a las ${hh}:${mm}`
          });
        }
      }
    }
  }

  // Filter or sort slots, and limit to exactly 2 options
  const selectedSlots = slots.slice(0, 2);

  if (selectedSlots.length === 0) {
    return {
      disponible: false,
      mensaje: `No hay disponibilidad para ${svcNombre} el día ${fechaStr}.`
    };
  }

  return {
    disponible: true,
    opciones: selectedSlots
  };
}

// Hold appointment
async function dbHoldAppointment(clienteId, estilistaId, servicioId, horaInicioIso) {
  const cita = await db.holdAppointment(clienteId, estilistaId, servicioId, horaInicioIso);
  return {
    exito: true,
    cita: cita
  };
}

// Main conversation handler
async function handleConversation(chatId, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno GEMINI_API_KEY");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Load chat history
  const history = await db.getChatMessages(chatId);

  // Map history to Gemini API formats
  const contents = [];
  history.forEach(msg => {
    const role = msg.remitente === 'cliente' ? 'user' : 'model';
    contents.push({
      role: role,
      parts: [{ text: msg.texto }]
    });
  });

  // Add the current user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  // Save user's message to database
  await db.saveMessage(chatId, 'cliente', userMessage);

  // Define tools
  const tools = [
    {
      functionDeclarations: [
        {
          name: 'tool_check_zone',
          description: 'Filtra geográficamente al cliente por colonia o código postal (CP) para ver si está en cobertura.',
          parameters: {
            type: 'OBJECT',
            properties: {
              colonia_o_cp: {
                type: 'STRING',
                description: 'La colonia o código postal proporcionado por el cliente.'
              }
            },
            required: ['colonia_o_cp']
          }
        },
        {
          name: 'tool_get_service_details',
          description: 'Busca los detalles de precio y duración de un servicio por su nombre (ej. Nanoplastia, Corte, Nanopore).',
          parameters: {
            type: 'OBJECT',
            properties: {
              servicio_name: {
                type: 'STRING',
                description: 'El nombre del servicio de belleza.'
              }
            },
            required: ['servicio_name']
          }
        },
        {
          name: 'tool_check_availability',
          description: 'Busca estilistas activos y con horario libre de acuerdo a la duración requerida. Retorna un máximo de 2 opciones.',
          parameters: {
            type: 'OBJECT',
            properties: {
              servicio_id: {
                type: 'NUMBER',
                description: 'El ID numérico del servicio.'
              },
              fecha: {
                type: 'STRING',
                description: 'Fecha deseada en formato YYYY-MM-DD (ej: 2026-06-12).'
              }
            },
            required: ['servicio_id', 'fecha']
          }
        },
        {
          name: 'tool_hold_appointment',
          description: 'Registra la cita temporalmente en estado "anticipo_pendiente" reservando el estilista y horario.',
          parameters: {
            type: 'OBJECT',
            properties: {
              cliente_id: {
                type: 'STRING',
                description: 'El ID de WhatsApp del cliente.'
              },
              estilista_id: {
                type: 'NUMBER',
                description: 'El ID del estilista seleccionado.'
              },
              servicio_id: {
                type: 'NUMBER',
                description: 'El ID del servicio seleccionado.'
              },
              hora_inicio: {
                type: 'STRING',
                description: 'El timestamp ISO (start_iso) del horario seleccionado.'
              }
            },
            required: ['cliente_id', 'estilista_id', 'servicio_id', 'hora_inicio']
          }
        }
      ]
    }
  ];

  const systemInstruction = 
    `Eres "Elena", la recepcionista estrella y asistente virtual del salón de belleza premium "TOP GREEN".\n` +
    `Tu personalidad es empática, impecable, sumamente profesional y orientada al cierre de ventas.\n\n` +
    `REGLAS DE CONVERSACIÓN (MANDATORIAS):\n` +
    `1. DENSIDAD VISUAL BAJA: Ningún mensaje enviado por ti puede superar las 3 líneas de texto continuas. Divide los párrafos si es necesario, pero sé extremadamente corta y concisa.\n` +
    `2. CIERRE CON PREGUNTA ACTIVA: Absolutamente todo mensaje de respuesta debe concluir con una sola pregunta directa que exija una respuesta simple, cerrada o de doble alternativa.\n` +
    `3. USO DE EMOJIS: Moderado y sofisticado (🌿, ✨, 💖), exclusivamente para estructurar la lectura, nunca de manera excesiva.\n` +
    `4. UBICACIÓN EXCLUSIVA: Operamos únicamente en nuestra sede de Mundo E. Si el usuario ingresa de forma orgánica y menciona un CP o zona alejada, di textualmente: "Muchas gracias por tu interés y por tu confianza 💖. Te cuento que nuestra sede central está ubicada estratégicamente dentro de Mundo E. Nos encantaría recibirte para darte la atención VIP que te mereces. ¿Es una zona que te quede cómoda para planificar tu visita? 📆"\n\n` +
    `FLUJOS POR ORIGEN DE PAUTA (META ADS & ORGANICO):\n` +
    `- FLUJO A (Nanoplastia - Enfoque Soberanía y Brillo):\n` +
    `  * Paso 1 (Bienvenida/Filtro): "¡Hola! ✨ Qué gusto saludarte. Veo que te interesa nuestra Nanoplastia orgánica (0% formol). Estamos ubicados en Mundo E. ¿Esta ubicación te queda bien para agendar tu cita? 🌿"\n` +
    `  * Paso 2: Si confirma ubicación, di: "¡Excelente! Te va a encantar la experiencia 💖. Para darte un presupuesto exacto y la duración de tu sesión, ¿podrías enviarme una foto actual de tu cabello de espaldas donde se aprecie el largo completo?"\n` +
    `  * Paso 3 (Handoff): Cuando envíe la foto (o si menciona que la enviará o está enviando), el sistema de forma programática se encargará de hacer la transición, pero tú debes guiarlo a enviar la foto en el Paso 2.\n` +
    `- FLUJO B (Depilación IPL - Enfoque Protección Cutánea):\n` +
    `  * Paso 1 (Bienvenida/Filtro): "¡Hola! ✨ Qué alegría recibirte en la línea VIP de Top Green Salon 🌿. Veo que buscas liberarte del rastrillo con nuestra tecnología IPL inteligente. Atendemos exclusivamente en nuestra sede de Mundo E. ¿Te queda accesible esta zona?"\n` +
    `  * Paso 2: Si confirma ubicación, di: "¡Perfecto! Tu piel te lo va a agradecer 💖. Para garantizar que eres candidata ideal y calibrar el equipo según tu tipo de vello, agendamos una sesión de diagnóstico dermatológico especializado de 20 minutos. Esta sesión tiene una inversión de $300 MXN, pero al iniciar tu tratamiento en esa misma cita, este monto se te descuenta al 100% (tu diagnóstico queda completamente gratis). ¿Prefieres reservar tu espacio por la mañana o por la tarde?"\n` +
    `- FLUJO C (Micropigmentación - Enfoque Alta Gama):\n` +
    `  * Paso 1 (Bienvenida/Filtro): "¡Hola, hermosa! ✨ Bienvenida a Top Green Salon 🌿. Qué gran decisión diseñar tu mirada con nuestro servicio de Micropigmentación premium. Nos encontramos ubicados en Mundo E. ¿Esta ubicación te resulta conveniente para visitarnos?"\n` +
    `  * Paso 2: Si confirma ubicación, di: "¡Maravilloso! Te platico: este servicio High-Ticket lo realiza una Master Artist externa que asiste al salón únicamente bajo cita confirmada para esculpir tu diseño de forma personalizada. Para bloquear la fecha exclusiva en su agenda, solicitamos un apartado de garantía de $500 MXN (que se abona directo al total de tu servicio el día de tu cita). ¿Te gustaría conocer los días disponibles que tenemos para esta semana?"\n` +
    `- FLUJO D (Clientes Orgánicos / Sin anuncio):\n` +
    `  * Si el mensaje inicial del cliente no contiene intención de Nanoplastia, IPL o Micropigmentación, saluda amablemente, di que están ubicados en Mundo E, y pregúntale por el servicio de su interés.\n\n` +
    `REGLAS DE AGENDA Y DOWNSELL:\n` +
    `- DOWNSELL: Si duda del precio de Nanoplastia ($3,200 MXN) o IPL ($3,200 MXN), ofrece de inmediato el Botox Capilar ($850 MXN) como alternativa accesible.\n` +
    `- PROTOCOLO ANTI NO-SHOW (Al elegir horario con 'tool_hold_appointment'):\n` +
    `  * Si es Servicio de Bajo Margen / General (ej: Uñas, Corte Premium): "¡Listo, hermosa! Tu espacio para [Servicio] quedó reservado para el [Día] a las [Hora] 🕒. Para respetar el tiempo de nuestras especialistas y resguardar tu lugar, te pedimos de favor confirmar tu asistencia 24 horas antes a través de un link que te enviaremos. ¿Te parece bien si te agendamos el recordatorio automático?"\n` +
    `  * Si es IPL o Micropigmentación: "¡Excelente elección! Tu bloque de tiempo para [Servicio] está pre-reservado para el [Día] a las [Hora] 🕒. Como este servicio requiere la preparación de aparatología médica avanzada o la asistencia de nuestra especialista externa, solo requerimos validar tu apartado de garantía. Aquí tienes el enlace seguro para realizar tu depósito de forma rápida: [Link de Pago/Transferencia]. Una vez que lo realices, el sistema blindará tu cita de inmediato ✨. ¿Te genera alguna duda el proceso de pago?"\n\n` +
    `INFORMACIÓN DE ESPECIALISTAS:\n` +
    `- Pili, Joel, Rose, Majo, Cande, Judith, Laura, Fran y Lizbeth.\n` +
    `- Fran sólo realiza cortes (Corte Premium).\n` +
    `- Lizbeth es exclusiva de Microblading y Micropigmentación (fomenta y prioriza su agenda para esto).\n` +
    `- Valida disponibilidad real con 'tool_check_availability' antes de ofrecer horarios, y muestra máximo 2 opciones.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemInstruction,
    tools: tools
  });

  let chatSession = model.startChat({
    history: contents.slice(0, -1) // pass history before current message
  });

  let finalBotResponse;
  try {
    let response = await chatSession.sendMessage(userMessage);
    let functionCalls = response.response.functionCalls();

    while (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      let toolResult;

      console.log(`Executing tool: ${call.name}`, call.args);

      if (call.name === 'tool_check_zone') {
        toolResult = await dbCheckZone(call.args.colonia_o_cp, chatId);
      } else if (call.name === 'tool_get_service_details') {
        toolResult = await dbGetServiceDetails(call.args.servicio_name);
      } else if (call.name === 'tool_check_availability') {
        toolResult = await dbCheckAvailability(call.args.servicio_id, call.args.fecha);
      } else if (call.name === 'tool_hold_appointment') {
        toolResult = await dbHoldAppointment(call.args.cliente_id || chatId, call.args.estilista_id, call.args.servicio_id, call.args.hora_inicio);
      }

      response = await chatSession.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        }
      ]);
      functionCalls = response.response.functionCalls();
    }

    finalBotResponse = response.response.text();
  } catch (apiError) {
    console.error('[Gemini API Error] Fallo al procesar conversación con IA:', apiError);
    finalBotResponse = "Disculpa la molestia 🌿. En este momento estoy experimentando un inconveniente técnico para procesar tu solicitud. Un asesor humano continuará tu atención de inmediato. ✨";
    
    // Auto-disable bot so a human can intervene immediately and the customer doesn't get repeated errors
    try {
      await db.toggleBot(chatId, false);
      console.log(`[Auto-Handoff] Bot desactivado para el chat ${chatId} debido a error en la API de Gemini.`);
    } catch (dbErr) {
      console.error('Error al desactivar el bot tras fallo de Gemini:', dbErr);
    }
  }

  // Save bot response to database
  await db.saveMessage(chatId, 'bot', finalBotResponse);

  return finalBotResponse;
}

module.exports = {
  handleConversation
};
