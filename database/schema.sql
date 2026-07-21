-- Database Schema for TOP GREEN Salon

-- Drop existing tables/functions if they exist to allow clean re-runs
DROP TABLE IF EXISTS mensajes CASCADE;
DROP TABLE IF EXISTS citas CASCADE;
DROP TABLE IF EXISTS control_chats CASCADE;
DROP TABLE IF EXISTS estilistas CASCADE;
DROP TABLE IF EXISTS servicios CASCADE;
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS nomina CASCADE;
DROP TABLE IF EXISTS logs_sistema CASCADE;
DROP FUNCTION IF EXISTS calcular_fecha_hora_fin() CASCADE;

-- 1. Servicios Table
CREATE TABLE servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    duracion_minutos INTEGER NOT NULL,
    precio_fijo NUMERIC(10, 2) NOT NULL
);

-- 2. Estilistas Table
CREATE TABLE estilistas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    especialidades TEXT[] NOT NULL,
    color VARCHAR(7) DEFAULT '#10b981',
    activo BOOLEAN DEFAULT true
);

-- 3. Control Chats Table
CREATE TABLE control_chats (
    chat_id_whatsapp VARCHAR(50) PRIMARY KEY,
    nombre_cliente VARCHAR(100) NOT NULL,
    bot_activo BOOLEAN DEFAULT true,
    zona_geografica VARCHAR(100)
);

-- 4. Citas Table
CREATE TABLE citas (
    id SERIAL PRIMARY KEY,
    cliente_id VARCHAR(50) NOT NULL,
    estilista_id INTEGER REFERENCES estilistas(id) ON DELETE SET NULL,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
    fecha_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_hora_fin TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(30) CHECK (estado IN ('pendiente', 'anticipo_pendiente', 'confirmada', 'cancelada')) DEFAULT 'pendiente',
    link_comprobante TEXT,
    pago_tarjeta NUMERIC(10, 2) DEFAULT 0.0,
    pago_efectivo NUMERIC(10, 2) DEFAULT 0.0,
    descuento_especial BOOLEAN DEFAULT false,
    insumo_tinte_tubos INTEGER DEFAULT 0,
    insumo_tinte_tapa_bella INTEGER DEFAULT 0,
    insumo_tinte_tapa_loreal INTEGER DEFAULT 0,
    insumo_tinte_precio_tubo NUMERIC(10, 2) DEFAULT 220.00,
    insumo_tinte_precio_bella NUMERIC(10, 2) DEFAULT 50.00,
    insumo_tinte_precio_loreal NUMERIC(10, 2) DEFAULT 60.00,
    precio_cobrado NUMERIC(10, 2) DEFAULT NULL
);

-- 5. Mensajes Table (for Chat CRM and AI memory)
CREATE TABLE mensajes (
    id SERIAL PRIMARY KEY,
    chat_id_whatsapp VARCHAR(50) REFERENCES control_chats(chat_id_whatsapp) ON DELETE CASCADE,
    remitente VARCHAR(10) CHECK (remitente IN ('bot', 'cliente', 'humano')) NOT NULL,
    texto TEXT NOT NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Inventario Table
CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(100) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    stock INTEGER NOT NULL,
    min INTEGER NOT NULL,
    cost_per_unit NUMERIC(10, 2) NOT NULL,
    price NUMERIC(10, 2),
    item_type VARCHAR(20) NOT NULL
);

-- 7. Nomina Table
CREATE TABLE nomina (
    id SERIAL PRIMARY KEY,
    stylist VARCHAR(100) NOT NULL,
    service VARCHAR(100) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    commission NUMERIC(10, 2) NOT NULL,
    type VARCHAR(20) NOT NULL,
    date VARCHAR(50) NOT NULL,
    cita_id INTEGER REFERENCES citas(id) ON DELETE CASCADE
);

-- 8. Logs Sistema Table
CREATE TABLE logs_sistema (
    id SERIAL PRIMARY KEY,
    time VARCHAR(50) NOT NULL,
    username VARCHAR(100) NOT NULL,
    txt TEXT NOT NULL
);

-- Candado Inmutable: Trigger to calculate fecha_hora_fin
CREATE OR REPLACE FUNCTION calcular_fecha_hora_fin()
RETURNS TRIGGER AS $$
DECLARE
    v_duracion INTEGER;
BEGIN
    SELECT duracion_minutos INTO v_duracion 
    FROM servicios 
    WHERE id = NEW.servicio_id;

    IF v_duracion IS NULL THEN
        RAISE EXCEPTION 'El servicio seleccionado (ID %) no existe.', NEW.servicio_id;
    END IF;

    -- Calculate fecha_hora_fin
    NEW.fecha_hora_fin := NEW.fecha_hora_inicio + (v_duracion || ' minutes')::INTERVAL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_fecha_hora_fin
BEFORE INSERT OR UPDATE OF servicio_id, fecha_hora_inicio ON citas
FOR EACH ROW
EXECUTE FUNCTION calcular_fecha_hora_fin();

-- ==========================================
-- SEED DATA
-- ==========================================

-- Insert Servicios
INSERT INTO servicios (nombre, duracion_minutos, precio_fijo) VALUES
-- CORTES
('Cortes dama o niña', 60, 380.00),
('Cortes caballero o niño', 45, 250.00),
('Contorno caballero', 30, 100.00),
('Corte fleco', 30, 100.00),
('Barba caballero', 30, 150.00),
-- COLOR/TINTE
('Efectos de color', 180, 1200.00),
('Tinte completo', 120, 800.00),
('Retoque de tinte', 90, 650.00),
('Matiz', 60, 450.00),
('Balayage', 240, 2200.00),
('Babylight', 240, 1800.00),
('Luces', 180, 1300.00),
('Extracción de color', 120, 800.00),
('Base permanente', 120, 800.00),
-- PEINADOS
('Peinado tenaza ondulado', 60, 280.00),
('Alto peinado chongo', 90, 550.00),
('Secado/brushing', 45, 200.00),
('Medio recogido', 60, 450.00),
-- TRATAMIENTOS
('Mascarilla capilar', 45, 350.00),
('Botox capilar', 90, 850.00),
('Nanoplastia', 180, 1800.00),
('Mucota & detox', 90, 600.00),
-- UÑAS
('Esmaltado manos & pies', 30, 100.00),
('Gelish', 45, 150.00),
('Gelish c/n rubber', 60, 350.00),
('Retoque rubber c/n gelish', 60, 300.00),
('Rubber', 45, 250.00),
('Retoque rubber', 45, 200.00),
('Gelish francés', 60, 200.00),
('Retiro de gelish & rubber', 30, 100.00),
('Press on', 60, 500.00),
('Uñas acrílicas', 90, 450.00),
('Uñas acrílicas c/n gelish', 120, 550.00),
('Uñas esculturales', 120, 500.00),
('Poly gel', 90, 500.00),
('Retoque de poly gel', 60, 350.00),
('Uñas tip', 90, 500.00),
('Retoque esculturales', 60, 350.00),
('Retoque acrílico', 60, 350.00),
('Retoque uñas tip', 60, 350.00),
('Retoque press on', 60, 350.00),
('Manicura', 45, 200.00),
('Manicura c/n esmaltado', 60, 260.00),
('Manicura ruso', 45, 260.00),
('Manicura ruso c/n esmalte', 60, 290.00),
('Pedicura', 60, 300.00),
('Pedicura c/n esmaltado', 75, 300.00),
('Pedicura ruso', 60, 350.00),
('Pedicura ruso c/n esmalte', 75, 400.00),
('Retiro esculturales', 30, 150.00),
('Retiro acrílico', 30, 150.00),
-- CEJAS & MAQUILLAJE
('Maquillaje', 60, 750.00),
('Planchado de cejas', 45, 250.00),
('Planchado de ceja c/n henna', 60, 450.00),
('Henna c/n depilación', 45, 250.00),
('Henna ceja', 30, 150.00),
-- DEPILACIÓN IPL
('Espalda completa (IPL)', 60, 4800.00),
('Media espalda (IPL)', 45, 3200.00),
('Brazos (IPL) - $3200', 45, 3200.00),
('Abdomen (IPL)', 45, 3200.00),
('Piernas completas (IPL)', 60, 5200.00),
('Media pierna (IPL)', 45, 3200.00),
('Brazos (IPL) - $3800', 45, 3800.00),
('Bigote (IPL)', 30, 3000.00),
('Paquete IPL: Brazos, pierna completa, bikini y área gluteal', 120, 12800.00),
('Paquete IPL: Axilas, piernas, bikini y area gluteal', 120, 12800.00),
('Cara completa IPL (barbilla, bigote, patillas, mejillas, frente)', 60, 5500.00),
-- PESTAÑAS
('Pestañas volumen', 120, 1400.00),
('Efecto rimel', 90, 800.00),
('Extensiones clásicas', 90, 1000.00),
('Extensiones híbridas', 120, 1200.00),
('Retoque clásicas', 60, 450.00),
('Retoque efecto rímel', 60, 400.00),
('Retoque híbrida', 60, 500.00),
('Retoque volumen', 75, 650.00),
('Retiro pestañas', 30, 100.00),
('Pestañas de tira', 30, 150.00),
('Lifting de pestañas', 60, 650.00),
('Lifting de pestañas/tinta', 75, 800.00),
-- FACIALES
('Limpieza profunda', 60, 450.00),
('Humectación', 45, 450.00),
-- AMPOLLETAS
('Ampolleta Hidratación', 30, 200.00),
('Ampolleta Reparación', 30, 200.00),
-- MICROPIGMENTACIÓN
('Cejas pelo a pelo', 180, 4850.00),
('Delineado de cejas', 180, 4850.00),
('Delineado de ojos', 120, 4850.00),
('Delineado dentro de ojos', 120, 4850.00),
('Relleno de labios', 180, 5500.00),
-- DEPILACIÓN CERA
('Depilación Cera Abdomen', 30, 350.00),
('Depilación Cera Axila', 20, 150.00),
('Depilación Cera Bozo o mentón', 15, 100.00),
('Depilación Cera Brazo', 30, 350.00),
('Depilación Cera Cejas', 20, 150.00),
('Diseño de cejas (Cera)', 30, 200.00),
('Depilación Cera Espalda completa', 45, 450.00),
('Depilación Cera Bikini', 30, 350.00),
('Depilación Cera Ingles', 30, 350.00),
('Depilación Cera Linea central abdomen', 20, 200.00),
('Depilación Cera Media espalda', 30, 450.00),
('Depilación Cera Pierna completa', 45, 600.00),
('Depilación Cera Media pierna', 30, 300.00),
('Depilación Cera Patillas', 20, 150.00),
('Cara completa (Cera)', 45, 500.00);

-- Insert Estilistas
INSERT INTO estilistas (nombre, especialidades, color, activo) VALUES
('Pili', ARRAY[
  'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
  'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
  'Peinado tenaza ondulado', 'Alto peinado chongo', 'Secado/brushing', 'Medio recogido',
  'Mascarilla capilar', 'Botox capilar', 'Nanoplastia', 'Mucota & detox',
  'Ampolleta Hidratación', 'Ampolleta Reparación'
], '#fbbf24', true),

('Joel', ARRAY[
  'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
  'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
  'Peinado tenaza ondulado', 'Alto peinado chongo', 'Secado/brushing', 'Medio recogido',
  'Mascarilla capilar', 'Botox capilar', 'Nanoplastia', 'Mucota & detox',
  'Ampolleta Hidratación', 'Ampolleta Reparación'
], '#38bdf8', true),

('Rose', ARRAY[
  'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero',
  'Efectos de color', 'Tinte completo', 'Retoque de tinte', 'Matiz', 'Balayage', 'Babylight', 'Luces', 'Extracción de color', 'Base permanente',
  'Peinado tenaza ondulado', 'Alto peinado chongo', 'Secado/brushing', 'Medio recogido',
  'Mascarilla capilar', 'Botox capilar', 'Nanoplastia', 'Mucota & detox',
  'Ampolleta Hidratación', 'Ampolleta Reparación',
  'Pestañas volumen', 'Efecto rimel', 'Extensiones clásicas', 'Extensiones híbridas', 'Retoque clásicas', 'Retoque efecto rímel', 'Retoque híbrida', 'Retoque volumen', 'Retiro pestañas', 'Pestañas de tira', 'Lifting de pestañas', 'Lifting de pestañas/tinta',
  'Espalda completa (IPL)', 'Media espalda (IPL)', 'Brazos (IPL) - $3200', 'Abdomen (IPL)', 'Piernas completas (IPL)', 'Media pierna (IPL)', 'Brazos (IPL) - $3800', 'Bigote (IPL)', 'Paquete IPL: Brazos, pierna completa, bikini y área gluteal', 'Paquete IPL: Axilas, piernas, bikini y area gluteal', 'Cara completa IPL (barbilla, bigote, patillas, mejillas, frente)',
  'Depilación Cera Abdomen', 'Depilación Cera Axila', 'Depilación Cera Bozo o mentón', 'Depilación Cera Brazo', 'Depilación Cera Cejas', 'Diseño de cejas (Cera)', 'Depilación Cera Espalda completa', 'Depilación Cera Bikini', 'Depilación Cera Ingles', 'Depilación Cera Linea central abdomen', 'Depilación Cera Media espalda', 'Depilación Cera Pierna completa', 'Depilación Cera Media pierna', 'Depilación Cera Patillas', 'Cara completa (Cera)',
  'Maquillaje', 'Planchado de cejas', 'Planchado de ceja c/n henna', 'Henna c/n depilación', 'Henna ceja'
], '#34d399', true),

('Majo', ARRAY[
  'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico',
  'Pestañas volumen', 'Efecto rimel', 'Extensiones clásicas', 'Extensiones híbridas', 'Retoque clásicas', 'Retoque efecto rímel', 'Retoque híbrida', 'Retoque volumen', 'Retiro pestañas', 'Pestañas de tira', 'Lifting de pestañas', 'Lifting de pestañas/tinta',
  'Limpieza profunda', 'Humectación'
], '#ef4444', true),

('Cande', ARRAY[
  'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico'
], '#f472b6', true),

('Judith', ARRAY[
  'Esmaltado manos & pies', 'Gelish', 'Gelish c/n rubber', 'Retoque rubber c/n gelish', 'Rubber', 'Retoque rubber', 'Gelish francés', 'Retiro de gelish & rubber', 'Press on', 'Uñas acrílicas', 'Uñas acrílicas c/n gelish', 'Uñas esculturales', 'Poly gel', 'Retoque de poly gel', 'Uñas tip', 'Retoque esculturales', 'Retoque acrílico', 'Retoque uñas tip', 'Retoque press on', 'Manicura', 'Manicura c/n esmaltado', 'Manicura ruso', 'Manicura ruso c/n esmalte', 'Pedicura', 'Pedicura c/n esmaltado', 'Pedicura ruso', 'Pedicura ruso c/n esmalte', 'Retiro esculturales', 'Retiro acrílico'
], '#1d4ed8', true),

('Laura', ARRAY[
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
], '#c084fc', true),

('Lizbeth', ARRAY[
  'Cejas pelo a pelo', 'Delineado de cejas', 'Delineado de ojos', 'Delineado dentro de ojos', 'Relleno de labios'
], '#d97706', true),

('Fran', ARRAY[
  'Cortes dama o niña', 'Cortes caballero o niño', 'Contorno caballero', 'Corte fleco', 'Barba caballero'
], '#854d0e', true);

-- Insert Inventario
INSERT INTO inventario (key_name, nombre, stock, min, cost_per_unit, price, item_type) VALUES
  ('nanoplastia_elixir', 'Elixir Nanoplastia (ml)', 1500, 500, 1.50, NULL, 'insumo'),
  ('jade_tinte', 'Tinte Jade Green (g)', 260, 300, 4.00, NULL, 'insumo'),
  ('shampoo_retail', 'Shampoo Jade Protect (Pzs)', 11, 4, 200.00, 450.00, 'retail'),
  ('mask_retail', 'Mascarilla Menta (Pzs)', 1, 3, 300.00, 680.00, 'retail'),
  ('tec_italy_due_facceta_lunga_durata_300_ml', '[Tec Italy] Due facceta lunga durata 300 ml', 4, 2, 0.00, 650.00, 'retail'),
  ('tec_italy_lumina_shampoo_300_ml', '[Tec Italy] lumina shampoo 300 ml', 3, 2, 0.00, 440.00, 'retail'),
  ('tec_italy_lumina_conditioner_300_ml', '[Tec Italy] Lumina conditioner 300 ml', 0, 2, 0.00, 480.00, 'retail'),
  ('tec_italy_lumina_silver_shampoo_300_ml', '[Tec Italy] Lumina Silver Shampoo 300 ml', 4, 2, 0.00, 440.00, 'retail'),
  ('tec_italy_lumina_shampoosilver_1_litro', '[Tec Italy] Lumina shampooSilver 1 litro', 0, 2, 0.00, NULL, 'retail'),
  ('tec_italy_post_color_shampoo_300_ml', '[Tec Italy] post color shampoo 300 ml', 1, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_post_color_shampoo_1_litro', '[Tec Italy] Post color Shampoo 1 litro', 1, 2, 0.00, NULL, 'retail'),
  ('tec_italy_lumina_forza_violeta_300_ml', '[Tec Italy] Lumina forza violeta 300 ml', 2, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_chocolate_300_ml', '[Tec Italy] Lumina forza chocolate 300 ml', 2, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_black_300_ml', '[Tec Italy] Lumina forza black 300 ml', 2, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_rosa_300_ml', '[Tec Italy] Lumina forza rosa 300 ml', 2, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_blonde_300_ml', '[Tec Italy] Lumina forza blonde 300 ml', 2, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_silver_300_ml', '[Tec Italy] Lumina forza Silver 300 ml', 0, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_red_300_ml', '[Tec Italy] Lumina forza Red 300 ml', 0, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_plata_300_ml', '[Tec Italy] Lumina Forza Plata 300 ml', 1, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_blue_300_ml', '[Tec Italy] Lumina Forza Blue 300 ml', 0, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_lumina_forza_cobre_300_ml', '[Tec Italy] Lumina forza cobre 300 ml', 2, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_olio_vital_125_ml', '[Tec Italy] Olio vital 125 ml', 1, 2, 0.00, 670.00, 'retail'),
  ('tec_italy_olivo_vital_color_125_ml', '[Tec Italy] Olivo vital color 125 ml', 0, 2, 0.00, 670.00, 'retail'),
  ('tec_italy_essential_oil_shampoo_300_ml', '[Tec Italy] Essential Oil shampoo 300 ml', 6, 2, 0.00, 440.00, 'retail'),
  ('tec_italy_essential_oil_conditioner_300_ml', '[Tec Italy] Essential Oil conditioner 300 ml', 4, 2, 0.00, 530.00, 'retail'),
  ('tec_italy_essential_oil_treatment_125_ml', '[Tec Italy] Essential Oil Treatment 125 ml', 10, 2, 0.00, 700.00, 'retail'),
  ('tec_italy_essential_oil_mask', '[Tec Italy] Essential Oil Mask', 7, 2, 0.00, 680.00, 'retail'),
  ('tec_italy_due_faccetta_massimo_300_ml', '[Tec Italy] Due faccetta Massimo 300 ml', 4, 2, 0.00, 670.00, 'retail'),
  ('tec_italy_shampoo_massimo_300_ml', '[Tec Italy] Shampoo Massimo 300 ml', 4, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_omni_restore_shampoo_300_ml', '[Tec Italy] Omni Restore Shampoo 300 ml', 5, 2, 0.00, 440.00, 'retail'),
  ('tec_italy_omni_restore_acondicionador_300_ml', '[Tec Italy] Omni Restore Acondicionador 300 ml', 2, 2, 0.00, 520.00, 'retail'),
  ('tec_italy_omni_restore_mascarilla_280_g', '[Tec Italy] Omni Restore mascarilla 280 G', 2, 2, 0.00, 680.00, 'retail'),
  ('tec_italy_omni_restore_protector_125_ml', '[Tec Italy] Omni Restore protector 125 ml', 5, 2, 0.00, 630.00, 'retail'),
  ('tec_italy_amino_keratin_280_g', '[Tec Italy] Amino keratin 280 G', 1, 2, 0.00, 620.00, 'retail'),
  ('tec_italy_amino_keratin_intensivo_mask_1_kg', '[Tec Italy] Amino keratin intensivo mask 1 kg', 0, 2, 0.00, NULL, 'retail'),
  ('tec_italy_due_faccetta_giorno_per_giorno_300_ml', '[Tec Italy] Due faccetta Giorno per giorno 300 ml', 0, 2, 0.00, 650.00, 'retail'),
  ('tec_italy_shampoo_balsami_presto_300_ml', '[Tec Italy] Shampoo Balsami presto 300 ml', 1, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_balsami_presto_tratamiento_300_m', '[Tec Italy] Balsami presto tratamiento 300 m', 4, 2, 0.00, 500.00, 'retail'),
  ('tec_italy_shampoo_totale_condicionados_300_ml', '[Tec Italy] Shampoo totale condicionados 300 ml', 4, 2, 0.00, 590.00, 'retail'),
  ('tec_italy_balsami_totale_300_ml', '[Tec Italy] Balsami totale 300 ml', 0, 2, 0.00, 400.00, 'retail'),
  ('tec_italy_shampoo_hi_moisturizing', '[Tec Italy] Shampoo Hi- Moisturizing', 4, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_hi_moisturizing_conditioner_300_ml', '[Tec Italy] Hi-Moisturizing conditioner 300 ml', 2, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_hi_moisturizing_treatment_280_g', '[Tec Italy] Hi-Moisturizing treatment 280 G', 2, 2, 0.00, 640.00, 'retail'),
  ('tec_italy_working_spray_400_ml', '[Tec Italy] Working spray 400 ml', 6, 2, 0.00, 520.00, 'retail'),
  ('tec_italy_finishing_spray_400_ml', '[Tec Italy] Finishing Spray 400 ml', 6, 2, 0.00, 520.00, 'retail'),
  ('tec_italy_shine_spray_250_ml', '[Tec Italy] Shine Spray 250 ml', 0, 2, 0.00, 500.00, 'retail'),
  ('tec_italy_silk_system_shine_125_ml', '[Tec Italy] Silk System Shine 125 ml', 6, 2, 0.00, 480.00, 'retail'),
  ('tec_italy_metamorfosis_cream_300_ml', '[Tec Italy] Metamorfosis cream 300 ml', 5, 2, 0.00, 520.00, 'retail'),
  ('tec_italy_gel_della_cera_effetto_humedo', '[Tec Italy] Gel Della Cera Effetto Húmedo', 4, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_gel_della_cera_effetto_normal', '[Tec Italy] Gel Della Cera Effetto normal', 8, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_pasta_de_la_arana', '[Tec Italy] Pasta de la araña', 7, 2, 0.00, 400.00, 'retail'),
  ('tec_italy_scultore_fine_300_ml', '[Tec Italy] Scultore fine 300 ml', 0, 2, 0.00, 400.00, 'retail'),
  ('tec_italy_gellini_300_ml', '[Tec Italy] Gellini 300 ml', 0, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_speciale_125_ml', '[Tec Italy] Speciale 125 ml', 0, 2, 0.00, 270.00, 'retail'),
  ('tec_italy_curls_shampoo_300_ml', '[Tec Italy] Curls Shampoo 300 ml', 5, 2, 0.00, 420.00, 'retail'),
  ('tec_italy_curls_conditioner_300_ml', '[Tec Italy] Curls conditioner 300 ml', 5, 2, 0.00, 400.00, 'retail'),
  ('tec_italy_curls_defining_gel_300_ml', '[Tec Italy] Curls defining Gel 300 ml', 6, 2, 0.00, 400.00, 'retail'),
  ('tec_italy_curls_defining_crema_300_ml', '[Tec Italy] Curls defining crema 300 ml', 1, 2, 0.00, 520.00, 'retail'),
  ('tec_italy_due_faccetta_pro', '[Tec Italy] Due faccetta pro', 4, 2, 0.00, 700.00, 'retail'),
  ('tec_italy_shampoo_tonico', '[Tec Italy] Shampoo tónico', 3, 2, 0.00, 370.00, 'retail'),
  ('tec_italy_shampoo_metamorfosis', '[Tec Italy] Shampoo Metamorfosis', 7, 2, 0.00, 400.00, 'retail'),
  ('tec_italy_metamorfosis_cream_1_litro', '[Tec Italy] Metamorfosis cream 1 litro', 1, 2, 0.00, NULL, 'retail'),
  ('tec_italy_profundo_shampoo_1_litro', '[Tec Italy] Profundo shampoo 1 litro', 1, 2, 0.00, NULL, 'retail'),
  ('tec_italy_preciso_para_sellar_cuticula_1_litro', '[Tec Italy] Preciso para sellar cutícula 1 litro', 1, 2, 0.00, NULL, 'retail'),
  ('l_oreal_absolut_repair_500_ml', '[L''Oréal] Absolut repair 500 ml', 5, 2, 0.00, 770.00, 'retail'),
  ('l_oreal_absolut_repair_300_ml', '[L''Oréal] Absolut repair 300 ml', 3, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_absolut_repair_mascarilla', '[L''Oréal] Absolut repair mascarilla', 1, 2, 0.00, 1008.00, 'retail'),
  ('l_oreal_metal_detox_shampoo_500_ml', '[L''Oréal] Metal detox shampoo 500 ml', 5, 2, 0.00, 930.00, 'retail'),
  ('l_oreal_absolut_repair_molecular_protector', '[L''Oréal] Absolut repair molecular protector', 2, 2, 0.00, 840.00, 'retail'),
  ('l_oreal_scalp_advance_shampoo_500_ml', '[L''Oréal] Scalp advance shampoo 500 ml', 3, 2, 0.00, 745.00, 'retail'),
  ('l_oreal_vitamina_color_shampoo_300_ml', '[L''Oréal] Vitamina color shampoo 300 ml', 5, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_vitamina_color_shampoo_500_ml', '[L''Oréal] Vitamina color shampoo 500 ml', 0, 2, 0.00, 750.00, 'retail'),
  ('l_oreal_liss_unlimited_300_ml', '[L''Oréal] Liss unlimited 300 ml', 4, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_liss_unlimited_500_ml', '[L''Oréal] Liss unlimited 500 ml', 1, 2, 0.00, 750.00, 'retail'),
  ('l_oreal_sensi_balance_500_ml_shampoo', '[L''Oréal] Sensi balance 500 ml shampoo', 3, 2, 0.00, 750.00, 'retail'),
  ('l_oreal_metal_detox_protector', '[L''Oréal] Metal detox protector', 1, 2, 0.00, 670.00, 'retail'),
  ('l_oreal_vitamina_color_spectrum_morado_300_ml', '[L''Oréal] Vitamina color spectrum morado 300 ml', 1, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_vitamina_color_spectrum_verde_300_ml', '[L''Oréal] Vitamina color spectrum verde 300 ml', 1, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_scalp_advance_anti_inconformista_shampoo_500_ml', '[L''Oréal] Scalp advance anti inconformista shampoo 500 ml', 2, 2, 0.00, 750.00, 'retail'),
  ('l_oreal_pro_longer_shampoo_300_ml', '[L''Oréal] Pro longer shampoo 300 ml', 1, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_pro_longer_shampoo_500_ml', '[L''Oréal] Pro longer shampoo 500 ml', 1, 2, 0.00, 750.00, 'retail'),
  ('l_oreal_metal_democracia_mascarilla_500_ml', '[L''Oréal] Metal democracia mascarilla 500 ml', 2, 2, 0.00, NULL, 'retail'),
  ('l_oreal_scalp_advance_anti_gras_500_ml_shampoo', '[L''Oréal] Scalp advance anti gras 500 ml shampoo', 2, 2, 0.00, 750.00, 'retail'),
  ('l_oreal_tecni_art_spray', '[L''Oréal] Tecni art spray', 1, 2, 0.00, 620.00, 'retail'),
  ('l_oreal_mythic_oil_200_ml_mascarilla', '[L''Oréal] Mythic oil 200 ml mascarilla', 2, 2, 0.00, 500.00, 'retail'),
  ('l_oreal_dulcia_3', '[L''Oréal] Dulcia 3', 10, 2, 0.00, NULL, 'retail'),
  ('l_oreal_dulcia_1', '[L''Oréal] Dulcia 1', 7, 2, 0.00, NULL, 'retail'),
  ('l_oreal_dulcia_0', '[L''Oréal] Dulcia 0', 9, 2, 0.00, NULL, 'retail'),
  ('l_oreal_dulcia_2', '[L''Oréal] Dulcia 2', 0, 2, 0.00, NULL, 'retail'),
  ('l_oreal_dulcia_neutralizador_1_litro', '[L''Oréal] Dulcia neutralizador 1 litro', 1, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_6_volumenes', '[Peróxido L''Oréal] 6 volúmenes', 6, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_9_volumenes', '[Peróxido L''Oréal] 9 volúmenes.', 7, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_15_volumenes', '[Peróxido L''Oréal] 15 volúmenes', 4, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_20_volumenes', '[Peróxido L''Oréal] 20 volúmenes', 11, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_30_volumenes', '[Peróxido L''Oréal] 30 volúmenes.', 6, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_40_volumenes', '[Peróxido L''Oréal] 40 volúmenes', 4, 2, 0.00, NULL, 'retail'),
  ('peroxido_wella_20_volumenes', '[Peróxido Wella] 20 volúmenes', 2, 2, 0.00, NULL, 'retail'),
  ('peroxido_wella_30_volumenes', '[Peróxido Wella] 30 volúmenes', 1, 2, 0.00, NULL, 'retail'),
  ('peroxido_wella_40_volumenes', '[Peróxido Wella] 40 volúmenes', 2, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_blond_studio_20_volumenes', '[Peróxido L''Oréal Blond Studio] 20 volúmenes', 7, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_blond_studio_30_volumenes', '[Peróxido L''Oréal Blond Studio] 30 volúmenes', 0, 2, 0.00, NULL, 'retail'),
  ('peroxido_l_oreal_blond_studio_40_volumenes', '[Peróxido L''Oréal Blond Studio] 40 volúmenes', 0, 2, 0.00, NULL, 'retail'),
  ('otros_mucota_10', '[Otros] Mucota 10', 3, 2, 0.00, 1025.00, 'retail'),
  ('otros_mucota_04', '[Otros] Mucota 04', 2, 2, 0.00, 960.00, 'retail'),
  ('otros_clean_balance_shampoo', '[Otros] Clean balance shampoo', 2, 2, 0.00, 1400.00, 'retail'),
  ('otros_clean_balance_performance_shampoo', '[Otros] Clean balance performance shampoo', 18, 2, 0.00, 1400.00, 'retail'),
  ('otros_mucota_ex_treatment', '[Otros] Mucota ex treatment', 2, 2, 0.00, 1025.00, 'retail'),
  ('otros_pations_500_ml', '[Otros] Pations 500 ml', 1, 2, 0.00, 1600.00, 'retail'),
  ('otros_mucota_9', '[Otros] Mucota 9', 15, 2, 0.00, 960.00, 'retail'),
  ('otros_promille_color_e', '[Otros] Promille color e', 1, 2, 0.00, 800.00, 'retail'),
  ('otros_nutrifier_glicerol', '[Otros] Nutrifier glicerol', 0, 2, 0.00, NULL, 'retail'),
  ('decolorantes_decolorante_wella', '[Decolorantes] Decolorante wella', 1, 1, 0.00, NULL, 'insumo'),
  ('decolorantes_decolorante_blond_aturdio_8', '[Decolorantes] Decolorante blond aturdio 8', 1, 1, 0.00, NULL, 'insumo'),
  ('decolorantes_decolorante_blond_studio_9', '[Decolorantes] Decolorante blond studio 9', 2, 1, 0.00, NULL, 'insumo'),
  ('decolorantes_decolorante_blond_studio_7', '[Decolorantes] Decolorante blond studio 7', 0, 1, 0.00, NULL, 'insumo')
ON CONFLICT (key_name) DO UPDATE SET stock = EXCLUDED.stock, price = EXCLUDED.price;


-- Insert Logs Sistema
INSERT INTO logs_sistema (time, username, txt) VALUES
('14:42:00', 'SYSTEM', 'Ecosistema operativo TOP GREEN v2.5 activo.'),
('14:45:10', 'SYSTEM', 'Conexión a pasarela comercial activa y verificada.'),
('14:48:02', 'Tony', 'Almacén auditado. Alerta de stock bajo en Mascarilla Menta activada.');

-- Insert test chat control
INSERT INTO control_chats (chat_id_whatsapp, nombre_cliente, bot_activo, zona_geografica) VALUES
('5215512345678', 'Carlos Mendoza', true, 'CDMX - Polanco'),
('5215587654321', 'Maria Delgado', false, 'CDMX - Condesa');

-- Insert initial conversation to test dashboard
INSERT INTO mensajes (chat_id_whatsapp, remitente, texto, fecha_hora) VALUES
('5215512345678', 'cliente', 'Hola, quiero agendar un servicio', NOW() - INTERVAL '10 minutes'),
('5215512345678', 'bot', '¡Hola Carlos! Soy Elena, asistente de TOP GREEN. ¿En qué colonia o CP te encuentras para verificar nuestra cobertura?', NOW() - INTERVAL '9 minutes'),
('5215512345678', 'cliente', 'CP 11560 Polanco', NOW() - INTERVAL '8 minutes'),
('5215512345678', 'bot', 'Excelente, Polanco está dentro de nuestra zona de cobertura. ¿Qué servicio te gustaría agendar? Ofrecemos Nanoplastia Premium, Corte Premium y Nanopore.', NOW() - INTERVAL '7 minutes');
