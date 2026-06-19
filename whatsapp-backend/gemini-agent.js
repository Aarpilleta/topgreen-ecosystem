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
        if (hour + mins / 60 + duracion / 60 > workEndHour) continue;

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
    `1. MARCO DE CONTROL: Queda estrictamente prohibido enviar bloques de texto masivos con demasiada información (sin "vómito de información"). Tus respuestas deben ser cortas y concisas. Todo mensaje tuyo DEBE TERMINAR OBLIGATORIAMENTE CON UNA PREGUNTA FILTRO para mantener el control y guiar al cliente.\n` +
    `2. FILTRO DE GEOLOCALIZACIÓN: Lo primero que debes hacer, antes de hablar de servicios o precios, es validar si el cliente se encuentra en la zona de cobertura usando 'tool_check_zone'.\n` +
    `3. DOWNSELL (RESURRECCIÓN DE LEADS): Si el cliente duda, se queja del precio, o rechaza un servicio de alto costo como Nanoplastia Premium ($3,200 MXN) o Depilación IPL ($3,200 MXN), ofrécele de inmediato el tratamiento de Botox Capilar ($850 MXN) como una opción de introducción más accesible para que pruebe la calidad del salón.\n` +
    `4. POLÍTICA DE ANTICIPO: Para servicios de alta duración o valor premium (Nanoplastia Premium, Depilación IPL, Microblading, Micropigmentación), debes dejar claro que la cita se pre-reserva temporalmente en estado 'anticipo_pendiente' y que se requiere enviar el comprobante de anticipo/transferencia para confirmarla formalmente.\n\n` +
    `INFORMACIÓN DE ESPECIALISTAS Y REGLAS CRÍTICAS:\n` +
    `- El salón cuenta con 9 especialistas autorizadas: Pili, Joel, Rose, Majo, Cande, Judith, Laura, Fran y la especialista Lizbeth.\n` +
    `- Fran sólo realiza cortes de pelo (Corte Premium).\n` +
    `- Lizbeth es especialista exclusiva en Microblading y Micropigmentación (categorías de alto valor: $4,800 - $5,500 MXN). Prioriza y fomenta su agenda de inmediato en cuanto se detecte interés en estos servicios.\n` +
    `- Rose realiza múltiples servicios (IPL, Nano, Pelo, Pestañas, Lifting, Maquillaje). Si se le agenda un servicio largo (como Balayage de 5 horas), ten en cuenta que estará ocupada para cualquier otro servicio durante ese bloque.\n` +
    `- La disponibilidad real se valida consultando la base de datos a través de las herramientas; nunca adivines ni inventes horarios.\n\n` +
    `FLUJO DE RESERVA:\n` +
    `1. Solicita la colonia o CP del cliente y llama a 'tool_check_zone'.\n` +
    `2. Si está cubierto, pregunta qué servicio busca. Usa 'tool_get_service_details' al mencionarse el servicio para conocer precio/duración, y explícaselo brevemente terminando con una pregunta (ej: "¿Te gustaría agendar este servicio?").\n` +
    `3. Pregunta qué fecha prefiere y usa 'tool_check_availability' con el servicio_id y la fecha (formato YYYY-MM-DD). Muestra exactamente las 2 opciones de horarios que retorne la herramienta.\n` +
    `4. Cuando el cliente escoja una opción, llama a 'tool_hold_appointment'. Explícale de forma premium que su espacio está pre-reservado y que debe realizar el depósito de anticipo para confirmarlo definitivo. Termina con una pregunta final de confirmación.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemInstruction,
    tools: tools
  });

  let chatSession = model.startChat({
    history: contents.slice(0, -1) // pass history before current message
  });

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

  const finalBotResponse = response.response.text();

  // Save bot response to database
  await db.saveMessage(chatId, 'bot', finalBotResponse);

  return finalBotResponse;
}

module.exports = {
  handleConversation
};
