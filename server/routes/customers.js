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

// GET /api/customers — List all customers for the active entity
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`SELECT * FROM customers WHERE entity_id = ${req.user.entityId} ORDER BY name`);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/customers — Add new customer
router.post('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { name, description } = req.body;
        db.run(
            `INSERT INTO customers (entity_id, name, description) VALUES (?, ?, ?)`,
            [req.user.entityId, name, description]
        );
        saveDb();
        res.status(201).json({ message: 'Customer created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/customers/:id — Update customer
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { name, description } = req.body;
        db.run(
            `UPDATE customers SET name = ?, description = ? WHERE id = ? AND entity_id = ?`,
            [name, description, req.params.id, req.user.entityId]
        );
        saveDb();
        res.json({ message: 'Customer updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/customers/:id — Delete customer
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`DELETE FROM customers WHERE id = ${req.params.id} AND entity_id = ${req.user.entityId}`);
        saveDb();
        res.json({ message: 'Customer deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
