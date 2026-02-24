const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function toObjects(result) {
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

// GET /api/sites — List all sites securely resolving through customer ownership
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`
            SELECT s.*, c.name as customer_name 
            FROM sites s
            JOIN customers c ON s.customer_id = c.id
            WHERE c.entity_id = ${req.user.entityId}
            ORDER BY c.name, s.name
        `);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sites — Add new site
router.post('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { customer_id, name, description } = req.body;

        // Verify customer ownership
        const custResult = db.exec('SELECT id FROM customers WHERE id = ? AND entity_id = ?', [customer_id, req.user.entityId]);
        if (!custResult.length) return res.status(403).json({ error: 'Invalid Customer ID' });

        db.run(
            `INSERT INTO sites (customer_id, name, description) VALUES (?, ?, ?)`,
            [customer_id, name, description]
        );
        saveDb();
        res.status(201).json({ message: 'Site created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/sites/:id — Update site
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { customer_id, name, description } = req.body;

        const custResult = db.exec('SELECT id FROM customers WHERE id = ? AND entity_id = ?', [customer_id, req.user.entityId]);
        if (!custResult.length) return res.status(403).json({ error: 'Invalid Customer ID' });

        db.run(
            `UPDATE sites SET customer_id = ?, name = ?, description = ? WHERE id = ?`,
            [customer_id, name, description, req.params.id]
        );
        saveDb();
        res.json({ message: 'Site updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/sites/:id — Delete site
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        // verify ownership via join
        const s = db.exec('SELECT s.id FROM sites s JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND c.entity_id = ?', [req.params.id, req.user.entityId]);
        if (!s.length) return res.status(404).json({ error: 'Site not found' });

        db.run('DELETE FROM sites WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Site deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/sites/:id/hours — Get working hours mapping for a site
router.get('/:id/hours', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        // verify entity ownership
        const siteResult = db.exec('SELECT s.id FROM sites s JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND c.entity_id = ?', [req.params.id, req.user.entityId]);
        if (!siteResult.length) return res.status(404).json({ error: 'Site not found' });

        const result = db.exec('SELECT * FROM site_working_hours WHERE site_id = ? ORDER BY shift_type, day_of_week', [req.params.id]);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sites/:id/hours — Batch save working hours for a site
router.post('/:id/hours', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const schedules = req.body; // array of objects

        // Verify entity ownership
        const siteResult = db.exec('SELECT s.id FROM sites s JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND c.entity_id = ?', [id, req.user.entityId]);
        if (!siteResult.length) return res.status(404).json({ error: 'Site not found' });

        // Delete existing and insert new block
        db.run('DELETE FROM site_working_hours WHERE site_id = ?', [id]);

        for (const s of schedules) {
            db.run(
                `INSERT INTO site_working_hours 
                (site_id, shift_type, day_of_week, start_time, end_time, meal_start_time, meal_end_time, 
                 ot_start_time, compulsory_ot_hours, ot_meal_start_time, ot_meal_end_time, 
                 late_arrival_threshold_mins, early_departure_threshold_mins,
                 late_arrival_penalty_block_mins, early_departure_penalty_block_mins) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, s.shift_type, s.day_of_week, s.start_time || null, s.end_time || null,
                    s.meal_start_time || null, s.meal_end_time || null, s.ot_start_time || null,
                    s.compulsory_ot_hours || 0, s.ot_meal_start_time || null, s.ot_meal_end_time || null,
                    s.late_arrival_threshold_mins || 0, s.early_departure_threshold_mins || 0,
                    s.late_arrival_penalty_block_mins || 0, s.early_departure_penalty_block_mins || 0
                ]
            );
        }

        saveDb();
        res.json({ message: 'Schedule updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
