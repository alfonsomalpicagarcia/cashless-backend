const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'cashless_db';

let db;
let client;

const defaultProductos = [
    { nombre: 'Hamburguesa Clásica', precio: 150, categoria: 'alimentos', icono: '🍔', activo: true },
    { nombre: 'Pizza Margarita', precio: 180, categoria: 'alimentos', icono: '🍕', activo: true },
    { nombre: 'Ensalada Caesar', precio: 120, categoria: 'alimentos', icono: '🥗', activo: true },
    { nombre: 'Cerveza Corona', precio: 60, categoria: 'bebidas', icono: '🍺', activo: true },
    { nombre: 'Margarita', precio: 120, categoria: 'bebidas', icono: '🍹', activo: true },
    { nombre: 'Agua Mineral', precio: 35, categoria: 'bebidas', icono: '💧', activo: true },
    { nombre: 'Café Americano', precio: 45, categoria: 'bebidas', icono: '☕', activo: true },
    { nombre: 'Renta Kayak 1hr', precio: 200, categoria: 'deportes', icono: '🚣', activo: true },
    { nombre: 'Tabla Paddle 1hr', precio: 250, categoria: 'deportes', icono: '🏄', activo: true },
    { nombre: 'Masaje Relajante', precio: 450, categoria: 'spa', icono: '💆', activo: true }
];

async function ensureProductosSeeded() {
    if (!db) {
        return;
    }

    const productosCollection = db.collection('productos');
    const count = await productosCollection.countDocuments();
    if (count === 0) {
        await productosCollection.insertMany(
            defaultProductos.map(producto => ({
                ...producto,
                createdAt: new Date(),
                updatedAt: new Date()
            }))
        );
        console.log('✅ Productos base insertados');
    }
}

// Connect to MongoDB
async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.warn('⚠️  MONGODB_URI no configurado. El servidor iniciará sin base de datos.');
            return;
        }
        console.log('🔄 Conectando a MongoDB Atlas...');
        console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Ocultar password
        
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        
        // Verificar conexión
        await db.command({ ping: 1 });
        console.log('✅ Conectado a MongoDB Atlas');
        console.log('✅ Base de datos:', DB_NAME);

    await ensureProductosSeeded();
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('1. Verifica en MongoDB Atlas > Security > Network Access');
        console.log('   Debe tener: 0.0.0.0/0 (Allow from anywhere)');
        console.log('2. Verifica tu firewall/antivirus');
        console.log('3. Intenta desde otra red (ej: hotspot móvil)');
        console.log('\n⚠️  Por ahora, el servidor arrancará SIN MongoDB');
        console.log('   (solo para testing local con datos en memoria)');
        // NO salir, continuar sin DB
    }
}

// ========================================
// RUTAS DE API
// ========================================

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Bahía Escondida Cashless API',
        version: '1.0.0'
    });
});

// ========================================
// HUÉSPEDES
// ========================================

// GET - Obtener todos los huéspedes
app.get('/api/huespedes', async (req, res) => {
    try {
        const huespedes = await db.collection('huespedes')
            .find({ activo: true })
            .sort({ fechaRegistro: -1 })
            .toArray();
        res.json(huespedes);
    } catch (error) {
        console.error('Error obteniendo huéspedes:', error);
        res.status(500).json({ error: 'Error al obtener huéspedes' });
    }
});

// GET - Obtener huésped por ID
app.get('/api/huespedes/:id', async (req, res) => {
    try {
        const huesped = await db.collection('huespedes')
            .findOne({ _id: new ObjectId(req.params.id) });
        
        if (!huesped) {
            return res.status(404).json({ error: 'Huésped no encontrado' });
        }
        
        res.json(huesped);
    } catch (error) {
        console.error('Error obteniendo huésped:', error);
        res.status(500).json({ error: 'Error al obtener huésped' });
    }
});

// POST - Crear nuevo huésped
app.post('/api/huespedes', async (req, res) => {
    try {
        const nuevoHuesped = {
            ...req.body,
            fechaRegistro: new Date().toISOString(),
            activo: true,
            createdAt: new Date()
        };
        
        const result = await db.collection('huespedes').insertOne(nuevoHuesped);
        
        res.status(201).json({ 
            success: true,
            id: result.insertedId,
            message: 'Huésped registrado exitosamente'
        });
    } catch (error) {
        console.error('Error creando huésped:', error);
        res.status(500).json({ error: 'Error al crear huésped' });
    }
});

// PUT - Actualizar huésped
app.put('/api/huespedes/:id', async (req, res) => {
    try {
        const { _id, ...updateData } = req.body;
        
        const result = await db.collection('huespedes').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Huésped no encontrado' });
        }
        
        res.json({ 
            success: true,
            message: 'Huésped actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error actualizando huésped:', error);
        res.status(500).json({ error: 'Error al actualizar huésped' });
    }
});

// DELETE - Eliminar huésped (soft delete)
app.delete('/api/huespedes/:id', async (req, res) => {
    try {
        const result = await db.collection('huespedes').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { activo: false, deletedAt: new Date() } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Huésped no encontrado' });
        }
        
        res.json({ 
            success: true,
            message: 'Huésped eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error eliminando huésped:', error);
        res.status(500).json({ error: 'Error al eliminar huésped' });
    }
});

// ========================================
// TRANSACCIONES
// ========================================

// GET - Obtener todas las transacciones
app.get('/api/transacciones', async (req, res) => {
    try {
        const transacciones = await db.collection('transacciones')
            .find()
            .sort({ fecha: -1 })
            .toArray();
        res.json(transacciones);
    } catch (error) {
        console.error('Error obteniendo transacciones:', error);
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});

// GET - Obtener transacciones de un huésped
app.get('/api/transacciones/huesped/:huespedId', async (req, res) => {
    try {
        const transacciones = await db.collection('transacciones')
            .find({ huespedId: req.params.huespedId })
            .sort({ fecha: -1 })
            .toArray();
        res.json(transacciones);
    } catch (error) {
        console.error('Error obteniendo transacciones:', error);
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});

// POST - Crear nueva transacción
app.post('/api/transacciones', async (req, res) => {
    try {
        const nuevaTransaccion = {
            ...req.body,
            fecha: new Date().toISOString(),
            createdAt: new Date()
        };
        
        const result = await db.collection('transacciones').insertOne(nuevaTransaccion);
        
        res.status(201).json({ 
            success: true,
            id: result.insertedId,
            message: 'Transacción registrada exitosamente'
        });
    } catch (error) {
        console.error('Error creando transacción:', error);
        res.status(500).json({ error: 'Error al crear transacción' });
    }
});

// ========================================
// PRODUCTOS
// ========================================

// GET - Obtener productos
app.get('/api/productos', async (req, res) => {
    try {
        const categoria = req.query.categoria;
        const filtro = categoria && categoria !== 'todos'
            ? { categoria, activo: true }
            : { activo: true };

        const productos = await db.collection('productos')
            .find(filtro)
            .sort({ categoria: 1, nombre: 1 })
            .toArray();

        res.json(productos);
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// POST - Crear producto
app.post('/api/productos', async (req, res) => {
    try {
        const nuevoProducto = {
            ...req.body,
            activo: req.body.activo ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('productos').insertOne(nuevoProducto);

        res.status(201).json({
            success: true,
            id: result.insertedId,
            message: 'Producto creado exitosamente'
        });
    } catch (error) {
        console.error('Error creando producto:', error);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

// ========================================
// TEST / PING
// ========================================

app.get('/api/ping', async (req, res) => {
    try {
        await db.command({ ping: 1 });
        res.json({ 
            success: true,
            message: 'Conexión a MongoDB exitosa',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Error de conexión a MongoDB' 
        });
    }
});

// ========================================
// START SERVER
// ========================================

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        console.log(`📡 API disponible en: http://localhost:${PORT}`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    if (client) {
        await client.close();
        console.log('✅ Conexión a MongoDB cerrada');
    }
    process.exit(0);
});
