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
        const result = db.exec(`
            SELECT k.*, e.full_name as employee_name, e.employee_id as employee_code, e.date_joined, en.name as entity_name, en.logo_url,
                   e.email, e.whatsapp_number, e.mobile_number
            FROM employee_kets k 
            JOIN employees e ON k.employee_id = e.id 
            LEFT JOIN entities en ON e.entity_id = en.id
            WHERE k.employee_id = ? AND e.entity_id = ?
        `, [req.params.employeeId, req.user.entityId]);
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
        const customAllowances = typeof k.custom_allowances === 'string' ? k.custom_allowances : JSON.stringify(k.custom_allowances || {});
        const customDeductions = typeof k.custom_deductions === 'string' ? k.custom_deductions : JSON.stringify(k.custom_deductions || {});

        const query = `UPDATE employee_kets SET 
                job_title=?, employment_start_date=?, employment_type=?, contract_duration=?, 
                working_hours_per_day=?, working_days_per_week=?, rest_day=?, salary_period=?, 
                basic_salary=?, fixed_allowances=?, fixed_deductions=?, overtime_rate=?, 
                overtime_payment_period=?, bonus_structure=?, annual_leave_days=?, sick_leave_days=?, 
                hospitalization_days=?, maternity_weeks=?, paternity_weeks=?, childcare_days=?, 
                medical_benefits=?, probation_months=?, notice_period=?, place_of_work=?,
                main_duties=?, employment_end_date=?, working_hours_details=?, break_hours=?,
                salary_payment_date=?, overtime_payment_date=?, gross_rate_of_pay=?, 
                other_salary_components=?, cpf_payable=?, probation_start_date=?, probation_end_date=?,
                custom_allowances=?, custom_deductions=?, employee_grade=?,
                job_title_tr=?, main_duties_tr=?, medical_benefits_tr=?, notice_period_tr=?, 
                other_salary_components_tr=?, target_language=?
            WHERE employee_id=?`;

        const cpfPayable = (k.cpf_payable === 1 || k.cpf_payable === true || k.cpf_payable === 'true') ? 1 : 0;

        const params = [
            k.job_title, k.employment_start_date, k.employment_type, k.contract_duration,
            k.working_hours_per_day, k.working_days_per_week, k.rest_day, k.salary_period,
            k.basic_salary, fixedAllowances, fixedDeductions, k.overtime_rate,
            k.overtime_payment_period, k.bonus_structure, k.annual_leave_days, k.sick_leave_days,
            k.hospitalization_days, k.maternity_weeks, k.paternity_weeks, k.childcare_days,
            k.medical_benefits, k.probation_months, k.notice_period, k.place_of_work,
            k.main_duties, k.employment_end_date, k.working_hours_details, k.break_hours,
            k.salary_payment_date, k.overtime_payment_date, k.gross_rate_of_pay,
            k.other_salary_components, cpfPayable,
            k.probation_start_date, k.probation_end_date,
            customAllowances, customDeductions, k.employee_grade || '',
            k.job_title_tr || '', k.main_duties_tr || '', k.medical_benefits_tr || '',
            k.notice_period_tr || '', k.other_salary_components_tr || '', k.target_language || 'English',
            req.params.employeeId
        ];

        const empId = parseInt(req.params.employeeId);
        console.log(`[KET Update] Starting cycle for Emp ID: ${empId}`);

        db.run(query, params);
        const ketChanges = db.exec("SELECT changes()")[0].values[0][0];
        console.log(`[KET Update] employee_kets table rows affected: ${ketChanges}`);

        // SYNC: Update the employees table with shared fields from the KET
        let fAllowances = {};
        try {
            fAllowances = typeof k.fixed_allowances === 'string' ? JSON.parse(k.fixed_allowances) : (k.fixed_allowances || {});
        } catch (e) { console.error('Failed to parse fixed_allowances during sync:', e); }

        const syncQuery = `UPDATE employees SET 
                designation=?, basic_salary=?, date_joined=?, employee_grade=?, 
                cpf_applicable=?, custom_allowances=?, custom_deductions=?,
                transport_allowance=?, meal_allowance=?, status=?
                WHERE id=?`;

        const syncParams = [
            k.job_title, k.basic_salary, k.employment_start_date, k.employee_grade || '',
            cpfPayable, customAllowances, customDeductions,
            Number(fAllowances.transport) || 0, Number(fAllowances.meal) || 0,
            'Active', // Add status as 'Active'
            empId
        ];

        db.run(syncQuery, syncParams);
        const empChanges = db.exec("SELECT changes()")[0].values[0][0];
        console.log(`[KET Update] employees table rows synchronized: ${empChanges}`);

        if (empChanges === 0) {
            console.warn(`[KET Update] CRITICAL: Sync failed - Employee ID ${empId} not found in employees table!`);
            // Optionally throw an error here if this is a hard requirement
            // throw new Error(`Employee record for ID ${empId} not found for synchronization.`);
        }

        saveDb();

        // Re-fetch the updated KET with all joined data to return to frontend
        const result = db.exec(`
            SELECT k.*, e.full_name as employee_name, e.employee_id as employee_code, e.date_joined, en.name as entity_name, en.logo_url,
                   e.email, e.whatsapp_number, e.mobile_number
            FROM employee_kets k 
            JOIN employees e ON k.employee_id = e.id 
            LEFT JOIN entities en ON e.entity_id = en.id
            WHERE k.employee_id = ? AND e.entity_id = ?
        `, [empId, req.user.entityId]);

        const kets = toObjects(result);
        if (!kets.length) return res.status(404).json({ error: 'KETs not found after update' });

        const ket = kets[0];
        try { ket.fixed_allowances = JSON.parse(ket.fixed_allowances || '{}'); } catch (e) { ket.fixed_allowances = {}; }
        try { ket.fixed_deductions = JSON.parse(ket.fixed_deductions || '{}'); } catch (e) { ket.fixed_deductions = {}; }

        console.log('[KET Update] Cycle complete, returning fresh KET data');
        res.json(ket);
    } catch (err) {
        console.error('[KET Update] Error:', err);
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
