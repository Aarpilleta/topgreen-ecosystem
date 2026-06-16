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
    link_comprobante TEXT
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
    date VARCHAR(50) NOT NULL
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
('Nanoplastia Premium', 300, 3200.00),
('Balayage Premium', 300, 2100.00),
('Corte Premium', 60, 800.00),
('Tinte de Cobertura', 120, 1200.00),
('Botox Capilar', 90, 850.00),
('Depilación IPL', 60, 3200.00),
('Uñas', 90, 400.00),
('Pestañas', 90, 600.00),
('Lifting', 60, 500.00),
('Maquillaje', 60, 1200.00),
('Microblading', 180, 4800.00),
('Micropigmentación', 180, 5500.00);

-- Insert Estilistas
INSERT INTO estilistas (nombre, especialidades, color, activo) VALUES
('Pili', ARRAY['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Botox Capilar'], '#10b981', true),
('Joel', ARRAY['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Botox Capilar'], '#3b82f6', true),
('Rose', ARRAY['Nanoplastia Premium', 'Balayage Premium', 'Corte Premium', 'Tinte de Cobertura', 'Depilación IPL', 'Pestañas', 'Lifting', 'Maquillaje', 'Botox Capilar'], '#a855f7', true),
('Majo', ARRAY['Uñas', 'Pestañas'], '#ec4899', true),
('Cande', ARRAY['Uñas'], '#f43f5e', true),
('Judith', ARRAY['Uñas'], '#f59e0b', true),
('Laura', ARRAY['Uñas'], '#14b8a6', true),
('Lizbeth', ARRAY['Microblading', 'Micropigmentación'], '#d97706', true),
('Fran', ARRAY['Corte Premium'], '#6366f1', true);

-- Insert Inventario
INSERT INTO inventario (key_name, nombre, stock, min, cost_per_unit, price, item_type) VALUES
('nanoplastia_elixir', 'Elixir Nanoplastia (ml)', 1500, 500, 1.50, NULL, 'insumo'),
('jade_tinte', 'Tinte Jade Green (g)', 380, 300, 4.00, NULL, 'insumo'),
('shampoo_retail', 'Shampoo Jade Protect (Pzs)', 12, 4, 200.00, 450.00, 'retail'),
('mask_retail', 'Mascarilla Menta (Pzs)', 2, 3, 300.00, 680.00, 'retail');


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
