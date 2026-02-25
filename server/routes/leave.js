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
async function computeDynamicBalances(db, employeeId, yearString) {
    const year = parseInt(yearString, 10);
    // 1. Get raw balances
    const balResult = db.exec(`
        SELECT lb.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_id as employee_code, e.date_joined, e.employee_grade, e.entity_id as entity_id, en.logo_url
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        JOIN employees e ON lb.employee_id = e.id
        LEFT JOIN entities en ON e.entity_id = en.id
        WHERE lb.employee_id = ? AND lb.year = ? AND e.status = 'Active'
        ORDER BY lt.id
    `, [employeeId, year]);

    let balances = toObjects(balResult);
    if (!balances.length) return [];

    const emp = balances[0]; // grab common employee data
    const dateJoined = new Date(emp.date_joined || new Date());
    const currentDate = new Date();

    // Determine the reference dates for the queried year
    const queryYearStart = new Date(year, 0, 1);
    const queryYearEnd = new Date(year, 11, 31);

    // For calculating completed years/months by the end of the queried year
    const queryYearEndPlusOne = new Date(year + 1, 0, 1);
    let totalCompletedMonthsAtYearEnd = (queryYearEndPlusOne.getFullYear() - dateJoined.getFullYear()) * 12 + (queryYearEndPlusOne.getMonth() - dateJoined.getMonth());
    if (queryYearEndPlusOne.getDate() < dateJoined.getDate()) totalCompletedMonthsAtYearEnd--;
    totalCompletedMonthsAtYearEnd = Math.max(0, totalCompletedMonthsAtYearEnd);
    const completedYearsAtYearEnd = Math.floor(totalCompletedMonthsAtYearEnd / 12);

    // Calculate maximum possible completed months IN THIS SPECIFIC QUERIED YEAR
    let totalPossibleMonthsThisYear = 12;
    if (dateJoined.getFullYear() === year) {
        // e.g. Joined Mar 1 -> 10 months possible this year
        totalPossibleMonthsThisYear = (queryYearEndPlusOne.getFullYear() - dateJoined.getFullYear()) * 12 + (queryYearEndPlusOne.getMonth() - dateJoined.getMonth());
        if (queryYearEndPlusOne.getDate() < dateJoined.getDate()) totalPossibleMonthsThisYear--;
        totalPossibleMonthsThisYear = Math.max(0, Math.min(12, totalPossibleMonthsThisYear));
    } else if (dateJoined.getFullYear() > year) {
        totalPossibleMonthsThisYear = 0;
    }

    // Calculate completed months IN THIS SPECIFIC YEAR up to the current date (if querying current year)
    let yearRefDate = currentDate;
    if (year < currentDate.getFullYear()) {
        yearRefDate = queryYearEndPlusOne; // completed full possible
    } else if (year > currentDate.getFullYear()) {
        yearRefDate = queryYearStart;
    }

    let workStartThisYear = dateJoined;
    if (dateJoined.getFullYear() < year) {
        workStartThisYear = queryYearStart;
    }

    let monthsCompletedThisYear = 0;
    if (yearRefDate > workStartThisYear && yearRefDate.getTime() !== queryYearStart.getTime()) {
        monthsCompletedThisYear = (yearRefDate.getFullYear() - workStartThisYear.getFullYear()) * 12 + (yearRefDate.getMonth() - workStartThisYear.getMonth());
        if (yearRefDate.getDate() < workStartThisYear.getDate()) monthsCompletedThisYear--;
        monthsCompletedThisYear = Math.max(0, Math.min(totalPossibleMonthsThisYear, monthsCompletedThisYear));
    }

    // Total months completed since dateJoined up to yearRefDate (for overall probation checking)
    let totalCompletedMonthsTillDate = (yearRefDate.getFullYear() - dateJoined.getFullYear()) * 12 + (yearRefDate.getMonth() - dateJoined.getMonth());
    if (yearRefDate.getDate() < dateJoined.getDate()) totalCompletedMonthsTillDate--;
    totalCompletedMonthsTillDate = Math.max(0, totalCompletedMonthsTillDate);

    // Fetch Grade Policies for THIS entity only
    const polResult = db.exec('SELECT * FROM leave_policies WHERE employee_grade = ? AND entity_id = ?', [emp.employee_grade, emp.entity_id]);
    const policies = toObjects(polResult);

    balances = balances.map(lb => {
        let finalEntitled = lb.entitled; // Default static fallback
        let earned = lb.entitled;

        if (lb.leave_type_name === 'Annual Leave') {
            let policyEntitlement = 0;
            const policy = policies.find(p => p.leave_type_id === lb.leave_type_id);

            // 1. Grade-wise Policy Full Year Entitlement
            if (policy) {
                policyEntitlement = policy.base_days + (completedYearsAtYearEnd * policy.increment_per_year);
                if (policy.max_days > 0) policyEntitlement = Math.min(policyEntitlement, policy.max_days);
            }

            // 2. MOM Statutory Minimum Full Year Entitlement
            let momMinimum = Math.min(14, 7 + completedYearsAtYearEnd);

            // 3. Absolute Full Year Entitlement is the Highest of both
            let absoluteFullYearEntitlement = Math.max(momMinimum, policyEntitlement);

            // 4. Prorate Entitlement for incomplete years
            finalEntitled = Math.round((totalPossibleMonthsThisYear / 12) * absoluteFullYearEntitlement * 2) / 2;

            // 5. Earned Leave pro-rata till date
            earned = Math.round((monthsCompletedThisYear / 12) * absoluteFullYearEntitlement * 2) / 2;

            // 6. MOM 3-month probation rule
            if (totalCompletedMonthsTillDate < 3) {
                earned = 0; // Strictly 0 earned before probation completes
            }
        } else if (lb.leave_type_name === 'Medical Leave') {
            // Medical leave Proration logic based on MOM
            if (totalCompletedMonthsTillDate < 3) earned = 0;
            else if (totalCompletedMonthsTillDate === 3) earned = 5;
            else if (totalCompletedMonthsTillDate === 4) earned = 8;
            else if (totalCompletedMonthsTillDate === 5) earned = 11;
            else earned = 14;
            finalEntitled = 14;
        } else if (lb.leave_type_name === 'Hospitalization Leave') {
            if (totalCompletedMonthsTillDate < 3) earned = 0;
            else if (totalCompletedMonthsTillDate === 3) earned = 15;
            else if (totalCompletedMonthsTillDate === 4) earned = 30;
            else if (totalCompletedMonthsTillDate === 5) earned = 45;
            else earned = 60;
            finalEntitled = 60;
        }

        return {
            ...lb,
            entitled: finalEntitled,
            earned: earned,
            balance: Math.max(0, earned - lb.taken) // recompute fluid balance based on earned
        };
    });

    return balances;
}

// GET /api/leave/balances/:employeeId/:year — Get leave balances
router.get('/balances/:employeeId/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year, 10);
        const balances = await computeDynamicBalances(db, req.params.employeeId, year);
        res.json(balances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leave/balances-all/:year — Get all employee leave balances
router.get('/balances-all/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const role = req.user.role;
        const groups = req.user.managedGroups || [];
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        let sql = `SELECT id FROM employees WHERE entity_id = ? AND status = 'Active'`;
        const params = [entityId];

        // RBAC: HR only see their groups
        if (String(role).toUpperCase() === 'HR') {
            if (groups.length === 0) return res.json([]);
            const placeholders = groups.map(() => '?').join(',');
            sql += ` AND employee_group IN (${placeholders})`;
            params.push(...groups);
        }

        const empResult = db.exec(sql, params);
        const employees = toObjects(empResult);

        let allBalances = [];
        const year = parseInt(req.params.year, 10);
        for (const emp of employees) {
            const bals = await computeDynamicBalances(db, emp.id, year);
            allBalances = allBalances.concat(bals);
        }
        console.log(`[DEBUG] GET /balances-all - Returning ${allBalances.length} total balance records`);
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
        const entityId = req.user.entityId;
        const role = req.user.role;
        const groups = req.user.managedGroups || [];
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        let sql = `SELECT lr.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_id as employee_code, e.entity_id as entity_id 
             FROM leave_requests lr 
             JOIN leave_types lt ON lr.leave_type_id = lt.id 
             JOIN employees e ON lr.employee_id = e.id 
             WHERE e.entity_id = ?`;
        const params = [entityId];

        // RBAC: HR only see their groups
        if (String(role).toUpperCase() === 'HR') {
            if (groups.length === 0) return res.json([]);
            const placeholders = groups.map(() => '?').join(',');
            sql += ` AND e.employee_group IN (${placeholders})`;
            params.push(...groups);
        }

        sql += ` ORDER BY lr.created_at DESC`;

        const result = db.exec(sql, params);
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
            'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
            [employee_id, leave_type_id, year]
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
        const reqResult = db.exec('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
        const requests = toObjects(reqResult);
        if (!requests.length) return res.status(404).json({ error: 'Request not found' });

        const lr = requests[0];
        if (lr.status !== 'Pending') return res.status(400).json({ error: 'Request is not pending' });

        // Update status
        db.run('UPDATE leave_requests SET status = \'Approved\' WHERE id = ?', [req.params.id]);

        // Update balance
        const year = new Date(lr.start_date).getFullYear();
        db.run(
            'UPDATE leave_balances SET taken = taken + ?, balance = balance - ? WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
            [lr.days, lr.days, lr.employee_id, lr.leave_type_id, year]
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
        db.run('UPDATE leave_requests SET status = \'Rejected\' WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Leave rejected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
