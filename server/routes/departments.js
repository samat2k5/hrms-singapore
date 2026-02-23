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

// GET /api/departments
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;

        const result = db.exec('SELECT * FROM departments WHERE entity_id = ? ORDER BY name ASC', [entityId]);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/departments (Admin and HR only)
router.post('/', authMiddleware, async (req, res) => {
    if (!['Admin', 'HR'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const { name, description } = req.body;

        db.run('INSERT INTO departments (entity_id, name, description) VALUES (?, ?, ?)', [entityId, name, description]);

        const result = db.exec('SELECT last_insert_rowid() AS id');
        const id = result[0].values[0][0];

        saveDb();
        res.status(201).json({ id, entity_id: entityId, name, description });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/departments/:id
router.put('/:id', authMiddleware, async (req, res) => {
    if (!['Admin', 'HR'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const { name, description } = req.body;

        db.run('UPDATE departments SET name = ?, description = ? WHERE id = ? AND entity_id = ?', [name, description, req.params.id, entityId]);
        saveDb();
        res.json({ message: 'Department updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/departments/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    if (!['Admin', 'HR'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const entityId = req.user.entityId;

        // Prevent deletion if employees are tied to it (Optional: or we can just let it be a free-text field in employees)
        // Currently 'department' in employees is free text, so safe to delete
        db.run('DELETE FROM departments WHERE id = ? AND entity_id = ?', [req.params.id, entityId]);
        saveDb();
        res.json({ message: 'Department deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
