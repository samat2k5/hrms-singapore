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

router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM employee_grades WHERE entity_id = ? ORDER BY name ASC', [req.user.entityId]);
        res.json(toObjects(result));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        db.run(`INSERT INTO employee_grades (entity_id, name, description) VALUES (?, ?, ?)`, [req.user.entityId, name, description || '']);
        saveDb();
        res.status(201).json({ message: 'Grade created' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`DELETE FROM employee_grades WHERE id = ${req.params.id} AND entity_id = ${req.user.entityId}`);
        saveDb();
        res.json({ message: 'Grade deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
