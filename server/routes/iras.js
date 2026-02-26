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

// Route endpoints start here

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
                `INSERT INTO iras_forms (entity_id, employee_id, year, year_of_assessment, form_type, data_json, form_data, status, version) VALUES (?, ?, ?, ?, 'IR8A', ?, ?, 'Generated', 1)`,
                [entityId, row.employee_id_db, year, year, JSON.stringify(ir8aData), JSON.stringify(ir8aData)]
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
            `INSERT INTO iras_forms (entity_id, employee_id, year, year_of_assessment, form_type, data_json, form_data, status, version) VALUES (?, ?, ?, ?, 'IR8A', ?, ?, 'Amended', ?)`,
            [entityId, empId, year, year, JSON.stringify(ir8aData), JSON.stringify(ir8aData), maxV + 1]
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

// VALIDATION ENGINE
router.get('/validate/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year);
        const entityId = req.user.entityId;

        const formsResult = db.exec(`
            SELECT f.*, e.full_name, e.employee_id as emp_code
            FROM iras_forms f
            JOIN employees e ON f.employee_id = e.id
            WHERE f.entity_id = ? AND f.year = ?
            AND f.version = (SELECT MAX(version) FROM iras_forms WHERE employee_id = f.employee_id AND year = f.year)
        `, [entityId, year]);

        const forms = toObjects(formsResult);
        const validationResults = forms.map(f => {
            const data = JSON.parse(f.data_json);
            const errors = [];

            // 1. NRIC Validation
            const nricRegex = /^[STFGM]\d{7}[A-Z]$/i;
            if (!data.id_no || !nricRegex.test(data.id_no)) {
                errors.push('Invalid NRIC/FIN format');
            }

            // 2. Mandatory Fields
            if (!data.address_type) errors.push('Missing Address Type');
            if (!data.block_no && !data.house_no) errors.push('Missing House/Block No');
            if (!data.postal_code) errors.push('Missing Postal Code');

            // 3. CPF Ceiling Check (Simplified for YA 2026/2025)
            // Monthly OW cap: 6800 (from Jan 2024), 7400 (from Jan 2025)
            const annualOWCap = year >= 2025 ? 7400 * 12 : 6800 * 12;
            if (data.gross_remuneration > annualOWCap && data.cpf_employee < 1200) { // arbitrary sanity check
                // This is just a warning usually
            }

            return {
                id: f.id,
                employee_id: f.employee_id,
                full_name: f.full_name,
                emp_code: f.emp_code,
                errors
            };
        });

        res.json(validationResults);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// IR21 DRAFTING
router.post('/ir21/draft/:empId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const empId = req.params.empId;
        const entityId = req.user.entityId;
        const currentYear = new Date().getFullYear();

        const employee = toObjects(db.exec('SELECT * FROM employees WHERE id = ? AND entity_id = ?', [empId, entityId]))[0];
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        // Aggregate YTD income
        const ytdResult = db.exec(`
            SELECT SUM(p.gross_pay) as total_gross, SUM(p.bonus) as total_bonus, SUM(p.cpf_employee) as total_cpf
            FROM payslips p
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id
            WHERE p.employee_id = ? AND pr.period_year = ?
        `, [empId, currentYear]);
        const ytd = toObjects(ytdResult)[0] || { total_gross: 0, total_bonus: 0, total_cpf: 0 };

        const draft = {
            employee_details: {
                full_name: employee.full_name,
                id_no: employee.id_no,
                nationality: employee.nationality,
                cessation_date: employee.cessation_date
            },
            income_summary: {
                year: currentYear,
                gross_pay: ytd.total_gross,
                bonus: ytd.total_bonus,
                cpf: ytd.total_cpf
            }
        };

        res.json(draft);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SFFS SUBMISSION (AIS-API 2.0 SIMULATION)
router.post('/submit-sffs/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const year = parseInt(req.params.year);
        const entityId = req.user.entityId;

        // 1. Fetch data for payload
        const formsResult = db.exec(`
            SELECT f.data_json 
            FROM iras_forms f 
            WHERE f.entity_id = ? AND f.year = ? AND f.status != 'Void'
            AND f.version = (SELECT MAX(version) FROM iras_forms WHERE employee_id = f.employee_id AND year = f.year)
        `, [entityId, year]);

        const forms = toObjects(formsResult);
        if (forms.length === 0) return res.status(404).json({ error: 'No validated forms found to submit.' });

        const ir8aRecords = forms.map(f => JSON.parse(f.data_json));
        const entity = toObjects(db.exec('SELECT * FROM entities WHERE id = ?', [entityId]))[0];

        // 2. Generate AIS 2.0 Payload
        const payload = generateAISPayload(entity, year, ir8aRecords);
        const submissionId = `SFFS-${year}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // 3. Store Submission (Pending)
        db.run(
            `INSERT INTO iras_submissions (entity_id, submission_id, year, type, status, payload_json) VALUES (?, ?, ?, 'AIS', 'Pending', ?)`,
            [entityId, submissionId, year, JSON.stringify(payload)]
        );
        saveDb();

        // 4. Simulate Background Processing (Async Task)
        setTimeout(async () => {
            const innerDb = await getDb();
            const success = Math.random() > 0.1; // 90% success rate simulation
            const status = success ? 'Accepted' : 'Rejected';
            const response = success
                ? { acknowledgment_no: `ACK-${Date.now()}`, message: "Submission successful" }
                : { error_code: "VAL001", message: "NRIC format mismatch for 1 record" };

            innerDb.run(
                'UPDATE iras_submissions SET status = ?, response_json = ? WHERE submission_id = ?',
                [status, JSON.stringify(response), submissionId]
            );
            saveDb();
        }, 5000);

        res.json({ submissionId, status: 'Pending', message: 'Filing transmitted to IRAS APEX Gateway.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/submission/:submissionId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM iras_submissions WHERE submission_id = ? AND entity_id = ?', [req.params.submissionId, req.user.entityId]);
        const sub = toObjects(result)[0];
        if (!sub) return res.status(404).json({ error: 'Submission not found' });
        res.json(sub);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/submissions/history/:year', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT * FROM iras_submissions WHERE year = ? AND entity_id = ? ORDER BY timestamp DESC', [req.params.year, req.user.entityId]);
        res.json(toObjects(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// NS CLAIMS MANAGEMENT
router.get('/ns-claims', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec('SELECT n.*, e.full_name as employee_name FROM ns_claims n JOIN employees e ON n.employee_id = e.id WHERE n.entity_id = ? ORDER BY n.start_date DESC', [req.user.entityId]);
        res.json(toObjects(result));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/ns-claims', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { employee_id, start_date, end_date, total_days, claim_amount } = req.body;
        db.run(
            `INSERT INTO ns_claims (entity_id, employee_id, start_date, end_date, total_days, claim_amount) VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.entityId, employee_id, start_date, end_date, total_days, claim_amount]
        );
        saveDb();
        res.status(201).json({ message: 'NS Claim logged successfully.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CERTIFICATION READINESS AUDIT
router.get('/compliance-readiness', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const checks = [];

        // 1. Entity Checks
        const entity = toObjects(db.exec('SELECT * FROM entities WHERE id = ?', [entityId]))[0];
        checks.push({
            category: 'Entity',
            name: 'Business UEN',
            status: entity?.uen ? 'Pass' : 'Critical',
            message: entity?.uen ? `UEN: ${entity.uen}` : 'Missing Entity UEN'
        });

        // 2. Employee Data Quality
        const emps = toObjects(db.exec('SELECT * FROM employees WHERE entity_id = ?', [entityId]));
        const missingNric = emps.filter(e => !e.national_id).length;
        const missingAddr = emps.filter(e => !e.address_block && !e.address_street).length;

        checks.push({
            category: 'Employee',
            name: 'National ID (NRIC/FIN)',
            status: missingNric === 0 ? 'Pass' : 'Critical',
            message: missingNric === 0 ? 'All employees have IDs' : `${missingNric} employees missing IDs`
        });

        checks.push({
            category: 'Employee',
            name: 'Address Completeness',
            status: missingAddr === 0 ? 'Pass' : 'Warning',
            message: missingAddr === 0 ? 'Addresses verified' : `${missingAddr} employees miss standard address`
        });

        // 3. Payroll Readiness
        const formsCount = toObjects(db.exec('SELECT COUNT(*) as count FROM iras_forms WHERE entity_id = ?', [entityId]))[0]?.count || 0;
        checks.push({
            category: 'Payroll',
            name: 'IR8A Generation Status',
            status: formsCount > 0 ? 'Pass' : 'Warning',
            message: formsCount > 0 ? `${formsCount} forms generated` : 'No forms generated for this YA'
        });

        const score = Math.round((checks.filter(c => c.status === 'Pass').length / checks.length) * 100);
        res.json({ score, checks });
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

