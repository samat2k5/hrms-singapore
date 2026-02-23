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

// Ensure columns exist on boot
(async () => {
    try {
        const db = await getDb();
        try { db.run(`ALTER TABLE employees ADD COLUMN cessation_date DATE`); } catch (e) { }
        saveDb();
    } catch (e) { }
})();

// GET Forms
router.get('/forms/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = req.params.year;
        const result = db.exec(`
            SELECT f.*, e.employee_id as emp_code, e.full_name 
            FROM iras_forms f 
            JOIN employees e ON f.employee_id = e.id 
            WHERE f.entity_id = ${req.user.entityId} AND f.year = ${year}
        `);
        res.json(toObjects(result));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GENERATE IR8A (Original)
router.post('/generate/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year);
        const entityId = req.user.entityId;

        // Check if already generated Original
        const check = db.exec(`SELECT id FROM iras_forms WHERE entity_id = ${entityId} AND year = ${year} AND form_type = 'IR8A' AND version = 1`);
        if (toObjects(check).length > 0) {
            return res.status(400).json({ error: 'Original IR8A for this year already generated. Use Amendments instead.' });
        }

        // Fetch aggregation from payslips
        const aggregations = db.exec(`
            SELECT p.employee_id as employee_id_db, e.employee_id as emp_code, e.full_name, e.nationality, e.cessation_date,
                   SUM(p.gross_pay) as total_gross,
                   SUM(p.bonus) as total_bonus,
                   SUM(p.cpf_employee) as total_cpf,
                   SUM(p.cpf_employer) as total_employer_cpf
            FROM payslips p
            JOIN payroll_runs r ON p.payroll_run_id = r.id
            JOIN employees e ON p.employee_id = e.id
            WHERE e.entity_id = ${entityId}
            AND r.period_year = ${year}
            GROUP BY p.employee_id
        `);

        const rows = toObjects(aggregations);
        let recordsCount = 0;

        for (const row of rows) {
            // Exclude Foreign Cessation (Requires IR21)
            if (row.nationality && row.nationality !== 'Citizen' && row.nationality !== 'Permanent Resident' && row.cessation_date) {
                // Skips IR8A for those requiring IR21
                continue;
            }

            const dataJson = JSON.stringify({
                gross_salary: row.total_gross || 0,
                bonus: row.total_bonus || 0,
                cpf: row.total_cpf || 0,
                employer_cpf: row.total_employer_cpf || 0
            });

            db.run(
                `INSERT INTO iras_forms (entity_id, employee_id, year, form_type, data_json, status, version) VALUES (?, ?, ?, 'IR8A', ?, 'Generated', 1)`,
                [entityId, row.employee_id_db, year, dataJson]
            );
            recordsCount++;
        }

        // Audit Log
        db.run(
            `INSERT INTO submission_logs (entity_id, user_id, username, submission_type, file_type, records_count) VALUES (?, ?, ?, 'IR8A Original', 'IR8A', ?)`,
            [entityId, req.user.id, req.user.username, recordsCount] // records count fixes
        );

        saveDb();
        res.status(201).json({ message: `Generated original IR8A forms for ${recordsCount} employees.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// AMEND IR8A
router.post('/amend/:year/:empId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year);
        const empId = parseInt(req.params.empId);
        const entityId = req.user.entityId;
        const currentYear = new Date().getFullYear();

        if (year < currentYear - 4) return res.status(400).json({ error: "Cannot amend forms older than 4 back-years." });
        if (year > currentYear + 1) return res.status(400).json({ error: "Cannot amend forms beyond 1 advance year." });

        // Get latest version
        const vResult = db.exec(`SELECT MAX(version) as max_v FROM iras_forms WHERE entity_id = ${entityId} AND employee_id = ${empId} AND year = ${year} AND form_type = 'IR8A'`);
        const maxV = toObjects(vResult)[0]?.max_v || 0;

        if (maxV === 0) return res.status(400).json({ error: "No original form found to amend." });

        // Recalculate
        const aggregations = db.exec(`
            SELECT SUM(p.gross_pay) as total_gross, SUM(p.bonus) as total_bonus, SUM(p.cpf_employee) as total_cpf, SUM(p.cpf_employer) as total_employer_cpf
            FROM payslips p JOIN payroll_runs r ON p.payroll_run_id = r.id
            WHERE p.employee_id = ${empId} AND r.period_year = ${year}
        `);
        const aRow = toObjects(aggregations)[0];

        const dataJson = JSON.stringify({
            gross_salary: aRow.total_gross || 0,
            bonus: aRow.total_bonus || 0,
            cpf: aRow.total_cpf || 0,
            employer_cpf: aRow.total_employer_cpf || 0
        });

        db.run(
            `INSERT INTO iras_forms (entity_id, employee_id, year, form_type, data_json, status, version) VALUES (?, ?, ?, 'IR8A', ?, 'Amended', ?)`,
            [entityId, empId, year, dataJson, maxV + 1]
        );

        // Audit Log
        db.run(
            `INSERT INTO submission_logs (entity_id, user_id, username, submission_type, file_type, records_count) VALUES (?, ?, ?, 'IR8A Amendment', 'IR8A', 1)`,
            [entityId, req.user.id, req.user.username]
        );

        saveDb();

        const requiresFormSG = (year < currentYear); // Back year amendments require FormSG
        res.json({ message: "Amended successfully.", requiresFormSG, formSgUrl: "https://go.gov.sg/vd-errors-individuals-excluding-self-employed" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CESSATION / IR21 CHECK
router.get('/cessation-check', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`
            SELECT * FROM employees 
            WHERE entity_id = ${req.user.entityId} 
            AND cessation_date IS NOT NULL 
            AND nationality NOT IN ('Citizen', 'Permanent Resident')
        `);
        const employees = toObjects(result);
        res.json(employees);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CPF EXCESS VALIDATION (Simple heuristic)
router.get('/cpf-excess', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const aggregations = db.exec(`
            SELECT p.employee_id, e.full_name, e.employee_id as emp_code, SUM(p.cpf_employee + p.cpf_employer) as total_cpf
            FROM payslips p
            JOIN employees e ON p.employee_id = e.id
            JOIN payroll_runs r ON p.payroll_run_id = r.id
            WHERE e.entity_id = ${req.user.entityId}
            GROUP BY p.employee_id
            HAVING total_cpf > 37740
        `);
        res.json(toObjects(aggregations));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
