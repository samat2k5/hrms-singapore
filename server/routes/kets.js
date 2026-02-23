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

// GET /api/kets/:employeeId — Get KETs for an employee
router.get('/:employeeId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`SELECT k.*, e.full_name as employee_name, e.employee_id as employee_code, e.date_joined FROM employee_kets k JOIN employees e ON k.employee_id = e.id WHERE k.employee_id = ${req.params.employeeId}`);
        const kets = toObjects(result);
        if (!kets.length) return res.status(404).json({ error: 'KETs not found' });

        const ket = kets[0];
        // Parse JSON fields
        try { ket.fixed_allowances = JSON.parse(ket.fixed_allowances || '{}'); } catch (e) { ket.fixed_allowances = {}; }
        try { ket.fixed_deductions = JSON.parse(ket.fixed_deductions || '{}'); } catch (e) { ket.fixed_deductions = {}; }

        // Calculate if KET is overdue (not issued within 14 days of start)
        if (!ket.issued_date && ket.employment_start_date) {
            const startDate = new Date(ket.employment_start_date);
            const deadline = new Date(startDate);
            deadline.setDate(deadline.getDate() + 14);
            ket.is_overdue = new Date() > deadline;
            ket.deadline = deadline.toISOString().split('T')[0];
        } else {
            ket.is_overdue = false;
        }

        res.json(ket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/kets/:employeeId — Update KETs
router.put('/:employeeId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const k = req.body;

        const fixedAllowances = typeof k.fixed_allowances === 'string' ? k.fixed_allowances : JSON.stringify(k.fixed_allowances || {});
        const fixedDeductions = typeof k.fixed_deductions === 'string' ? k.fixed_deductions : JSON.stringify(k.fixed_deductions || {});

        db.run(
            `UPDATE employee_kets SET job_title=?, employment_start_date=?, employment_type=?, contract_duration=?, working_hours_per_day=?, working_days_per_week=?, rest_day=?, salary_period=?, basic_salary=?, fixed_allowances=?, fixed_deductions=?, overtime_rate=?, overtime_payment_period=?, bonus_structure=?, annual_leave_days=?, sick_leave_days=?, hospitalization_days=?, maternity_weeks=?, paternity_weeks=?, childcare_days=?, medical_benefits=?, probation_months=?, notice_period=?, place_of_work=? WHERE employee_id=?`,
            [k.job_title, k.employment_start_date, k.employment_type, k.contract_duration, k.working_hours_per_day, k.working_days_per_week, k.rest_day, k.salary_period, k.basic_salary, fixedAllowances, fixedDeductions, k.overtime_rate, k.overtime_payment_period, k.bonus_structure, k.annual_leave_days, k.sick_leave_days, k.hospitalization_days, k.maternity_weeks, k.paternity_weeks, k.childcare_days, k.medical_benefits, k.probation_months, k.notice_period, k.place_of_work, req.params.employeeId]
        );
        saveDb();

        res.json({ message: 'KETs updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/kets/:employeeId/issue — Issue KETs (mark as officially issued)
router.post('/:employeeId/issue', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const today = new Date().toISOString().split('T')[0];
        db.run(`UPDATE employee_kets SET issued_date = ? WHERE employee_id = ?`, [today, req.params.employeeId]);
        saveDb();
        res.json({ message: 'KETs issued successfully', issued_date: today });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
