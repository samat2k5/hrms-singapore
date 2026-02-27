const express = require('express');
const { getDb } = require('../db/init');
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

// GET /api/reports/dashboard — Dashboard stats
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const empCount = db.exec('SELECT COUNT(*) as count FROM employees WHERE entity_id = ? AND status = \'Active\'', [entityId]);
        const headcount = toObjects(empCount)[0]?.count || 0;

        const latestRun = db.exec('SELECT * FROM payroll_runs WHERE entity_id = ? ORDER BY period_year DESC, period_month DESC LIMIT 1', [entityId]);
        const latest = toObjects(latestRun)[0] || null;

        const allRuns = db.exec('SELECT * FROM payroll_runs WHERE entity_id = ? ORDER BY period_year ASC, period_month ASC LIMIT 12', [entityId]);
        const runs = toObjects(allRuns);

        const pendingLeaves = db.exec('SELECT COUNT(*) as count FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE e.entity_id = ? AND lr.status = \'Pending\'', [entityId]);
        const pendingCount = toObjects(pendingLeaves)[0]?.count || 0;

        res.json({
            headcount,
            latestPayroll: latest,
            payrollHistory: runs,
            pendingLeaves: pendingCount,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/cpf/:year/:month — CPF Monthly Submission Report
router.get('/cpf/:year/:month', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month } = req.params;
        const entityId = req.user.entityId;
        const result = db.exec(
            'SELECT p.employee_name, p.employee_code, p.gross_pay, p.cpf_employee, p.cpf_employer, p.cpf_oa, p.cpf_sa, p.cpf_ma FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.entity_id = ? AND pr.period_year = ? AND pr.period_month = ?',
            [entityId, year, month]
        );
        const data = toObjects(result);

        const totals = data.reduce((acc, row) => ({
            totalGross: acc.totalGross + row.gross_pay,
            totalCPFEmployee: acc.totalCPFEmployee + row.cpf_employee,
            totalCPFEmployer: acc.totalCPFEmployer + row.cpf_employer,
            totalOA: acc.totalOA + row.cpf_oa,
            totalSA: acc.totalSA + row.cpf_sa,
            totalMA: acc.totalMA + row.cpf_ma,
        }), { totalGross: 0, totalCPFEmployee: 0, totalCPFEmployer: 0, totalOA: 0, totalSA: 0, totalMA: 0 });

        res.json({ period: `${month}/${year}`, employees: data, totals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/ir8a/:year — IRAS IR8A Annual Summary
router.get('/ir8a/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year } = req.params;
        const entityId = req.user.entityId;
        const result = db.exec(
            'SELECT p.employee_name, p.employee_code, SUM(p.gross_pay) as total_gross, SUM(p.cpf_employee) as total_cpf_employee, SUM(p.cpf_employer) as total_cpf_employer, SUM(p.bonus) as total_bonus FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.entity_id = ? AND pr.period_year = ? GROUP BY p.employee_id',
            [entityId, year]
        );
        res.json({ year: parseInt(year), employees: toObjects(result) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/sdl/:year/:month — SDL Summary
router.get('/sdl/:year/:month', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month } = req.params;
        const entityId = req.user.entityId;
        const result = db.exec(
            'SELECT p.employee_name, p.employee_code, p.gross_pay, p.sdl FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.entity_id = ? AND pr.period_year = ? AND pr.period_month = ?',
            [entityId, year, month]
        );
        const data = toObjects(result);
        const totalSDL = data.reduce((sum, r) => sum + r.sdl, 0);
        res.json({ period: `${month}/${year}`, employees: data, totalSDL: Math.floor(totalSDL) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/shg/:year/:month — SHG Deductions Report
router.get('/shg/:year/:month', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month } = req.params;
        const entityId = req.user.entityId;
        const result = db.exec(
            'SELECT p.employee_name, p.employee_code, p.shg_fund, p.shg_deduction FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.entity_id = ? AND pr.period_year = ? AND pr.period_month = ? AND p.shg_deduction > 0',
            [entityId, year, month]
        );
        const data = toObjects(result);

        // Group by fund
        const byFund = {};
        data.forEach(r => {
            if (!byFund[r.shg_fund]) byFund[r.shg_fund] = { total: 0, count: 0 };
            byFund[r.shg_fund].total += r.shg_deduction;
            byFund[r.shg_fund].count++;
        });

        res.json({ period: `${month}/${year}`, employees: data, byFund });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/employee-master — Comprehensive Employee List
router.get('/employee-master', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const result = db.exec(`
            SELECT e.*, en.name as entity_name, 
                   ek.job_title, ek.employment_start_date, ek.basic_salary as ket_basic,
                   ek.fixed_allowances, ek.working_days_per_week as ket_days,
                   ek.rest_day as ket_rest_day, ek.working_hours_per_day as ket_hours
            FROM employees e 
            JOIN entities en ON e.entity_id = en.id
            LEFT JOIN employee_kets ek ON e.id = ek.employee_id
            WHERE e.entity_id = ? AND e.status = 'Active'
            ORDER BY e.employee_id
        `, [entityId]);

        const data = toObjects(result);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/doc-expiry — Tracking WP/Passport expiry
router.get('/doc-expiry', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const ninetyDaysOut = new Date();
        ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);
        const dateStr = ninetyDaysOut.toISOString().split('T')[0];

        const result = db.exec(`
            SELECT id, employee_id, full_name, nationality, 
                   cessation_date, pr_status_start_date
            FROM employees 
            WHERE entity_id = ? AND status = 'Active'
            AND ((cessation_date IS NOT NULL AND cessation_date <= ?) OR (pr_status_start_date IS NOT NULL AND pr_status_start_date <= ?))
        `, [entityId, dateStr, dateStr]);

        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/summary/:year/:month — Entity-wide Total Summary
router.get('/summary/:year/:month', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month } = req.params;
        const entityId = req.user.entityId;

        const result = db.exec(`
            SELECT 
                COUNT(*) as headcount,
                SUM(gross_pay) as total_gross,
                SUM(cpf_employee) as total_cpf_ee,
                SUM(cpf_employer) as total_cpf_er,
                SUM(sdl) as total_sdl,
                SUM(shg_deduction) as total_shg,
                SUM(net_pay) as total_net,
                SUM(basic_salary) as total_basic,
                SUM(ot_1_5_pay + ot_2_0_pay + ph_worked_pay + ph_off_day_pay) as total_ot,
                SUM(total_allowances) as total_allowances,
                SUM(attendance_deduction + unpaid_leave_deduction + other_deductions) as total_standard_deductions
            FROM payslips p 
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id 
            WHERE pr.entity_id = ? AND pr.period_year = ? AND pr.period_month = ?
        `, [entityId, year, month]);

        const summary = toObjects(result)[0] || {};
        res.json({ period: `${month}/${year}`, ...summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/consolidated/:year/:month — Group/Dept aggregation
router.get('/consolidated/:year/:month', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month } = req.params;
        const entityId = req.user.entityId;

        const result = db.exec(`
            SELECT 
                employee_group,
                COUNT(*) as headcount,
                SUM(gross_pay) as total_gross,
                SUM(cpf_employee) as total_cpf_ee,
                SUM(cpf_employer) as total_cpf_er,
                SUM(net_pay) as total_net,
                SUM(attendance_deduction + unpaid_leave_deduction + other_deductions) as total_deductions
            FROM payslips p 
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id 
            WHERE pr.entity_id = ? AND pr.period_year = ? AND pr.period_month = ?
            GROUP BY employee_group
        `, [entityId, year, month]);

        res.json({ period: `${month}/${year}`, groups: toObjects(result) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/run-payslips/:runId — Batch collection for Master PDF
router.get('/run-payslips/:runId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { runId } = req.params;
        const entityId = req.user.entityId;

        const result = db.exec(`
            SELECT p.*, e.employee_id as emp_code, en.name as entity_name, en.logo_url
            FROM payslips p 
            JOIN employees e ON p.employee_id = e.id 
            JOIN entities en ON e.entity_id = en.id
            WHERE p.payroll_run_id = ? AND en.id = ?
        `, [runId, entityId]);

        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/payroll-detail/:year/:month — Detailed breakdown per employee
router.get('/payroll-detail/:year/:month', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month } = req.params;
        const entityId = req.user.entityId;

        const result = db.exec(`
            SELECT 
                p.employee_name, 
                p.employee_code,
                p.basic_salary,
                p.transport_allowance,
                p.meal_allowance,
                p.other_allowance,
                p.custom_allowances,
                p.overtime_pay,
                p.bonus,
                p.ph_worked_pay,
                p.ph_off_day_pay,
                p.performance_allowance,
                p.ns_makeup_pay,
                p.total_allowances,
                p.gross_pay,
                p.cpf_employee,
                p.shg_deduction,
                p.attendance_deduction,
                p.unpaid_leave_deduction,
                p.custom_deductions,
                p.other_deductions,
                p.net_pay
            FROM payslips p 
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id 
            WHERE pr.entity_id = ? AND pr.period_year = ? AND pr.period_month = ?
            ORDER BY p.employee_name ASC
        `, [entityId, year, month]);

        res.json({ period: `${month}/${year}`, employees: toObjects(result) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
