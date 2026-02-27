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

// GET all policies for the entity
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`
            SELECT lp.*, lt.name as leave_type_name 
            FROM leave_policies lp 
            JOIN leave_types lt ON lp.leave_type_id = lt.id 
            WHERE lp.entity_id = ${req.user.entityId} 
            ORDER BY lp.employee_grade, lt.id
        `);
        res.json(toObjects(result));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST to create or update a policy
router.post('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { employee_grade, leave_type_id, base_days, increment_per_year, max_days, carry_forward_max, carry_forward_expiry_months, encashment_allowed } = req.body;

        if (!employee_grade || !leave_type_id) {
            return res.status(400).json({ error: 'Grade and Leave Type are required' });
        }

        db.run(
            `INSERT INTO leave_policies (entity_id, employee_grade, leave_type_id, base_days, increment_per_year, max_days, carry_forward_max, carry_forward_expiry_months, encashment_allowed) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
             ON CONFLICT(entity_id, employee_grade, leave_type_id) 
             DO UPDATE SET 
                base_days=excluded.base_days, 
                increment_per_year=excluded.increment_per_year, 
                max_days=excluded.max_days,
                carry_forward_max=excluded.carry_forward_max,
                carry_forward_expiry_months=excluded.carry_forward_expiry_months,
                encashment_allowed=excluded.encashment_allowed`,
            [
                req.user.entityId, employee_grade, leave_type_id,
                base_days || 0, increment_per_year || 0, max_days || 0,
                carry_forward_max || 0, carry_forward_expiry_months || 12, encashment_allowed ? 1 : 0
            ]
        );
        saveDb();
        res.json({ message: 'Policy saved successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE a policy
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`DELETE FROM leave_policies WHERE id = ${req.params.id} AND entity_id = ${req.user.entityId}`);
        saveDb();
        res.json({ message: 'Policy deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
