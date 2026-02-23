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

// GET /api/leave/types — List all leave types
router.get('/types', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM leave_types ORDER BY id');
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leave/balances/:employeeId/:year — Get leave balances
router.get('/balances/:employeeId/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(
            `SELECT lb.*, lt.name as leave_type_name FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id WHERE lb.employee_id = ${req.params.employeeId} AND lb.year = ${req.params.year} ORDER BY lt.id`
        );
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leave/balances-all/:year — Get all employee leave balances
router.get('/balances-all/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(
            `SELECT lb.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_id as employee_code FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id JOIN employees e ON lb.employee_id = e.id WHERE lb.year = ${req.params.year} AND e.status = 'Active' ORDER BY e.employee_id, lt.id`
        );
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leave/requests — List all leave requests
router.get('/requests', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(
            `SELECT lr.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_id as employee_code FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id JOIN employees e ON lr.employee_id = e.id ORDER BY lr.created_at DESC`
        );
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/leave/request — Submit leave request
router.post('/request', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { employee_id, leave_type_id, start_date, end_date, days, reason } = req.body;

        // Check balance
        const year = new Date(start_date).getFullYear();
        const balResult = db.exec(
            `SELECT * FROM leave_balances WHERE employee_id = ${employee_id} AND leave_type_id = ${leave_type_id} AND year = ${year}`
        );
        const balances = toObjects(balResult);

        if (balances.length && balances[0].balance < days) {
            return res.status(400).json({ error: 'Insufficient leave balance' });
        }

        db.run(
            `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [employee_id, leave_type_id, start_date, end_date, days, reason]
        );
        saveDb();

        res.status(201).json({ message: 'Leave request submitted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/leave/request/:id/approve — Approve leave
router.put('/request/:id/approve', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();

        // Get the request
        const reqResult = db.exec(`SELECT * FROM leave_requests WHERE id = ${req.params.id}`);
        const requests = toObjects(reqResult);
        if (!requests.length) return res.status(404).json({ error: 'Request not found' });

        const lr = requests[0];
        if (lr.status !== 'Pending') return res.status(400).json({ error: 'Request is not pending' });

        // Update status
        db.run(`UPDATE leave_requests SET status = 'Approved' WHERE id = ${req.params.id}`);

        // Update balance
        const year = new Date(lr.start_date).getFullYear();
        db.run(
            `UPDATE leave_balances SET taken = taken + ${lr.days}, balance = balance - ${lr.days} WHERE employee_id = ${lr.employee_id} AND leave_type_id = ${lr.leave_type_id} AND year = ${year}`
        );

        saveDb();
        res.json({ message: 'Leave approved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/leave/request/:id/reject — Reject leave
router.put('/request/:id/reject', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`UPDATE leave_requests SET status = 'Rejected' WHERE id = ${req.params.id}`);
        saveDb();
        res.json({ message: 'Leave rejected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
