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

// GET /api/entities - Get all entities the current user has access to
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const userId = req.user.id;

        const query = `
            SELECT e.*, uer.role, uer.managed_groups 
            FROM entities e
            JOIN user_entity_roles uer ON e.id = uer.entity_id
            WHERE uer.user_id = ?
        `;

        const result = db.exec(query, [userId]);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/entities (Admin only)
router.post('/', authMiddleware, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const { name, uen, address, contact_number, website, email_domains } = req.body;

        // Insert Entity
        db.run('INSERT INTO entities (name, uen, address, contact_number, website, email_domains) VALUES (?, ?, ?, ?, ?, ?)', [name, uen, address || '', contact_number || '', website || '', email_domains || '']);

        // Get inserted ID
        const result = db.exec('SELECT last_insert_rowid() AS id');
        const entityId = result[0].values[0][0];

        // Assign current Admin to this new Entity automatically
        db.run(
            'INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)',
            [req.user.id, entityId, 'Admin', '[]']
        );

        saveDb();
        res.status(201).json({ id: entityId, name, uen, address, contact_number, website, email_domains, role: 'Admin', managed_groups: '[]' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/entities/:id (Admin only)
router.put('/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        const { name, uen, address, contact_number, website, email_domains } = req.body;
        db.run('UPDATE entities SET name = ?, uen = ?, address = ?, contact_number = ?, website = ?, email_domains = ? WHERE id = ?', [name, uen, address || '', contact_number || '', website || '', email_domains || '', req.params.id]);
        saveDb();
        res.json({ message: 'Entity updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/entities/:id (Admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const db = await getDb();
        // Check if there are constraints or just delete (cascade if we enabled it, otherwise manual)
        db.run('DELETE FROM user_entity_roles WHERE entity_id = ?', [req.params.id]);
        db.run('DELETE FROM entities WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Entity deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
