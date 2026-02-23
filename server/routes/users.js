const express = require('express');
const bcrypt = require('bcryptjs');
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

// GET /api/users - Get all users in the active entity
router.get('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });

        const db = await getDb();
        const entityId = req.user.entityId;

        const query = `
            SELECT u.id, u.username, u.full_name, u.created_at, 
                   uer.role, uer.managed_groups
            FROM users u
            JOIN user_entity_roles uer ON u.id = uer.user_id
            WHERE uer.entity_id = ?
            ORDER BY u.full_name
        `;

        const result = db.exec(query, [entityId]);
        const users = toObjects(result).map(u => ({
            ...u,
            managed_groups: (() => { try { return JSON.parse(u.managed_groups); } catch (e) { return []; } })()
        }));

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users - Create a new user and assign to current entity
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });

        const db = await getDb();
        const u = req.body;
        const entityId = req.user.entityId;

        // Check if username exists globally
        const existing = db.exec(`SELECT id FROM users WHERE username = ?`, [u.username]);
        let userId;

        if (existing.length && existing[0].values.length) {
            // User exists, just assign them to this entity if not already
            userId = existing[0].values[0][0];
            const hasRole = db.exec(`SELECT id FROM user_entity_roles WHERE user_id = ? AND entity_id = ?`, [userId, entityId]);
            if (hasRole.length && hasRole[0].values.length) {
                return res.status(400).json({ error: 'User is already assigned to this entity' });
            }
        } else {
            // New user, create them globally
            if (!u.password) return res.status(400).json({ error: 'Password is required for new users' });
            const pwdHash = bcrypt.hashSync(u.password, 10);
            db.run(`INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)`,
                [u.username, pwdHash, u.full_name]);

            const newUser = db.exec(`SELECT id FROM users WHERE username = ?`, [u.username]);
            userId = newUser[0].values[0][0];
        }

        // Assign to Multiple Entities
        if (Array.isArray(u.entityIds) && u.entityIds.length > 0) {
            u.entityIds.forEach(eid => {
                db.run(
                    `INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`,
                    [userId, eid, u.role, JSON.stringify(u.managed_groups || [])]
                );
            });
        } else {
            // Fallback to current entity if none specified
            db.run(
                `INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`,
                [userId, entityId, u.role, JSON.stringify(u.managed_groups || [])]
            );
        }

        saveDb();
        res.status(201).json({ message: 'User assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/:id - Update user role in current entity
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });

        const db = await getDb();
        const u = req.body;
        const entityId = req.user.entityId;
        const targetUserId = req.params.id;

        // Update global full_name if provided
        db.run(`UPDATE users SET full_name = ? WHERE id = ?`, [u.full_name, targetUserId]);

        // Update entity role
        db.run(
            `UPDATE user_entity_roles SET role = ?, managed_groups = ? WHERE user_id = ? AND entity_id = ?`,
            [u.role, JSON.stringify(u.managed_groups || []), targetUserId, entityId]
        );

        saveDb();
        res.json({ message: 'User updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/users/:id - Remove user from current entity
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Access denied' });

        const db = await getDb();
        const entityId = req.user.entityId;
        const targetUserId = req.params.id;

        if (req.user.id == targetUserId) {
            return res.status(400).json({ error: 'You cannot remove yourself from the entity' });
        }

        db.run(`DELETE FROM user_entity_roles WHERE user_id = ? AND entity_id = ?`, [targetUserId, entityId]);
        saveDb();
        res.json({ message: 'User removed from entity' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
