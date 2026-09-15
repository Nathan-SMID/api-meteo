import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();

app.use(express.json());
app.use(cors());

const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'database',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'meteo'
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET pas dans lenv');
}

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

app.get('/', async (req, res) => {
    res.json({ "Bienvenue": "API Meteo" });
});

app.post('/auth/login', async (req, res) => {
    const { apiKey } = req.body;

    if (!process.env.API_KEY) {
        return res.status(500).json({ error: 'API_KEY non configurée côté serveur' });
    }

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Clé API invalide' });
    }

    const token = jwt.sign({ scope: 'write' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
});

// Stations
app.post('/station', requireAuth, async (req, res) => {
    const measure = req.body;

    await connection.query(
        'INSERT INTO stations (name, longitude, lattitude) VALUES (?, ?, ?)',
        [req.body.name, req.body.longitude, req.body.lattitude]
    );

    res.json(
        measure
    );
})

app.get('/stations', async (req, res) => {
    const [results] = await connection.query('SELECT * FROM stations');

    res.json({
        stations: results,
        total: results.length
    });
});

app.get('/station/:id', async (req, res) => {
    const [result] = await connection.query(
        'SELECT * FROM stations WHERE id = ?',
        [req.params.id]
    );

    res.json(result[0]);
});

app.delete('/station/:stationId', requireAuth, async (req, res) => {
    const [result] = await connection.query(
        'DELETE FROM stations WHERE id = ?',
        [req.params.stationId]
    );

    res.json(result);
});

// Measures
app.post('/measure', requireAuth, async (req, res) => {
    const measure = req.body;

    await connection.query(
        'INSERT INTO measures (temperature, humidity, brightness, station_id) VALUES (?, ?, ?, ?)',
        [req.body.temperature, req.body.humidity, req.body.brightness, req.body.stationId]
    );

    res.json(measure);
});

app.get('/measures', async (req, res) => {
    const [results] = await connection.query('SELECT * FROM measures');

    res.json({
        measures: results,
        total: results.length
    });
});

app.get('/measures/station/:stationId', async (req, res) => {
    const [results] = await connection.query(
        'SELECT * FROM measures WHERE station_id = ?',
        [req.params.stationId]
    );

    res.json({
        measures: results,
        total: results.length
    });
});

app.listen(3000, () => {
    console.log('API ready !');
});
