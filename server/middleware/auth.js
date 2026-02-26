const jwt = require('jsonwebtoken');
const { getDb } = require('../db/init');

const JWT_SECRET = process.env.JWT_SECRET || 'hrms-sg-secret-key-2026';

function toObjects(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

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
    // Supports: Entity-Id header, ?entityId query param, or auto-detect for single-entity users
    let entityId = req.headers['entity-id'] || req.query.entityId;

    try {
        const db = await getDb();

        // If no entity provided, try to auto-detect if the user only has ONE entity
        if (!entityId) {
            const entitiesRes = db.exec('SELECT entity_id FROM user_entity_roles WHERE user_id = ?', [req.user.id]);
            const userEntities = toObjects(entitiesRes);
            if (userEntities.length === 1) {
                entityId = userEntities[0].entity_id;
            }
        }

        if (entityId) {
            const parsedEntityId = parseInt(entityId, 10);
            if (isNaN(parsedEntityId)) {
                return res.status(400).json({ error: 'Invalid entity ID format' });
            }

            const roleResult = db.exec(
                `SELECT role, managed_groups FROM user_entity_roles WHERE user_id = ? AND entity_id = ?`,
                [req.user.id, parsedEntityId]
            );

            if (roleResult.length) {
                const { columns, values } = roleResult[0];
                const entityRole = values[0][columns.indexOf('role')];
                let managedGroups = values[0][columns.indexOf('managed_groups')];
                try { managedGroups = JSON.parse(managedGroups); } catch (e) { managedGroups = []; }

                req.user.entityId = parsedEntityId;
                req.user.role = entityRole;
                req.user.managedGroups = managedGroups;
            }
        }
    } catch (err) {
        return res.status(500).json({ error: 'Failed to verify entity access: ' + err.message });
    }

    next();
}

module.exports = { authMiddleware, JWT_SECRET };
