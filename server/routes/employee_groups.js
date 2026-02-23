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

// GET /api/employee-groups
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;

        const result = db.exec(`SELECT * FROM employee_groups WHERE entity_id = ${entityId} ORDER BY name ASC`);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employee-groups (Admin and HR only)
router.post('/', authMiddleware, async (req, res) => {
    if (!['Admin', 'HR'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const { name, description } = req.body;

        db.run('INSERT INTO employee_groups (entity_id, name, description) VALUES (?, ?, ?)', [entityId, name, description]);

        const result = db.exec('SELECT last_insert_rowid() AS id');
        const id = result[0].values[0][0];

        saveDb();
        res.status(201).json({ id, entity_id: entityId, name, description });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/employee-groups/:id
router.put('/:id', authMiddleware, async (req, res) => {
    if (!['Admin', 'HR'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const { name, description } = req.body;

        db.run('UPDATE employee_groups SET name = ?, description = ? WHERE id = ? AND entity_id = ?', [name, description, req.params.id, entityId]);
        saveDb();
        res.json({ message: 'Employee Group updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employee-groups/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    if (!['Admin', 'HR'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const entityId = req.user.entityId;

        // Ensure no employees are currently using this group
        const empQuery = db.exec(`SELECT count(*) as count FROM employees WHERE employee_group = (SELECT name FROM employee_groups WHERE id = ?) AND entity_id = ?`, [req.params.id, entityId]);
        if (empQuery[0].values[0][0] > 0) {
            return res.status(400).json({ error: 'Cannot delete group because employees are currently assigned to it.' });
        }

        db.run('DELETE FROM employee_groups WHERE id = ? AND entity_id = ?', [req.params.id, entityId]);
        saveDb();
        res.json({ message: 'Employee Group deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
