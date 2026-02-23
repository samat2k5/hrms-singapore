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

// Helper to compute dynamically prorated MOM leaves and Grade Policies
async function computeDynamicBalances(db, employeeId, year) {
    // 1. Get raw balances
    const balResult = db.exec(`
        SELECT lb.*, lt.name as leave_type_name, 
               e.full_name as employee_name, e.employee_id as employee_code, e.date_joined, e.employee_grade
        FROM leave_balances lb 
        JOIN leave_types lt ON lb.leave_type_id = lt.id 
        JOIN employees e ON lb.employee_id = e.id 
        WHERE lb.employee_id = ${employeeId} AND lb.year = ${year} AND e.status = 'Active'
        ORDER BY lt.id
    `);

    let balances = toObjects(balResult);
    if (!balances.length) return [];

    const emp = balances[0]; // grab common employee data
    const dateJoined = new Date(emp.date_joined || new Date());
    const currentDate = new Date();
    const queryYearEnd = new Date(year, 11, 31);

    // Calculate total completed months of service as of query year end (or current date if query year is future)
    const referenceDate = currentDate.getFullYear() > year ? queryYearEnd : currentDate;
    let completedMonths = (referenceDate.getFullYear() - dateJoined.getFullYear()) * 12 + (referenceDate.getMonth() - dateJoined.getMonth());
    if (referenceDate.getDate() < dateJoined.getDate()) completedMonths--;
    completedMonths = Math.max(0, completedMonths);

    const completedYears = Math.floor(completedMonths / 12);
    const monthsInCurrentYear = Math.min(12, Math.max(0, (referenceDate.getFullYear() === dateJoined.getFullYear()) ? (12 - dateJoined.getMonth()) : 12));

    // Fetch Grade Policies
    const polResult = db.exec(`SELECT * FROM leave_policies WHERE employee_grade = '${emp.employee_grade}'`);
    const policies = toObjects(polResult);

    balances = balances.map(lb => {
        let finalEntitled = lb.entitled; // Default static fallback
        let earned = lb.entitled;

        if (lb.leave_type_name === 'Annual Leave') {
            let policyEntitlement = 0;
            const policy = policies.find(p => p.leave_type_id === lb.leave_type_id);

            // 1. Grade-wise Policy Entitlement
            if (policy) {
                policyEntitlement = policy.base_days + (completedYears * policy.increment_per_year);
                if (policy.max_days > 0) policyEntitlement = Math.min(policyEntitlement, policy.max_days);
            }

            // 2. MOM Statutory Minimum
            let momMinimum = Math.min(14, 7 + completedYears);

            // 3. Final Explicit Entitlement is the Highest of both
            finalEntitled = Math.max(momMinimum, policyEntitlement);

            // 4. MOM 3-month probation rule
            if (completedMonths < 3) {
                earned = 0; // Strictly 0 earned before probation completes
            } else {
                // 5. Incomplete Year Proration
                if (completedYears < 1) { // First year of employment
                    earned = Math.round((completedMonths / 12) * finalEntitled);
                } else {
                    earned = finalEntitled;
                }
            }
        } else if (lb.leave_type_name === 'Sick Leave') {
            // Sick leave Proration logic based on MOM
            if (completedMonths < 3) earned = 0;
            else if (completedMonths === 3) earned = 5;
            else if (completedMonths === 4) earned = 8;
            else if (completedMonths === 5) earned = 11;
            else earned = 14;
            finalEntitled = 14;
        } else if (lb.leave_type_name === 'Hospitalization Leave') {
            if (completedMonths < 3) earned = 0;
            else if (completedMonths === 3) earned = 15;
            else if (completedMonths === 4) earned = 30;
            else if (completedMonths === 5) earned = 45;
            else earned = 60;
            finalEntitled = 60;
        }

        return {
            ...lb,
            entitled: finalEntitled,
            earned: earned,
            balance: earned - lb.taken // recompute fluid balance based on earned
        };
    });

    return balances;
}

// GET /api/leave/balances/:employeeId/:year — Get leave balances
router.get('/balances/:employeeId/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const balances = await computeDynamicBalances(db, req.params.employeeId, req.params.year);
        res.json(balances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leave/balances-all/:year — Get all employee leave balances
router.get('/balances-all/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const empResult = db.exec(`SELECT id FROM employees WHERE status = 'Active'`);
        const employees = toObjects(empResult);

        let allBalances = [];
        for (const emp of employees) {
            const bals = await computeDynamicBalances(db, emp.id, req.params.year);
            allBalances = allBalances.concat(bals);
        }
        res.json(allBalances);
    } catch (err) {
        console.error('Error GET /balances-all/:year', err);
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
