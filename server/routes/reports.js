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

        const empCount = db.exec(`SELECT COUNT(*) as count FROM employees WHERE status = 'Active'`);
        const headcount = toObjects(empCount)[0]?.count || 0;

        const latestRun = db.exec(`SELECT * FROM payroll_runs ORDER BY period_year DESC, period_month DESC LIMIT 1`);
        const latest = toObjects(latestRun)[0] || null;

        const allRuns = db.exec(`SELECT * FROM payroll_runs ORDER BY period_year ASC, period_month ASC LIMIT 12`);
        const runs = toObjects(allRuns);

        const pendingLeaves = db.exec(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'Pending'`);
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
        const result = db.exec(
            `SELECT p.employee_name, p.employee_code, p.gross_pay, p.cpf_employee, p.cpf_employer, p.cpf_oa, p.cpf_sa, p.cpf_ma FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.period_year = ${year} AND pr.period_month = ${month}`
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
        const result = db.exec(
            `SELECT p.employee_name, p.employee_code, SUM(p.gross_pay) as total_gross, SUM(p.cpf_employee) as total_cpf_employee, SUM(p.cpf_employer) as total_cpf_employer, SUM(p.bonus) as total_bonus FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.period_year = ${year} GROUP BY p.employee_id`
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
        const result = db.exec(
            `SELECT p.employee_name, p.employee_code, p.gross_pay, p.sdl FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.period_year = ${year} AND pr.period_month = ${month}`
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
        const result = db.exec(
            `SELECT p.employee_name, p.employee_code, p.shg_fund, p.shg_deduction FROM payslips p JOIN payroll_runs pr ON p.payroll_run_id = pr.id WHERE pr.period_year = ${year} AND pr.period_month = ${month} AND p.shg_deduction > 0`
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

module.exports = router;
