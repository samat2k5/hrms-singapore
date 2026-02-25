const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db/init');

// Minimal helper to safely convert SQL.js arrays to objects
const toObjects = (res) => {
    if (!res || res.length === 0) return [];
    return res[0].values.map(row => {
        const obj = {};
        res[0].columns.forEach((col, idx) => { obj[col] = row[idx]; });
        return obj;
    });
};

// GET /api/shift-settings
router.get('/', async (req, res) => {
    let entityId = req.query.entityId;

    // Use header if query param is not provided (from authMiddleware or api.js payload)
    if (!entityId && req.headers['entity-id']) {
        entityId = req.headers['entity-id'];
    }

    if (!entityId) {
        return res.status(400).json({ error: 'Missing entity context' });
    }

    try {
        const db = await getDb();
        const results = db.exec('SELECT * FROM shift_settings WHERE entity_id = ? ORDER BY shift_name ASC', [entityId]);
        res.json(toObjects(results));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/shift-settings
router.post('/', async (req, res) => {
    const {
        entity_id,
        shift_name,
        start_time,
        end_time,
        ot_start_time,
        late_arrival_threshold_mins,
        early_departure_threshold_mins,
        late_arrival_penalty_block_mins,
        early_departure_penalty_block_mins,
        compulsory_ot_hours,
        lunch_break_mins,
        dinner_break_mins,
        midnight_break_mins
    } = req.body;

    if (!entity_id || !shift_name) {
        return res.status(400).json({ error: 'Missing required fields (entity_id, shift_name)' });
    }

    try {
        const db = await getDb();
        db.run(`
            INSERT INTO shift_settings (
                entity_id, shift_name, start_time, end_time, ot_start_time, 
                late_arrival_threshold_mins, early_departure_threshold_mins,
                late_arrival_penalty_block_mins, early_departure_penalty_block_mins,
                compulsory_ot_hours, lunch_break_mins, dinner_break_mins, midnight_break_mins
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            entity_id, shift_name,
            start_time || '08:00',
            end_time || '17:00',
            ot_start_time || '17:30',
            late_arrival_threshold_mins || 15,
            early_departure_threshold_mins || 15,
            late_arrival_penalty_block_mins || 0,
            early_departure_penalty_block_mins || 0,
            compulsory_ot_hours || 0,
            lunch_break_mins || 0,
            dinner_break_mins || 0,
            midnight_break_mins || 0
        ]);

        saveDb();

        const result = db.exec('SELECT * FROM shift_settings WHERE id = last_insert_rowid()');
        res.status(201).json(toObjects(result)[0]);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'A shift setting with this name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/shift-settings/:id
router.put('/:id', async (req, res) => {
    const {
        shift_name,
        start_time,
        end_time,
        ot_start_time,
        late_arrival_threshold_mins,
        early_departure_threshold_mins,
        late_arrival_penalty_block_mins,
        early_departure_penalty_block_mins,
        compulsory_ot_hours,
        lunch_break_mins,
        dinner_break_mins,
        midnight_break_mins
    } = req.body;

    try {
        const db = await getDb();
        db.run(`
            UPDATE shift_settings SET 
                shift_name = ?, start_time = ?, end_time = ?, ot_start_time = ?, 
                late_arrival_threshold_mins = ?, early_departure_threshold_mins = ?,
                late_arrival_penalty_block_mins = ?, early_departure_penalty_block_mins = ?,
                compulsory_ot_hours = ?, lunch_break_mins = ?, dinner_break_mins = ?, midnight_break_mins = ?
            WHERE id = ?
        `, [
            shift_name, start_time, end_time, ot_start_time,
            late_arrival_threshold_mins, early_departure_threshold_mins,
            late_arrival_penalty_block_mins, early_departure_penalty_block_mins,
            compulsory_ot_hours,
            lunch_break_mins || 0,
            dinner_break_mins || 0,
            midnight_break_mins || 0,
            req.params.id
        ]);

        saveDb();

        const result = db.exec('SELECT * FROM shift_settings WHERE id = ?', [req.params.id]);
        if (result.length === 0) {
            return res.status(404).json({ error: 'Shift setting not found' });
        }
        res.json(toObjects(result)[0]);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'A shift setting with this name already exists.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/shift-settings/:id
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        db.run('DELETE FROM shift_settings WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Shift setting deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
