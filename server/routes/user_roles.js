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

// GET /api/user-roles
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`SELECT * FROM user_roles ORDER BY name`);
        const roles = toObjects(result).map(r => ({
            ...r,
            permissions: JSON.parse(r.permissions || '[]')
        }));
        res.json(roles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/user-roles
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });
        const db = await getDb();
        const { name, description, permissions } = req.body;
        db.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`,
            [name, description, JSON.stringify(permissions || [])]);
        saveDb();
        res.status(201).json({ message: 'Role created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/user-roles/:id
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });
        const db = await getDb();
        const { name, description, permissions } = req.body;
        db.run(`UPDATE user_roles SET name = ?, description = ?, permissions = ? WHERE id = ?`,
            [name, description, JSON.stringify(permissions || []), req.params.id]);
        saveDb();
        res.json({ message: 'Role updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/user-roles/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });
        const db = await getDb();
        // Prevent deleting core roles
        const check = db.exec(`SELECT name FROM user_roles WHERE id = ?`, [req.params.id]);
        if (check.length && ['Admin', 'HR'].includes(check[0].values[0][0])) {
            return res.status(400).json({ error: 'Cannot delete core system roles' });
        }
        db.run(`DELETE FROM user_roles WHERE id = ?`, [req.params.id]);
        saveDb();
        res.json({ message: 'Role deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
