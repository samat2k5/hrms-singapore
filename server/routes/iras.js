const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const { calculateIR8A, generateAISPayload } = require('../engine/iras-engine');
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

        // Migrate iras_forms schema if needed
        try {
            const info = db.exec("PRAGMA table_info(iras_forms)");
            if (info.length) {
                const cols = info[0].values.map(v => v[1]);
                if (!cols.includes('year') && cols.includes('year_of_assessment')) {
                    db.run('ALTER TABLE iras_forms ADD COLUMN year INTEGER');
                    db.run('UPDATE iras_forms SET year = year_of_assessment WHERE year IS NULL');
                }
                if (!cols.includes('data_json') && cols.includes('form_data')) {
                    db.run('ALTER TABLE iras_forms ADD COLUMN data_json TEXT');
                    db.run("UPDATE iras_forms SET data_json = form_data WHERE data_json IS NULL");
                }
                if (!cols.includes('status')) {
                    db.run("ALTER TABLE iras_forms ADD COLUMN status TEXT DEFAULT 'Generated'");
                    db.run("UPDATE iras_forms SET status = CASE WHEN is_amendment = 1 THEN 'Amended' ELSE 'Generated' END WHERE status IS NULL");
                }
                if (!cols.includes('version')) {
                    db.run('ALTER TABLE iras_forms ADD COLUMN version INTEGER DEFAULT 1');
                }
                console.log('[DB] IRAS forms migration complete');
            }
        } catch (e) { console.log('[DB] IRAS migration skipped:', e.message); }

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
            WHERE f.entity_id = ? AND f.year = ?
        `, [req.user.entityId, year]);
        res.json(toObjects(result));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GENERATE IR8A (Enhanced for 2026)
router.post('/generate/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year);
        const entityId = req.user.entityId;

        // Fetch aggregation from payslips
        const aggregations = db.exec(`
            SELECT p.employee_id as employee_id_db, e.employee_id as emp_code, e.full_name, e.nationality, e.cessation_date,
                   SUM(p.gross_pay) as total_gross,
                   SUM(p.bonus) as total_bonus,
                   SUM(p.cpf_employee) as total_cpf,
                   SUM(p.cpf_employer) as total_employer_cpf,
                   SUM(p.transport_allowance) as total_transport,
                   SUM(p.other_allowance) as total_other_allowance
            FROM payslips p
            JOIN payroll_runs r ON p.payroll_run_id = r.id
            JOIN employees e ON p.employee_id = e.id
            WHERE e.entity_id = ?
            AND r.period_year = ?
            GROUP BY p.employee_id
        `, [entityId, year]);

        const rows = toObjects(aggregations);
        let recordsCount = 0;

        for (const row of rows) {
            // Exclude Foreign Cessation (Requires IR21)
            if (row.nationality && row.nationality !== 'Citizen' && row.nationality !== 'Permanent Resident' && row.cessation_date) {
                continue;
            }

            // Fetch BIKs
            const biks = toObjects(db.exec('SELECT * FROM iras_benefits_in_kind WHERE employee_id = ? AND year = ?', [row.employee_id_db, year]));

            // Fetch Share Options
            const shares = toObjects(db.exec('SELECT * FROM iras_share_options WHERE employee_id = ? AND year = ?', [row.employee_id_db, year]));

            // Fetch full employee for details
            const employee = toObjects(db.exec('SELECT * FROM employees WHERE id = ?', [row.employee_id_db]))[0];

            const ir8aData = calculateIR8A(employee, row, biks, shares);

            db.run(
                `INSERT INTO iras_forms (entity_id, employee_id, year, form_type, data_json, status, version) VALUES (?, ?, ?, 'IR8A', ?, 'Generated', 1)`,
                [entityId, row.employee_id_db, year, JSON.stringify(ir8aData)]
            );
            recordsCount++;
        }

        // Audit Log
        db.run(
            `INSERT INTO submission_logs (entity_id, user_id, username, submission_type, file_type, records_count) VALUES (?, ?, ?, 'IR8A Original', 'IR8A', ?)`,
            [entityId, req.user.id, req.user.username, recordsCount]
        );

        saveDb();
        res.status(201).json({ message: `Generated enhanced IR8A forms for ${recordsCount} employees.` });
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
        const vResult = db.exec('SELECT MAX(version) as max_v FROM iras_forms WHERE entity_id = ? AND employee_id = ? AND year = ? AND form_type = \'IR8A\'', [entityId, empId, year]);
        const maxV = toObjects(vResult)[0]?.max_v || 0;

        if (maxV === 0) return res.status(400).json({ error: "No original form found to amend." });

        // Recalculate Aggregations
        const aggregations = db.exec(`
            SELECT p.employee_id as employee_id_db, 
                   SUM(p.gross_pay) as total_gross, 
                   SUM(p.bonus) as total_bonus, 
                   SUM(p.cpf_employee) as total_cpf, 
                   SUM(p.cpf_employer) as total_employer_cpf,
                   SUM(p.transport_allowance) as total_transport,
                   SUM(p.other_allowance) as total_other_allowance
            FROM payslips p JOIN payroll_runs r ON p.payroll_run_id = r.id
            WHERE p.employee_id = ? AND r.period_year = ?
        `, [empId, year]);
        const aRow = toObjects(aggregations)[0];

        // Fetch BIKs & Shares
        const biks = toObjects(db.exec('SELECT * FROM iras_benefits_in_kind WHERE employee_id = ? AND year = ?', [empId, year]));
        const shares = toObjects(db.exec('SELECT * FROM iras_share_options WHERE employee_id = ? AND year = ?', [empId, year]));
        const employee = toObjects(db.exec('SELECT * FROM employees WHERE id = ?', [empId]))[0];

        const ir8aData = calculateIR8A(employee, aRow, biks, shares);

        db.run(
            `INSERT INTO iras_forms (entity_id, employee_id, year, form_type, data_json, status, version) VALUES (?, ?, ?, 'IR8A', ?, 'Amended', ?)`,
            [entityId, empId, year, JSON.stringify(ir8aData), maxV + 1]
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
            WHERE entity_id = ? 
            AND cessation_date IS NOT NULL 
            AND nationality NOT IN ('Citizen', 'Permanent Resident')
        `, [req.user.entityId]);
        const employees = toObjects(result);
        res.json(employees);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// AIS JSON EXPORT
router.get('/export-ais-json/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year);
        const entityId = req.user.entityId;

        const formsResult = db.exec(`
            SELECT f.data_json 
            FROM iras_forms f 
            WHERE f.entity_id = ? AND f.year = ? AND f.status != 'Void'
            AND f.version = (SELECT MAX(version) FROM iras_forms WHERE employee_id = f.employee_id AND year = f.year)
        `, [entityId, year]);

        const forms = toObjects(formsResult);
        if (forms.length === 0) return res.status(404).json({ error: 'No generated forms found for this year.' });

        const ir8aRecords = forms.map(f => JSON.parse(f.data_json));
        const entity = toObjects(db.exec('SELECT * FROM entities WHERE id = ?', [entityId]))[0];

        const payload = generateAISPayload(entity, year, ir8aRecords);
        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// BIK MANAGEMENT
router.get('/benefits/:empId/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM iras_benefits_in_kind WHERE employee_id = ? AND year = ?', [req.params.empId, req.params.year]);
        res.json(toObjects(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/benefits', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { employee_id, year, category, description, value, period_from, period_to } = req.body;
        db.run(
            `INSERT INTO iras_benefits_in_kind (employee_id, year, category, description, value, period_from, period_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employee_id, year, category, description, value, period_from, period_to]
        );
        saveDb();
        res.status(201).json({ message: 'Benefit added' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/benefits/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run('DELETE FROM iras_benefits_in_kind WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SHARE OPTIONS MANAGEMENT
router.get('/shares/:empId/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM iras_share_options WHERE employee_id = ? AND year = ?', [req.params.empId, req.params.year]);
        res.json(toObjects(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shares', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { employee_id, year, plan_type, grant_date, exercise_date, exercise_price, market_value, shares_count, taxable_profit } = req.body;
        db.run(
            `INSERT INTO iras_share_options (employee_id, year, plan_type, grant_date, exercise_date, exercise_price, market_value, shares_count, taxable_profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [employee_id, year, plan_type, grant_date, exercise_date, exercise_price, market_value, shares_count, taxable_profit]
        );
        saveDb();
        res.status(201).json({ message: 'Share record added' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/shares/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run('DELETE FROM iras_share_options WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// AUDIT LOGS
router.get('/audit-logs', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });
        const result = db.exec(
            'SELECT * FROM submission_logs WHERE entity_id = ? ORDER BY timestamp DESC LIMIT 100',
            [entityId]
        );
        res.json(toObjects(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CPF EXCESS CHECK
router.get('/cpf-excess', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });
        // Employees whose annual ordinary wages exceed the CPF ceiling
        const currentYear = new Date().getFullYear();
        const result = db.exec(`
            SELECT e.id, e.employee_id, e.full_name, SUM(p.basic_salary) as annual_ow
            FROM payslips p
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id
            JOIN employees e ON p.employee_id = e.id
            WHERE pr.entity_id = ? AND pr.period_year = ?
            GROUP BY p.employee_id
            HAVING annual_ow > 102000
        `, [entityId, currentYear]);
        res.json(toObjects(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

