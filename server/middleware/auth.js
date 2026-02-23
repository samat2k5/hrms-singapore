const jwt = require('jsonwebtoken');
const { getDb } = require('../db/init');

const JWT_SECRET = process.env.JWT_SECRET || 'hrms-sg-secret-key-2026';

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Assign base user identity
    req.user = decoded;

    // Entity Context Middleware Logic
    const entityId = req.headers['entity-id'];

    // Some routes like /api/entities don't strictly need an entity context, 
    // so we only enforce it if they provided one, OR if they are hitting employee data
    if (entityId) {
        try {
            const db = await getDb();
            const roleResult = db.exec(
                `SELECT role, managed_groups FROM user_entity_roles WHERE user_id = ? AND entity_id = ?`,
                [req.user.id, entityId]
            );

            if (!roleResult.length) {
                return res.status(403).json({ error: 'Access denied to this entity' });
            }

            const { columns, values } = roleResult[0];
            const entityRole = values[0][columns.indexOf('role')];
            let managedGroups = values[0][columns.indexOf('managed_groups')];
            try { managedGroups = JSON.parse(managedGroups); } catch (e) { managedGroups = []; }

            req.user.entityId = parseInt(entityId, 10);
            req.user.role = entityRole;
            req.user.managedGroups = managedGroups;

        } catch (err) {
            return res.status(500).json({ error: 'Failed to verify entity access: ' + err.message });
        }
    }

    next();
}

module.exports = { authMiddleware, JWT_SECRET };
