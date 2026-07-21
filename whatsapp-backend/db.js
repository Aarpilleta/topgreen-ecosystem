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
    { id: 12, nombre: 'Micropigmentación', duracion_minutos: 180, precio_fijo: 5500.00 },
    { id: 13, nombre: 'Diagnóstico IPL', duracion_minutos: 20, precio_fijo: 300.00 }
  ],
  estilistas: [
    { id: 1, nombre: 'Pili', especialidades: ['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Botox Capilar'], color: '#10b981', activo: true },
    { id: 2, nombre: 'Joel', especialidades: ['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Botox Capilar'], color: '#3b82f6', activo: true },
    { id: 3, nombre: 'Rose', especialidades: ['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Depilación IPL', 'Diagnóstico IPL', 'Pestañas', 'Lifting', 'Maquillaje', 'Botox Capilar'], color: '#a855f7', activo: true },
    { id: 4, nombre: 'Majo', especialidades: [
      'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico',
      'Pestañas volumen', 'Efecto rimel', 'Extensiones clásicas', 'Extensiones híbridas', 'Retoque clásicas', 'Retoque efecto rímel', 'Retoque híbrida', 'Retoque volumen', 'Retiro pestañas', 'Pestañas de tira', 'Lifting de pestañas', 'Lifting de pestañas/tinta',
      'Limpieza profunda', 'Humectación',
      'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
      'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente'
    ], color: '#ec4899', activo: true },
    { id: 5, nombre: 'Cande', especialidades: ['Uñas'], color: '#f43f5e', activo: true },
    { id: 6, nombre: 'Judith', especialidades: ['Uñas'], color: '#f59e0b', activo: true },
    { id: 7, nombre: 'Laura', especialidades: [
      // Uñas
      'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico',
      // Lifting
      'Lifting de pestañas', 'Lifting de pestañas/tinta',
      // Cortes
      'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
      // Tintes
      'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
      // Depilación
      'Depilación IPL', 'Diagnóstico IPL', 'Espalda completa (IPL)', 'Media espalda (IPL)', 'Brazos (IPL) - $3200', 'Abdomen (IPL)', 'Piernas completas (IPL)', 'Media pierna (IPL)', 'Brazos (IPL) - $3800', 'Bigote (IPL)', 'Paquete IPL: Brazos, pierna completa, bikini y área gluteal', 'Paquete IPL: Axilas, piernas, bikini y area gluteal', 'Cara completa IPL (barbilla, bigote, patillas, mejillas, frente)',
      'Depilación Cera Abdomen', 'Depilación Cera Axila', 'Depilación Cera Bozo o mentón', 'Depilación Cera Brazo', 'Depilación Cera Cejas', 'Diseño de cejas (Cera)', 'Depilación Cera Espalda completa', 'Depilación Cera Bikini', 'Depilación Cera Ingles', 'Depilación Cera Linea central abdomen', 'Depilación Cera Media espalda', 'Depilación Cera Pierna completa', 'Depilación Cera Media pierna', 'Depilación Cera Patillas', 'Cara completa (Cera)'
    ], color: '#c084fc', activo: true },
    { id: 8, nombre: 'Lizbeth', especialidades: ['Microblading', 'Micropigmentación'], color: '#d97706', activo: true },
    { id: 9, nombre: 'Fran', especialidades: ['Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero'], color: '#6366f1', activo: true },
    { id: 10, nombre: 'Tony', especialidades: [
      'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
      'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
      'Peinado tenaza ondulado', 'Alto peinado chongo', 'Secado/brushing', 'Medio recogido'
    ], color: '#06b6d4', activo: true }
  ],
  inventario: [
    { key_name: 'nanoplastia_elixir', nombre: 'Elixir Nanoplastia (ml)', stock: 1500, min: 500, cost_per_unit: 1.50, price: null, item_type: 'insumo' },
    { key_name: 'jade_tinte', nombre: 'Tinte Jade Green (g)', stock: 260, min: 300, cost_per_unit: 4.00, price: null, item_type: 'insumo' },
    { key_name: 'shampoo_retail', nombre: 'Shampoo Jade Protect (Pzs)', stock: 11, min: 4, cost_per_unit: 200.00, price: 450.00, item_type: 'retail' },
    { key_name: 'mask_retail', nombre: 'Mascarilla Menta (Pzs)', stock: 1, min: 3, cost_per_unit: 300.00, price: 680.00, item_type: 'retail' },
    { key_name: 'tec_italy_due_facceta_lunga_durata_300_ml', nombre: '[Tec Italy] Due facceta lunga durata 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 650.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_shampoo_300_ml', nombre: '[Tec Italy] lumina shampoo 300 ml', stock: 3, min: 2, cost_per_unit: 0.00, price: 440.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_conditioner_300_ml', nombre: '[Tec Italy] Lumina conditioner 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 480.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_silver_shampoo_300_ml', nombre: '[Tec Italy] Lumina Silver Shampoo 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 440.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_shampoosilver_1_litro', nombre: '[Tec Italy] Lumina shampooSilver 1 litro', stock: 0, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'tec_italy_post_color_shampoo_300_ml', nombre: '[Tec Italy] post color shampoo 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_post_color_shampoo_1_litro', nombre: '[Tec Italy] Post color Shampoo 1 litro', stock: 1, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_violeta_300_ml', nombre: '[Tec Italy] Lumina forza violeta 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_chocolate_300_ml', nombre: '[Tec Italy] Lumina forza chocolate 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_black_300_ml', nombre: '[Tec Italy] Lumina forza black 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_rosa_300_ml', nombre: '[Tec Italy] Lumina forza rosa 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_blonde_300_ml', nombre: '[Tec Italy] Lumina forza blonde 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_silver_300_ml', nombre: '[Tec Italy] Lumina forza Silver 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_red_300_ml', nombre: '[Tec Italy] Lumina forza Red 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_plata_300_ml', nombre: '[Tec Italy] Lumina Forza Plata 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_blue_300_ml', nombre: '[Tec Italy] Lumina Forza Blue 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_lumina_forza_cobre_300_ml', nombre: '[Tec Italy] Lumina forza cobre 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_olio_vital_125_ml', nombre: '[Tec Italy] Olio vital 125 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 670.00, item_type: 'retail' },
    { key_name: 'tec_italy_olivo_vital_color_125_ml', nombre: '[Tec Italy] Olivo vital color 125 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 670.00, item_type: 'retail' },
    { key_name: 'tec_italy_essential_oil_shampoo_300_ml', nombre: '[Tec Italy] Essential Oil shampoo 300 ml', stock: 6, min: 2, cost_per_unit: 0.00, price: 440.00, item_type: 'retail' },
    { key_name: 'tec_italy_essential_oil_conditioner_300_ml', nombre: '[Tec Italy] Essential Oil conditioner 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 530.00, item_type: 'retail' },
    { key_name: 'tec_italy_essential_oil_treatment_125_ml', nombre: '[Tec Italy] Essential Oil Treatment 125 ml', stock: 10, min: 2, cost_per_unit: 0.00, price: 700.00, item_type: 'retail' },
    { key_name: 'tec_italy_essential_oil_mask', nombre: '[Tec Italy] Essential Oil Mask', stock: 7, min: 2, cost_per_unit: 0.00, price: 680.00, item_type: 'retail' },
    { key_name: 'tec_italy_due_faccetta_massimo_300_ml', nombre: '[Tec Italy] Due faccetta Massimo 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 670.00, item_type: 'retail' },
    { key_name: 'tec_italy_shampoo_massimo_300_ml', nombre: '[Tec Italy] Shampoo Massimo 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_omni_restore_shampoo_300_ml', nombre: '[Tec Italy] Omni Restore Shampoo 300 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 440.00, item_type: 'retail' },
    { key_name: 'tec_italy_omni_restore_acondicionador_300_ml', nombre: '[Tec Italy] Omni Restore Acondicionador 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 520.00, item_type: 'retail' },
    { key_name: 'tec_italy_omni_restore_mascarilla_280_g', nombre: '[Tec Italy] Omni Restore mascarilla 280 G', stock: 2, min: 2, cost_per_unit: 0.00, price: 680.00, item_type: 'retail' },
    { key_name: 'tec_italy_omni_restore_protector_125_ml', nombre: '[Tec Italy] Omni Restore protector 125 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 630.00, item_type: 'retail' },
    { key_name: 'tec_italy_amino_keratin_280_g', nombre: '[Tec Italy] Amino keratin 280 G', stock: 1, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'tec_italy_amino_keratin_intensivo_mask_1_kg', nombre: '[Tec Italy] Amino keratin intensivo mask 1 kg', stock: 0, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'tec_italy_due_faccetta_giorno_per_giorno_300_ml', nombre: '[Tec Italy] Due faccetta Giorno per giorno 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 650.00, item_type: 'retail' },
    { key_name: 'tec_italy_shampoo_balsami_presto_300_ml', nombre: '[Tec Italy] Shampoo Balsami presto 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_balsami_presto_tratamiento_300_m', nombre: '[Tec Italy] Balsami presto tratamiento 300 m', stock: 4, min: 2, cost_per_unit: 0.00, price: 500.00, item_type: 'retail' },
    { key_name: 'tec_italy_shampoo_totale_condicionados_300_ml', nombre: '[Tec Italy] Shampoo totale condicionados 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 590.00, item_type: 'retail' },
    { key_name: 'tec_italy_balsami_totale_300_ml', nombre: '[Tec Italy] Balsami totale 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 400.00, item_type: 'retail' },
    { key_name: 'tec_italy_shampoo_hi_moisturizing', nombre: '[Tec Italy] Shampoo Hi- Moisturizing', stock: 4, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_hi_moisturizing_conditioner_300_ml', nombre: '[Tec Italy] Hi-Moisturizing conditioner 300 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_hi_moisturizing_treatment_280_g', nombre: '[Tec Italy] Hi-Moisturizing treatment 280 G', stock: 2, min: 2, cost_per_unit: 0.00, price: 640.00, item_type: 'retail' },
    { key_name: 'tec_italy_working_spray_400_ml', nombre: '[Tec Italy] Working spray 400 ml', stock: 6, min: 2, cost_per_unit: 0.00, price: 520.00, item_type: 'retail' },
    { key_name: 'tec_italy_finishing_spray_400_ml', nombre: '[Tec Italy] Finishing Spray 400 ml', stock: 6, min: 2, cost_per_unit: 0.00, price: 520.00, item_type: 'retail' },
    { key_name: 'tec_italy_shine_spray_250_ml', nombre: '[Tec Italy] Shine Spray 250 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 500.00, item_type: 'retail' },
    { key_name: 'tec_italy_silk_system_shine_125_ml', nombre: '[Tec Italy] Silk System Shine 125 ml', stock: 6, min: 2, cost_per_unit: 0.00, price: 480.00, item_type: 'retail' },
    { key_name: 'tec_italy_metamorfosis_cream_300_ml', nombre: '[Tec Italy] Metamorfosis cream 300 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 520.00, item_type: 'retail' },
    { key_name: 'tec_italy_gel_della_cera_effetto_humedo', nombre: '[Tec Italy] Gel Della Cera Effetto Húmedo', stock: 4, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_gel_della_cera_effetto_normal', nombre: '[Tec Italy] Gel Della Cera Effetto normal', stock: 8, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_pasta_de_la_arana', nombre: '[Tec Italy] Pasta de la araña', stock: 7, min: 2, cost_per_unit: 0.00, price: 400.00, item_type: 'retail' },
    { key_name: 'tec_italy_scultore_fine_300_ml', nombre: '[Tec Italy] Scultore fine 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 400.00, item_type: 'retail' },
    { key_name: 'tec_italy_gellini_300_ml', nombre: '[Tec Italy] Gellini 300 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_speciale_125_ml', nombre: '[Tec Italy] Speciale 125 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 270.00, item_type: 'retail' },
    { key_name: 'tec_italy_curls_shampoo_300_ml', nombre: '[Tec Italy] Curls Shampoo 300 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 420.00, item_type: 'retail' },
    { key_name: 'tec_italy_curls_conditioner_300_ml', nombre: '[Tec Italy] Curls conditioner 300 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 400.00, item_type: 'retail' },
    { key_name: 'tec_italy_curls_defining_gel_300_ml', nombre: '[Tec Italy] Curls defining Gel 300 ml', stock: 6, min: 2, cost_per_unit: 0.00, price: 400.00, item_type: 'retail' },
    { key_name: 'tec_italy_curls_defining_crema_300_ml', nombre: '[Tec Italy] Curls defining crema 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 520.00, item_type: 'retail' },
    { key_name: 'tec_italy_due_faccetta_pro', nombre: '[Tec Italy] Due faccetta pro', stock: 4, min: 2, cost_per_unit: 0.00, price: 700.00, item_type: 'retail' },
    { key_name: 'tec_italy_shampoo_tonico', nombre: '[Tec Italy] Shampoo tónico', stock: 3, min: 2, cost_per_unit: 0.00, price: 370.00, item_type: 'retail' },
    { key_name: 'tec_italy_shampoo_metamorfosis', nombre: '[Tec Italy] Shampoo Metamorfosis', stock: 7, min: 2, cost_per_unit: 0.00, price: 400.00, item_type: 'retail' },
    { key_name: 'tec_italy_metamorfosis_cream_1_litro', nombre: '[Tec Italy] Metamorfosis cream 1 litro', stock: 1, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'tec_italy_profundo_shampoo_1_litro', nombre: '[Tec Italy] Profundo shampoo 1 litro', stock: 1, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'tec_italy_preciso_para_sellar_cuticula_1_litro', nombre: '[Tec Italy] Preciso para sellar cutícula 1 litro', stock: 1, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'l_oreal_absolut_repair_500_ml', nombre: '[L\'Oréal] Absolut repair 500 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 770.00, item_type: 'retail' },
    { key_name: 'l_oreal_absolut_repair_300_ml', nombre: '[L\'Oréal] Absolut repair 300 ml', stock: 3, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_absolut_repair_mascarilla', nombre: '[L\'Oréal] Absolut repair mascarilla', stock: 1, min: 2, cost_per_unit: 0.00, price: 1008.00, item_type: 'retail' },
    { key_name: 'l_oreal_metal_detox_shampoo_500_ml', nombre: '[L\'Oréal] Metal detox shampoo 500 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 930.00, item_type: 'retail' },
    { key_name: 'l_oreal_absolut_repair_molecular_protector', nombre: '[L\'Oréal] Absolut repair molecular protector', stock: 2, min: 2, cost_per_unit: 0.00, price: 840.00, item_type: 'retail' },
    { key_name: 'l_oreal_scalp_advance_shampoo_500_ml', nombre: '[L\'Oréal] Scalp advance shampoo 500 ml', stock: 3, min: 2, cost_per_unit: 0.00, price: 745.00, item_type: 'retail' },
    { key_name: 'l_oreal_vitamina_color_shampoo_300_ml', nombre: '[L\'Oréal] Vitamina color shampoo 300 ml', stock: 5, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_vitamina_color_shampoo_500_ml', nombre: '[L\'Oréal] Vitamina color shampoo 500 ml', stock: 0, min: 2, cost_per_unit: 0.00, price: 750.00, item_type: 'retail' },
    { key_name: 'l_oreal_liss_unlimited_300_ml', nombre: '[L\'Oréal] Liss unlimited 300 ml', stock: 4, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_liss_unlimited_500_ml', nombre: '[L\'Oréal] Liss unlimited 500 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 750.00, item_type: 'retail' },
    { key_name: 'l_oreal_sensi_balance_500_ml_shampoo', nombre: '[L\'Oréal] Sensi balance 500 ml shampoo', stock: 3, min: 2, cost_per_unit: 0.00, price: 750.00, item_type: 'retail' },
    { key_name: 'l_oreal_metal_detox_protector', nombre: '[L\'Oréal] Metal detox protector', stock: 1, min: 2, cost_per_unit: 0.00, price: 670.00, item_type: 'retail' },
    { key_name: 'l_oreal_vitamina_color_spectrum_morado_300_ml', nombre: '[L\'Oréal] Vitamina color spectrum morado 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_vitamina_color_spectrum_verde_300_ml', nombre: '[L\'Oréal] Vitamina color spectrum verde 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_scalp_advance_anti_inconformista_shampoo_500_ml', nombre: '[L\'Oréal] Scalp advance anti inconformista shampoo 500 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: 750.00, item_type: 'retail' },
    { key_name: 'l_oreal_pro_longer_shampoo_300_ml', nombre: '[L\'Oréal] Pro longer shampoo 300 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_pro_longer_shampoo_500_ml', nombre: '[L\'Oréal] Pro longer shampoo 500 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 750.00, item_type: 'retail' },
    { key_name: 'l_oreal_metal_democracia_mascarilla_500_ml', nombre: '[L\'Oréal] Metal democracia mascarilla 500 ml', stock: 2, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'l_oreal_scalp_advance_anti_gras_500_ml_shampoo', nombre: '[L\'Oréal] Scalp advance anti gras 500 ml shampoo', stock: 2, min: 2, cost_per_unit: 0.00, price: 750.00, item_type: 'retail' },
    { key_name: 'l_oreal_tecni_art_spray', nombre: '[L\'Oréal] Tecni art spray', stock: 1, min: 2, cost_per_unit: 0.00, price: 620.00, item_type: 'retail' },
    { key_name: 'l_oreal_mythic_oil_200_ml_mascarilla', nombre: '[L\'Oréal] Mythic oil 200 ml mascarilla', stock: 2, min: 2, cost_per_unit: 0.00, price: 500.00, item_type: 'retail' },
    { key_name: 'l_oreal_dulcia_3', nombre: '[L\'Oréal] Dulcia 3', stock: 10, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'l_oreal_dulcia_1', nombre: '[L\'Oréal] Dulcia 1', stock: 7, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'l_oreal_dulcia_0', nombre: '[L\'Oréal] Dulcia 0', stock: 9, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'l_oreal_dulcia_2', nombre: '[L\'Oréal] Dulcia 2', stock: 0, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'l_oreal_dulcia_neutralizador_1_litro', nombre: '[L\'Oréal] Dulcia neutralizador 1 litro', stock: 1, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_6_volumenes', nombre: '[Peróxido L\'Oréal] 6 volúmenes', stock: 6, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_9_volumenes', nombre: '[Peróxido L\'Oréal] 9 volúmenes.', stock: 7, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_15_volumenes', nombre: '[Peróxido L\'Oréal] 15 volúmenes', stock: 4, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_20_volumenes', nombre: '[Peróxido L\'Oréal] 20 volúmenes', stock: 11, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_30_volumenes', nombre: '[Peróxido L\'Oréal] 30 volúmenes.', stock: 6, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_40_volumenes', nombre: '[Peróxido L\'Oréal] 40 volúmenes', stock: 4, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_wella_20_volumenes', nombre: '[Peróxido Wella] 20 volúmenes', stock: 2, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_wella_30_volumenes', nombre: '[Peróxido Wella] 30 volúmenes', stock: 1, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_wella_40_volumenes', nombre: '[Peróxido Wella] 40 volúmenes', stock: 2, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_blond_studio_20_volumenes', nombre: '[Peróxido L\'Oréal Blond Studio] 20 volúmenes', stock: 7, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_blond_studio_30_volumenes', nombre: '[Peróxido L\'Oréal Blond Studio] 30 volúmenes', stock: 0, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'peroxido_l_oreal_blond_studio_40_volumenes', nombre: '[Peróxido L\'Oréal Blond Studio] 40 volúmenes', stock: 0, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'otros_mucota_10', nombre: '[Otros] Mucota 10', stock: 3, min: 2, cost_per_unit: 0.00, price: 1025.00, item_type: 'retail' },
    { key_name: 'otros_mucota_04', nombre: '[Otros] Mucota 04', stock: 2, min: 2, cost_per_unit: 0.00, price: 960.00, item_type: 'retail' },
    { key_name: 'otros_clean_balance_shampoo', nombre: '[Otros] Clean balance shampoo', stock: 2, min: 2, cost_per_unit: 0.00, price: 1400.00, item_type: 'retail' },
    { key_name: 'otros_clean_balance_performance_shampoo', nombre: '[Otros] Clean balance performance shampoo', stock: 18, min: 2, cost_per_unit: 0.00, price: 1400.00, item_type: 'retail' },
    { key_name: 'otros_mucota_ex_treatment', nombre: '[Otros] Mucota ex treatment', stock: 2, min: 2, cost_per_unit: 0.00, price: 1025.00, item_type: 'retail' },
    { key_name: 'otros_pations_500_ml', nombre: '[Otros] Pations 500 ml', stock: 1, min: 2, cost_per_unit: 0.00, price: 1600.00, item_type: 'retail' },
    { key_name: 'otros_mucota_9', nombre: '[Otros] Mucota 9', stock: 15, min: 2, cost_per_unit: 0.00, price: 960.00, item_type: 'retail' },
    { key_name: 'otros_promille_color_e', nombre: '[Otros] Promille color e', stock: 1, min: 2, cost_per_unit: 0.00, price: 800.00, item_type: 'retail' },
    { key_name: 'otros_nutrifier_glicerol', nombre: '[Otros] Nutrifier glicerol', stock: 0, min: 2, cost_per_unit: 0.00, price: null, item_type: 'retail' },
    { key_name: 'decolorantes_decolorante_wella', nombre: '[Decolorantes] Decolorante wella', stock: 1, min: 1, cost_per_unit: 0.00, price: null, item_type: 'insumo' },
    { key_name: 'decolorantes_decolorante_blond_aturdio_8', nombre: '[Decolorantes] Decolorante blond aturdio 8', stock: 1, min: 1, cost_per_unit: 0.00, price: null, item_type: 'insumo' },
    { key_name: 'decolorantes_decolorante_blond_studio_9', nombre: '[Decolorantes] Decolorante blond studio 9', stock: 2, min: 1, cost_per_unit: 0.00, price: null, item_type: 'insumo' },
    { key_name: 'decolorantes_decolorante_blond_studio_7', nombre: '[Decolorantes] Decolorante blond studio 7', stock: 0, min: 1, cost_per_unit: 0.00, price: null, item_type: 'insumo' }
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

// Initialize Database connection/fallback with retries and port auto-correction
async function initDb() {
  if (process.env.DATABASE_URL) {
    let retries = 5;
    while (retries > 0) {
      try {
        let connStr = process.env.DATABASE_URL;
        // Auto-correct port 6543 (PgBouncer) to port 5432 (direct) to avoid timeouts and resets
        if (connStr.includes(':6543/')) {
          console.log('Auto-correcting PgBouncer port 6543 to direct connection port 5432 for stability.');
          connStr = connStr.replace(':6543/', ':5432/');
        }

        pool = new Pool({
          connectionString: connStr,
          ssl: connStr.includes('localhost') || connStr.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
        });

        pool.on('error', (err) => {
          console.error('Unexpected error on idle PostgreSQL client:', err);
        });
        
        // Test query
        await pool.query('SELECT NOW()');
        console.log('PostgreSQL database connected successfully. Using SQL storage.');

        // Initialize whatsapp_auth table if not exists (using UNLOGGED to prevent WAL replication bloat)
        await pool.query(`
          CREATE UNLOGGED TABLE IF NOT EXISTS whatsapp_auth (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT
          )
        `);

        // Ensure the table is UNLOGGED if it was previously created as logged
        try {
          await pool.query('ALTER TABLE whatsapp_auth SET UNLOGGED');
        } catch (alterErr) {
          console.warn('[DB] Could not set whatsapp_auth table to UNLOGGED:', alterErr.message);
        }

        // Migration: add propina column to nomina table if not exists
        await pool.query(`
          ALTER TABLE nomina ADD COLUMN IF NOT EXISTS propina NUMERIC(10, 2) DEFAULT 0.0;
        `);

        // Migration: add payment split, special discount, and dye supplies columns to citas table
        await pool.query(`
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS pago_tarjeta NUMERIC(10, 2) DEFAULT 0.0;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS pago_efectivo NUMERIC(10, 2) DEFAULT 0.0;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS descuento_especial BOOLEAN DEFAULT false;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumo_tinte_tubos INTEGER DEFAULT 0;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumo_tinte_tapa_bella INTEGER DEFAULT 0;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumo_tinte_tapa_loreal INTEGER DEFAULT 0;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumo_tinte_precio_tubo NUMERIC(10, 2) DEFAULT 220.00;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumo_tinte_precio_bella NUMERIC(10, 2) DEFAULT 50.00;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS insumo_tinte_precio_loreal NUMERIC(10, 2) DEFAULT 60.00;
          ALTER TABLE citas ADD COLUMN IF NOT EXISTS precio_cobrado NUMERIC(10, 2) DEFAULT NULL;
        `);

        // Update stylist colors to match new preferences
        try {
          await pool.query("UPDATE estilistas SET color = '#fbbf24' WHERE nombre = 'Pili'");
          await pool.query("UPDATE estilistas SET color = '#38bdf8' WHERE nombre = 'Joel'");
          await pool.query("UPDATE estilistas SET color = '#34d399' WHERE nombre = 'Rose'");
          await pool.query("UPDATE estilistas SET color = '#ef4444' WHERE nombre = 'Majo'");
          await pool.query("UPDATE estilistas SET color = '#f472b6' WHERE nombre = 'Cande'");
          await pool.query("UPDATE estilistas SET color = '#1d4ed8' WHERE nombre = 'Judith'");
          await pool.query("UPDATE estilistas SET color = '#c084fc' WHERE nombre = 'Laura'");
          await pool.query("UPDATE estilistas SET color = '#854d0e' WHERE nombre = 'Fran'");
          await pool.query("UPDATE estilistas SET color = '#fb923c' WHERE nombre = 'Tony'");
          
          // Update specialties for Laura (cuts, color, nails, hair removal, lifting)
          await pool.query(`UPDATE estilistas SET especialidades = ARRAY[
            -- Uñas
            'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico',
            -- Lifting
            'Lifting de pestañas', 'Lifting de pestañas/tinta',
            -- Cortes
            'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
            -- Tintes
            'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
            -- Depilación
            'Espalda completa (IPL)', 'Media espalda (IPL)', 'Brazos (IPL) - $3200', 'Abdomen (IPL)', 'Piernas completas (IPL)', 'Media pierna (IPL)', 'Brazos (IPL) - $3800', 'Bigote (IPL)', 'Paquete IPL: Brazos, pierna completa, bikini y área gluteal', 'Paquete IPL: Axilas, piernas, bikini y area gluteal', 'Cara completa IPL (barbilla, bigote, patillas, mejillas, frente)',
            'Depilación Cera Abdomen', 'Depilación Cera Axila', 'Depilación Cera Bozo o mentón', 'Depilación Cera Brazo', 'Depilación Cera Cejas', 'Diseño de cejas (Cera)', 'Depilación Cera Espalda completa', 'Depilación Cera Bikini', 'Depilación Cera Ingles', 'Depilación Cera Linea central abdomen', 'Depilación Cera Media espalda', 'Depilación Cera Pierna completa', 'Depilación Cera Media pierna', 'Depilación Cera Patillas', 'Cara completa (Cera)'
          ] WHERE nombre = 'Laura'`);

          // Update specialties for Majo (nails, lashes, lifting, facials, cuts, color)
          await pool.query(`UPDATE estilistas SET especialidades = ARRAY[
            'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico',
            'Pestañas volumen', 'Efecto rimel', 'Extensiones clásicas', 'Extensiones híbridas', 'Retoque clásicas', 'Retoque efecto rímel', 'Retoque híbrida', 'Retoque volumen', 'Retiro pestañas', 'Pestañas de tira', 'Lifting de pestañas', 'Lifting de pestañas/tinta',
            'Limpieza profunda', 'Humectación',
            'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
            'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente'
          ] WHERE nombre = 'Majo'`);

          // Update specialties for Tony (cuts, color, peinados - no cejas, IPL, cera, lifting, treatments)
          await pool.query(`UPDATE estilistas SET especialidades = ARRAY[
            'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
            'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
            'Peinado tenaza ondulado', 'Alto peinado chongo', 'Secado/brushing', 'Medio recogido'
          ] WHERE nombre = 'Tony'`);

          // Ensure campaign services exist in PostgreSQL
          await pool.query(`
            INSERT INTO servicios (nombre, duracion_minutos, precio_fijo) VALUES 
            ('Nanoplastia Premium', 300, 3200.00),
            ('Depilación IPL', 60, 3200.00),
            ('Diagnóstico IPL', 20, 300.00),
            ('Microblading', 180, 4800.00),
            ('Micropigmentación', 180, 5500.00)
            ON CONFLICT (nombre) DO UPDATE SET 
              precio_fijo = EXCLUDED.precio_fijo, 
              duracion_minutos = EXCLUDED.duracion_minutos;
          `);

          // Update specialties for campaign stylings in PostgreSQL
          await pool.query(`
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Nanoplastia Premium') 
            WHERE nombre = 'Pili' AND NOT ('Nanoplastia Premium' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Nanoplastia Premium') 
            WHERE nombre = 'Joel' AND NOT ('Nanoplastia Premium' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Nanoplastia Premium') 
            WHERE nombre = 'Rose' AND NOT ('Nanoplastia Premium' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Depilación IPL') 
            WHERE nombre = 'Rose' AND NOT ('Depilación IPL' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Diagnóstico IPL') 
            WHERE nombre = 'Rose' AND NOT ('Diagnóstico IPL' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Depilación IPL') 
            WHERE nombre = 'Laura' AND NOT ('Depilación IPL' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Diagnóstico IPL') 
            WHERE nombre = 'Laura' AND NOT ('Diagnóstico IPL' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Microblading') 
            WHERE nombre = 'Lizbeth' AND NOT ('Microblading' = ANY(especialidades));
            
            UPDATE estilistas 
            SET especialidades = array_append(especialidades, 'Micropigmentación') 
            WHERE nombre = 'Lizbeth' AND NOT ('Micropigmentación' = ANY(especialidades));
          `);
          
          console.log('Stylists colors and specialties updated successfully in PostgreSQL.');
        } catch (colorErr) {
          console.warn('Could not update stylist info in database:', colorErr.message);
        }

        // Migration: sync inventory items & prices from initialData
        try {
          for (const item of initialData.inventario) {
            await pool.query(`
              INSERT INTO inventario (key_name, nombre, stock, min, cost_per_unit, price, item_type)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (key_name) DO NOTHING
            `, [item.key_name, item.nombre, item.stock, item.min, item.cost_per_unit, item.price, item.item_type]);
            if (item.price !== null) {
              await pool.query(
                'UPDATE inventario SET price = $1 WHERE key_name = $2 AND price IS NULL',
                [item.price, item.key_name]
              );
            }
          }
          console.log(`[DB] Inventory sync migration applied (${initialData.inventario.length} items).`);
        } catch (invErr) {
          console.warn('[DB] Inventory sync migration warning:', invErr.message);
        }
        
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
        return;
      } catch (err) {
        console.warn(`PostgreSQL connection attempt failed (${retries} retries left). Error: ${err.message}`);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.error('All PostgreSQL connection attempts failed.');
          if (process.env.NODE_ENV === 'production') {
            console.error('CRITICAL: Running in production with DATABASE_URL, but connection failed. Exiting process to trigger container restart.');
            process.exit(1);
          } else {
            console.warn('Falling back to local JSON file storage.');
            useFallback = true;
          }
        }
      }
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
          c.link_comprobante,
          c.pago_tarjeta,
          c.pago_efectivo,
          c.descuento_especial,
          c.insumo_tinte_tubos,
          c.insumo_tinte_tapa_bella,
          c.insumo_tinte_tapa_loreal,
          c.insumo_tinte_precio_tubo,
          c.insumo_tinte_precio_bella,
          c.insumo_tinte_precio_loreal,
          c.precio_cobrado
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
          link_comprobante: cita.link_comprobante,
          pago_tarjeta: cita.pago_tarjeta || 0,
          pago_efectivo: cita.pago_efectivo || 0,
          descuento_especial: !!cita.descuento_especial,
          insumo_tinte_tubos: cita.insumo_tinte_tubos || 0,
          insumo_tinte_tapa_bella: cita.insumo_tinte_tapa_bella || 0,
          insumo_tinte_tapa_loreal: cita.insumo_tinte_tapa_loreal || 0,
          insumo_tinte_precio_tubo: cita.insumo_tinte_precio_tubo || 220.00,
          insumo_tinte_precio_bella: cita.insumo_tinte_precio_bella || 50.00,
          insumo_tinte_precio_loreal: cita.insumo_tinte_precio_loreal || 60.00,
          precio_cobrado: cita.precio_cobrado !== undefined ? cita.precio_cobrado : null
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
      let customerVal = updateFields.customer;
      if (updateFields.phone !== undefined) {
        if (updateFields.phone) {
          const cleanPhone = updateFields.phone.replace(/\D/g, '');
          if (cleanPhone) {
            let nameToUse = updateFields.customer;
            if (!nameToUse) {
              const currentCita = await pool.query(`
                SELECT c.cliente_id, COALESCE(cc.nombre_cliente, c.cliente_id) AS nombre_cliente
                FROM citas c
                LEFT JOIN control_chats cc ON c.cliente_id = cc.chat_id_whatsapp
                WHERE c.id = $1
              `, [id]);
              nameToUse = currentCita.rows.length > 0 ? currentCita.rows[0].nombre_cliente : 'Cliente';
            }
            const chatRes = await pool.query('SELECT * FROM control_chats WHERE chat_id_whatsapp = $1', [cleanPhone]);
            if (chatRes.rows.length === 0) {
              await pool.query(
                'INSERT INTO control_chats (chat_id_whatsapp, nombre_cliente) VALUES ($1, $2)',
                [cleanPhone, nameToUse]
              );
            } else if (updateFields.customer) {
              await pool.query(
                'UPDATE control_chats SET nombre_cliente = $1 WHERE chat_id_whatsapp = $2',
                [updateFields.customer, cleanPhone]
              );
            }
            customerVal = cleanPhone;
          }
        } else {
          customerVal = updateFields.customer;
        }
      }

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

      if (customerVal !== undefined) {
        query += `cliente_id = $${paramIndex}, `;
        params.push(customerVal);
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

      let newStartTime = null;
      if (updateFields.date !== undefined && updateFields.hour !== undefined) {
        newStartTime = new Date(updateFields.date + 'T' + updateFields.hour + ':00-06:00');
        query += `fecha_hora_inicio = $${paramIndex}, `;
        params.push(newStartTime.toISOString());
        paramIndex++;
      }

      let durationHours = updateFields.duration !== undefined ? Number(updateFields.duration) : null;
      if (durationHours !== null || newStartTime !== null) {
        let finalStart = newStartTime;
        if (!finalStart) {
          const current = await pool.query('SELECT fecha_hora_inicio FROM citas WHERE id = $1', [id]);
          if (current.rows.length > 0) {
            finalStart = new Date(current.rows[0].fecha_hora_inicio);
          }
        }
        
        if (durationHours === null) {
          const current = await pool.query(`
            SELECT c.fecha_hora_inicio, c.fecha_hora_fin, s.duracion_minutos 
            FROM citas c 
            LEFT JOIN servicios s ON s.id = c.servicio_id 
            WHERE c.id = $1
          `, [id]);
          if (current.rows.length > 0) {
            const start = new Date(current.rows[0].fecha_hora_inicio);
            const end = new Date(current.rows[0].fecha_hora_fin);
            durationHours = (end - start) / (60 * 60 * 1000);
            if (isNaN(durationHours) || durationHours <= 0) {
              durationHours = (current.rows[0].duracion_minutos || 60) / 60;
            }
          }
        }

        if (finalStart && durationHours) {
          const endTime = new Date(finalStart.getTime() + durationHours * 60 * 60000);
          query += `fecha_hora_fin = $${paramIndex}, `;
          params.push(endTime.toISOString());
          paramIndex++;
        }
      }

      if (updateFields.pago_tarjeta !== undefined) {
        query += `pago_tarjeta = $${paramIndex}, `;
        params.push(Number(updateFields.pago_tarjeta));
        paramIndex++;
      }

      if (updateFields.pago_efectivo !== undefined) {
        query += `pago_efectivo = $${paramIndex}, `;
        params.push(Number(updateFields.pago_efectivo));
        paramIndex++;
      }

      if (updateFields.descuento_especial !== undefined) {
        query += `descuento_especial = $${paramIndex}, `;
        params.push(!!updateFields.descuento_especial);
        paramIndex++;
      }

      if (updateFields.insumo_tinte_tubos !== undefined) {
        query += `insumo_tinte_tubos = $${paramIndex}, `;
        params.push(Number(updateFields.insumo_tinte_tubos));
        paramIndex++;
      }

      if (updateFields.insumo_tinte_tapa_bella !== undefined) {
        query += `insumo_tinte_tapa_bella = $${paramIndex}, `;
        params.push(Number(updateFields.insumo_tinte_tapa_bella));
        paramIndex++;
      }

      if (updateFields.insumo_tinte_tapa_loreal !== undefined) {
        query += `insumo_tinte_tapa_loreal = $${paramIndex}, `;
        params.push(Number(updateFields.insumo_tinte_tapa_loreal));
        paramIndex++;
      }

      if (updateFields.insumo_tinte_precio_tubo !== undefined) {
        query += `insumo_tinte_precio_tubo = $${paramIndex}, `;
        params.push(Number(updateFields.insumo_tinte_precio_tubo));
        paramIndex++;
      }

      if (updateFields.insumo_tinte_precio_bella !== undefined) {
        query += `insumo_tinte_precio_bella = $${paramIndex}, `;
        params.push(Number(updateFields.insumo_tinte_precio_bella));
        paramIndex++;
      }

      if (updateFields.insumo_tinte_precio_loreal !== undefined) {
        query += `insumo_tinte_precio_loreal = $${paramIndex}, `;
        params.push(Number(updateFields.insumo_tinte_precio_loreal));
        paramIndex++;
      }

      if (updateFields.precio_cobrado !== undefined) {
        query += `precio_cobrado = $${paramIndex}, `;
        params.push(updateFields.precio_cobrado !== null ? Number(updateFields.precio_cobrado) : null);
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
        let customerVal = updateFields.customer;
        if (updateFields.phone !== undefined) {
          if (updateFields.phone) {
            const cleanPhone = updateFields.phone.replace(/\D/g, '');
            if (cleanPhone) {
              if (!data.control_chats) data.control_chats = [];
              let nameToUse = updateFields.customer || (data.control_chats.find(ch => ch.chat_id_whatsapp === cita.cliente_id) || {}).nombre_cliente || cita.cliente_id;
              const chat = data.control_chats.find(ch => ch.chat_id_whatsapp === cleanPhone);
              if (!chat) {
                data.control_chats.push({ chat_id_whatsapp: cleanPhone, nombre_cliente: nameToUse });
              } else if (updateFields.customer) {
                chat.nombre_cliente = updateFields.customer;
              }
              customerVal = cleanPhone;
            }
          }
        }

        if (updateFields.estado !== undefined || updateFields.status !== undefined) {
          const val = updateFields.status !== undefined ? updateFields.status : updateFields.estado;
          cita.estado = (val === 'Cobrado' || val === 'confirmada' ? 'confirmada' : 'anticipo_pendiente');
        }
        if (updateFields.link_comprobante !== undefined || updateFields.formula !== undefined) {
          cita.link_comprobante = updateFields.formula !== undefined ? updateFields.formula : updateFields.link_comprobante;
        }
        if (customerVal !== undefined) {
          cita.cliente_id = customerVal;
        }
        if (updateFields.stylist !== undefined) {
          const sty = data.estilistas.find(e => e.nombre === updateFields.stylist);
          cita.estilista_id = sty ? sty.id : null;
        }
        if (updateFields.service !== undefined) {
          const svc = data.servicios.find(s => s.nombre === updateFields.service);
          cita.servicio_id = svc ? svc.id : null;
        }

        let newStart = cita.fecha_hora_inicio;
        if (updateFields.date !== undefined && updateFields.hour !== undefined) {
          newStart = new Date(`${updateFields.date}T${updateFields.hour}:00-06:00`).toISOString();
          cita.fecha_hora_inicio = newStart;
        }

        let durationHours = updateFields.duration !== undefined ? Number(updateFields.duration) : null;
        if (durationHours !== null || (updateFields.date !== undefined && updateFields.hour !== undefined)) {
          if (durationHours === null) {
            const start = new Date(cita.fecha_hora_inicio);
            const end = new Date(cita.fecha_hora_fin);
            durationHours = (end - start) / (60 * 60 * 1000);
            if (isNaN(durationHours) || durationHours <= 0) {
              const svc = data.servicios.find(s => s.id === cita.servicio_id);
              durationHours = (svc ? svc.duracion_minutos : 60) / 60;
            }
          }
          cita.fecha_hora_fin = new Date(new Date(cita.fecha_hora_inicio).getTime() + durationHours * 60 * 60000).toISOString();
        }

        if (updateFields.pago_tarjeta !== undefined) cita.pago_tarjeta = Number(updateFields.pago_tarjeta);
        if (updateFields.pago_efectivo !== undefined) cita.pago_efectivo = Number(updateFields.pago_efectivo);
        if (updateFields.descuento_especial !== undefined) cita.descuento_especial = !!updateFields.descuento_especial;
        if (updateFields.insumo_tinte_tubos !== undefined) cita.insumo_tinte_tubos = Number(updateFields.insumo_tinte_tubos);
        if (updateFields.insumo_tinte_tapa_bella !== undefined) cita.insumo_tinte_tapa_bella = Number(updateFields.insumo_tinte_tapa_bella);
        if (updateFields.insumo_tinte_tapa_loreal !== undefined) cita.insumo_tinte_tapa_loreal = Number(updateFields.insumo_tinte_tapa_loreal);
        if (updateFields.insumo_tinte_precio_tubo !== undefined) cita.insumo_tinte_precio_tubo = Number(updateFields.insumo_tinte_precio_tubo);
        if (updateFields.insumo_tinte_precio_bella !== undefined) cita.insumo_tinte_precio_bella = Number(updateFields.insumo_tinte_precio_bella);
        if (updateFields.insumo_tinte_precio_loreal !== undefined) cita.insumo_tinte_precio_loreal = Number(updateFields.insumo_tinte_precio_loreal);
        if (updateFields.precio_cobrado !== undefined) cita.precio_cobrado = updateFields.precio_cobrado !== null ? Number(updateFields.precio_cobrado) : null;

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
      const res = await pool.query('SELECT stylist, service, amount, commission, type, date, COALESCE(propina, 0) as propina FROM nomina ORDER BY id DESC');
      return res.rows;
    } else {
      const data = loadFallback();
      return data.nomina;
    }
  },

  async addPayrollItem(item) {
    if (!useFallback) {
      const res = await pool.query(
        'INSERT INTO nomina (stylist, service, amount, commission, type, date, cita_id, propina) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [item.stylist, item.service, item.amount, item.commission, item.type, item.date, item.cita_id || null, item.propina || 0]
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
      const res = await pool.query('SELECT time, username, txt FROM logs_sistema ORDER BY id DESC LIMIT 50');
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
      const svcRes = await pool.query('SELECT id, duracion_minutos FROM servicios WHERE nombre = $1', [app.service]);
      const styRes = await pool.query('SELECT id FROM estilistas WHERE nombre = $1', [app.stylist]);
      
      const svcId = svcRes.rows.length > 0 ? svcRes.rows[0].id : null;
      const styId = styRes.rows.length > 0 ? styRes.rows[0].id : null;
      const defaultDurationMin = svcRes.rows.length > 0 ? svcRes.rows[0].duracion_minutos : 60;
      
      let startTime = new Date();
      if (app.date && app.hour) {
        startTime = new Date(app.date + 'T' + app.hour + ':00-06:00');
      }

      const durationMin = app.duration ? (Number(app.duration) * 60) : defaultDurationMin;
      const endTime = new Date(startTime.getTime() + durationMin * 60000);

      let clientVal = app.customer;
      if (app.phone) {
        const cleanPhone = app.phone.replace(/\D/g, '');
        if (cleanPhone) {
          const chatRes = await pool.query('SELECT * FROM control_chats WHERE chat_id_whatsapp = $1', [cleanPhone]);
          if (chatRes.rows.length === 0) {
            await pool.query(
              'INSERT INTO control_chats (chat_id_whatsapp, nombre_cliente) VALUES ($1, $2)',
              [cleanPhone, app.customer]
            );
          } else {
            await pool.query(
              'UPDATE control_chats SET nombre_cliente = $1 WHERE chat_id_whatsapp = $2',
              [app.customer, cleanPhone]
            );
          }
          clientVal = cleanPhone;
        }
      }
      
      const res = await pool.query(
        `INSERT INTO citas (
          cliente_id, estilista_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado,
          pago_tarjeta, pago_efectivo, descuento_especial,
          insumo_tinte_tubos, insumo_tinte_tapa_bella, insumo_tinte_tapa_loreal,
          insumo_tinte_precio_tubo, insumo_tinte_precio_bella, insumo_tinte_precio_loreal,
          precio_cobrado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          clientVal, styId, svcId, startTime.toISOString(), endTime.toISOString(),
          app.status === 'Cobrado' ? 'confirmada' : 'anticipo_pendiente',
          Number(app.pago_tarjeta || 0), Number(app.pago_efectivo || 0), !!app.descuento_especial,
          Number(app.insumo_tinte_tubos || 0), Number(app.insumo_tinte_tapa_bella || 0), Number(app.insumo_tinte_tapa_loreal || 0),
          Number(app.insumo_tinte_precio_tubo || 220.00), Number(app.insumo_tinte_precio_bella || 50.00), Number(app.insumo_tinte_precio_loreal || 60.00),
          app.precio_cobrado !== undefined && app.precio_cobrado !== null ? Number(app.precio_cobrado) : null
        ]
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
      const durationMin = app.duration ? (Number(app.duration) * 60) : (svc ? svc.duracion_minutos : 60);
      const endStr = new Date(new Date(startStr).getTime() + durationMin * 60000).toISOString();
      
      let clientVal = app.customer;
      if (app.phone) {
        const cleanPhone = app.phone.replace(/\D/g, '');
        if (cleanPhone) {
          if (!data.control_chats) data.control_chats = [];
          const chat = data.control_chats.find(c => c.chat_id_whatsapp === cleanPhone);
          if (!chat) {
            data.control_chats.push({ chat_id_whatsapp: cleanPhone, nombre_cliente: app.customer });
          } else {
            chat.nombre_cliente = app.customer;
          }
          clientVal = cleanPhone;
        }
      }

      const newCita = {
        id: newId,
        cliente_id: clientVal,
        estilista_id: sty ? sty.id : null,
        servicio_id: svc ? svc.id : null,
        fecha_hora_inicio: startStr,
        fecha_hora_fin: endStr,
        estado: app.status === 'Cobrado' ? 'confirmada' : 'anticipo_pendiente',
        link_comprobante: app.formula || null,
        pago_tarjeta: Number(app.pago_tarjeta || 0),
        pago_efectivo: Number(app.pago_efectivo || 0),
        descuento_especial: !!app.descuento_especial,
        insumo_tinte_tubos: Number(app.insumo_tinte_tubos || 0),
        insumo_tinte_tapa_bella: Number(app.insumo_tinte_tapa_bella || 0),
        insumo_tinte_tapa_loreal: Number(app.insumo_tinte_tapa_loreal || 0),
        insumo_tinte_precio_tubo: Number(app.insumo_tinte_precio_tubo || 220.00),
        insumo_tinte_precio_bella: Number(app.insumo_tinte_precio_bella || 50.00),
        insumo_tinte_precio_loreal: Number(app.insumo_tinte_precio_loreal || 60.00),
        precio_cobrado: app.precio_cobrado !== undefined && app.precio_cobrado !== null ? Number(app.precio_cobrado) : null
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
  },

  async getAuthKey(key) {
    if (!useFallback) {
      const res = await pool.query('SELECT value FROM whatsapp_auth WHERE key = $1', [key]);
      return res.rows.length > 0 ? JSON.parse(res.rows[0].value) : null;
    } else {
      const data = loadFallback();
      if (!data.whatsapp_auth) data.whatsapp_auth = {};
      return data.whatsapp_auth[key] ? JSON.parse(data.whatsapp_auth[key]) : null;
    }
  },

  async setAuthKey(key, value) {
    const valStr = JSON.stringify(value);
    if (!useFallback) {
      await pool.query(
        `INSERT INTO whatsapp_auth (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, valStr]
      );
    } else {
      const data = loadFallback();
      if (!data.whatsapp_auth) data.whatsapp_auth = {};
      data.whatsapp_auth[key] = valStr;
      saveFallback(data);
    }
  },

  async deleteAuthKey(key) {
    if (!useFallback) {
      await pool.query('DELETE FROM whatsapp_auth WHERE key = $1', [key]);
    } else {
      const data = loadFallback();
      if (data.whatsapp_auth) {
        delete data.whatsapp_auth[key];
        saveFallback(data);
      }
    }
  },

  isFallback() {
    return useFallback;
  }
};

module.exports = {
  initDb,
  db,
  pool
};
