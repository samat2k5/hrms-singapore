const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const { processEmployeePayroll } = require('../engine/payroll-engine');

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

// GET /api/payroll/runs — List all payroll runs
router.get('/runs', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        let query = 'SELECT * FROM payroll_runs ORDER BY period_year DESC, period_month DESC';

        // RBAC enforcement for Payroll Runs
        if (req.user.role === 'HR') {
            const groups = req.user.managedGroups || [];
            if (groups.length === 0) return res.json([]);
            const groupList = groups.map(g => `'${g}'`).join(',');
            query = `SELECT * FROM payroll_runs WHERE employee_group IN (${groupList}) ORDER BY period_year DESC, period_month DESC`;
        }

        const result = db.exec(query);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payroll/run — Process payroll for a period
router.post('/run', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { year, month, employee_group } = req.body;

        if (!year || !month || !employee_group) {
            return res.status(400).json({ error: 'Year, month, and employee_group are required' });
        }

        // Check for existing run
        const existing = db.exec(
            `SELECT id FROM payroll_runs WHERE period_year = ${year} AND period_month = ${month} AND employee_group = '${employee_group}'`
        );
        if (toObjects(existing).length) {
            return res.status(400).json({ error: `Payroll already processed for ${employee_group} in ${month}/${year}` });
        }

        // Get active employees
        const empResult = db.exec(`SELECT * FROM employees WHERE status = 'Active' AND employee_group = '${employee_group}'`);
        const employees = toObjects(empResult);

        if (!employees.length) {
            return res.status(400).json({ error: 'No active employees found' });
        }

        // Create payroll run
        const runDate = new Date().toISOString().split('T')[0];
        db.run(
            `INSERT INTO payroll_runs (employee_group, period_year, period_month, run_date, status) VALUES (?, ?, ?, ?, 'Draft')`,
            [employee_group, year, month, runDate]
        );

        const runResult = db.exec(`SELECT last_insert_rowid() as id`);
        const runId = runResult[0].values[0][0];

        let totalGross = 0, totalCPFEmployee = 0, totalCPFEmployer = 0, totalSDL = 0, totalSHG = 0, totalNet = 0;

        // Process each employee
        for (const emp of employees) {
            // Get unpaid leave days for this month
            const leaveResult = db.exec(
                `SELECT COALESCE(SUM(lr.days), 0) as unpaid_days FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id WHERE lr.employee_id = ${emp.id} AND lr.status = 'Approved' AND lt.name = 'Unpaid Leave' AND strftime('%Y', lr.start_date) = '${year}' AND strftime('%m', lr.start_date) = '${String(month).padStart(2, '0')}'`
            );
            const unpaidDays = toObjects(leaveResult)[0]?.unpaid_days || 0;

            // Get OT hours for this month from timesheets
            const otResult = db.exec(
                `SELECT COALESCE(SUM(ot_hours), 0) as total_ot FROM timesheets WHERE employee_id = ${emp.id} AND strftime('%Y', date) = '${year}' AND strftime('%m', date) = '${String(month).padStart(2, '0')}'`
            );
            const otHours = toObjects(otResult)[0]?.total_ot || 0;

            // MOM standard overtime rate formula: 1.5 * Hourly Rate
            // Hourly Rate = (12 * Basic Salary) / (52 * Working Hours Per Week)
            // Fetch working hours from KETs if available, fallback to MOM standard 44 hours
            let workingHoursPerWeek = 44;
            const ketResult = db.exec(`SELECT working_hours_per_day, working_days_per_week FROM employee_kets WHERE employee_id = ${emp.id}`);
            if (ketResult.length && ketResult[0].values[0][0]) {
                const hoursPerDay = ketResult[0].values[0][0] || 8;
                const daysPerWeek = ketResult[0].values[0][1] || 5.5;
                workingHoursPerWeek = hoursPerDay * daysPerWeek;
            }

            let overtimeRate = 0;
            if (emp.basic_salary && emp.basic_salary > 0) {
                const hourlyRate = (12 * emp.basic_salary) / (52 * workingHoursPerWeek);
                overtimeRate = hourlyRate * 1.5;
            }

            const payslip = processEmployeePayroll(emp, {
                unpaidLeaveDays: unpaidDays,
                overtimeHours: otHours,
                overtimeRate: overtimeRate
            });

            // Insert payslip
            db.run(
                `INSERT INTO payslips (payroll_run_id, employee_id, employee_name, employee_code, basic_salary, transport_allowance, meal_allowance, other_allowance, total_allowances, overtime_hours, overtime_pay, bonus, gross_pay, cpf_employee, cpf_employer, cpf_oa, cpf_sa, cpf_ma, sdl, shg_deduction, shg_fund, other_deductions, unpaid_leave_days, unpaid_leave_deduction, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [runId, payslip.employee_id, payslip.employee_name, payslip.employee_code, payslip.basic_salary, payslip.transport_allowance, payslip.meal_allowance, payslip.other_allowance, payslip.total_allowances, payslip.overtime_hours, payslip.overtime_pay, payslip.bonus, payslip.gross_pay, payslip.cpf_employee, payslip.cpf_employer, payslip.cpf_oa, payslip.cpf_sa, payslip.cpf_ma, payslip.sdl, payslip.shg_deduction, payslip.shg_fund, payslip.other_deductions, payslip.unpaid_leave_days, payslip.unpaid_leave_deduction, payslip.net_pay]
            );

            totalGross += payslip.gross_pay;
            totalCPFEmployee += payslip.cpf_employee;
            totalCPFEmployer += payslip.cpf_employer;
            totalSDL += payslip.sdl;
            totalSHG += payslip.shg_deduction;
            totalNet += payslip.net_pay;
        }

        // Update run totals
        db.run(
            `UPDATE payroll_runs SET total_gross=?, total_cpf_employee=?, total_cpf_employer=?, total_sdl=?, total_shg=?, total_net=?, status='Finalized' WHERE id=?`,
            [totalGross, totalCPFEmployee, totalCPFEmployer, totalSDL, totalSHG, totalNet, runId]
        );

        saveDb();

        // Return the complete payroll run with payslips
        const finalRun = toObjects(db.exec(`SELECT * FROM payroll_runs WHERE id = ${runId}`))[0];
        const payslips = toObjects(db.exec(`SELECT * FROM payslips WHERE payroll_run_id = ${runId}`));

        res.status(201).json({ run: finalRun, payslips });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payroll/run/:id — Get payroll run details with payslips
router.get('/run/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const runResult = db.exec(`SELECT * FROM payroll_runs WHERE id = ${req.params.id}`);
        const run = toObjects(runResult)[0];
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });

        const payslips = toObjects(db.exec(`SELECT * FROM payslips WHERE payroll_run_id = ${req.params.id}`));
        res.json({ run, payslips });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payroll/payslip/:id — Get individual payslip
router.get('/payslip/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`
            SELECT p.*, pr.period_year, pr.period_month, pr.run_date, be.name as entity_name 
            FROM payslips p 
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id 
            JOIN employees e ON p.employee_id = e.id
            JOIN entities be ON e.entity_id = be.id
            WHERE p.id = ${req.params.id}
        `);
        const payslips = toObjects(result);
        if (!payslips.length) return res.status(404).json({ error: 'Payslip not found' });
        res.json(payslips[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/payroll/run/:id — Delete a payroll run
router.delete('/run/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`DELETE FROM payslips WHERE payroll_run_id = ${req.params.id}`);
        db.run(`DELETE FROM payroll_runs WHERE id = ${req.params.id}`);
        saveDb();
        res.json({ message: 'Payroll run deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

// GET /api/payroll/export-giro/:runId
router.get('/export-giro/:runId', async (req, res) => {
    try {
        const db = await getDb();
        const runId = req.params.runId;

        const runResult = db.exec(`SELECT * FROM payroll_runs WHERE id = ${runId}`);
        if (!runResult.length) return res.status(404).json({ error: 'Run not found' });
        const run = toObjects(runResult)[0];

        const slipsResult = db.exec(`
            SELECT p.*, e.bank_name, e.bank_account, e.employee_id as emp_code
            FROM payslips p 
            JOIN employees e ON p.employee_id = e.id 
            WHERE p.payroll_run_id = ${runId}
        `);
        const slips = toObjects(slipsResult);

        // DBS IDEAL GIRO FORMAT (Simplified CSV for example)
        let csv = 'Record Type,Bank Name,Account No,Name,Amount,Reference\n';

        slips.forEach(s => {
            const amount = parseFloat(s.net_pay).toFixed(2);
            csv += `Payment,${s.bank_name || 'DBS Bank'},${s.bank_account || ''},${s.employee_name},${amount},Salary ${run.period_month}/${run.period_year}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="GIRO_Export_${run.employee_group}_${run.period_year}_${run.period_month}.csv"`);
        res.status(200).end(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payroll/export-cpf/:runId
router.get('/export-cpf/:runId', async (req, res) => {
    try {
        const db = await getDb();
        const runId = req.params.runId;

        const runResult = db.exec(`SELECT * FROM payroll_runs WHERE id = ${runId}`);
        if (!runResult.length) return res.status(404).json({ error: 'Run not found' });
        const run = toObjects(runResult)[0];

        const slipsResult = db.exec(`
            SELECT p.*, e.employee_id as emp_code
            FROM payslips p 
            JOIN employees e ON p.employee_id = e.id 
            WHERE p.payroll_run_id = ${runId} AND (p.cpf_employee > 0 OR p.cpf_employer > 0)
        `);
        const slips = toObjects(slipsResult);

        // CPFB CSN FTP Fixed-Width layout (Mock structure)
        let txt = `F${run.period_year}${String(run.period_month).padStart(2, '0')}CPF00000001\n`;

        slips.forEach(s => {
            const ordWages = String(parseFloat(s.gross_pay).toFixed(2)).padStart(10, '0');
            const employerCpf = String(parseFloat(s.cpf_employer).toFixed(2)).padStart(8, '0');
            const employeeCpf = String(parseFloat(s.cpf_employee).toFixed(2)).padStart(8, '0');
            txt += `D${s.emp_code.padEnd(10, ' ')}${ordWages}${employerCpf}${employeeCpf}\n`;
        });

        txt += `T${String(slips.length).padStart(6, '0')}`;

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="CPF_CSN_${run.employee_group}_${run.period_year}_${run.period_month}.txt"`);
        res.status(200).end(txt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

