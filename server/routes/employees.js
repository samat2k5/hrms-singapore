const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ dest: 'uploads/temp/' });

const router = express.Router();

// Helper to convert sql.js result to array of objects
function toObjects(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

// GET /api/employees
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        let entityId = req.query.entityId || req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const userId = req.user.id;
        const authSql = `SELECT uer.entity_id FROM user_entity_roles uer WHERE uer.user_id = ? AND uer.entity_id = ?`;
        const authRes = db.exec(authSql, [userId, entityId]);
        if (authRes.length === 0) {
            const roleSql = `SELECT role FROM user_entity_roles WHERE user_id = ? AND role = 'Admin' LIMIT 1`;
            const roleRes = db.exec(roleSql, [userId]);
            if (roleRes.length === 0) {
                return res.status(403).json({ error: 'Not authorized for this entity' });
            }
        }

        let query = 'SELECT * FROM employees WHERE entity_id = ?';
        const params = [entityId];

        // RBAC enforcement
        if (String(req.user.role).toUpperCase() === 'HR') {
            const groups = req.user.managedGroups || [];
            if (groups.length === 0) {
                return res.json([]);
            }
            const placeholders = groups.map(() => '?').join(',');
            query += ` AND employee_group IN (${placeholders})`;
            params.push(...groups);
        }

        query += ' ORDER BY employee_id';
        const result = db.exec(query, params);
        const emps = toObjects(result);
        res.json(emps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/employees/:id/face - Biometric Enrollment with Uniqueness Check
router.put('/:id/face', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { descriptor } = req.body;
        const employeeId = req.params.id;
        const entityId = req.user.entityId;

        if (!descriptor) return res.status(400).json({ error: 'Missing descriptor' });

        // Anti-Duplication Check: Compare against all employees in the SAME entity
        const empsRes = db.exec('SELECT id, full_name, face_descriptor FROM employees WHERE entity_id = ? AND face_descriptor IS NOT NULL', [entityId]);
        const emps = toObjects(empsRes);

        console.log(`[FACE_REG] Checking uniqueness for employee ${employeeId} against ${emps.length} records`);

        const calculateDistance = (d1, d2) => Math.sqrt(d1.reduce((sum, val, i) => sum + Math.pow(val - d2[i], 2), 0));

        for (const emp of emps) {
            // Skip the employee we are currently enrolling (allow re-enrollment for same person)
            if (String(emp.id) === String(employeeId)) continue;

            try {
                const empDescriptor = JSON.parse(emp.face_descriptor);
                const distance = calculateDistance(descriptor, empDescriptor);

                // Logging for shared distance debugging
                if (distance < 0.8) {
                    console.log(`   - Potential match found with ${emp.full_name}, distance: ${distance.toFixed(4)}`);
                }

                if (distance < 0.6) { // Threshold for identifying same person
                    console.warn(`[FACE_REG] REJECTED: Face matches ${emp.full_name} (dist: ${distance.toFixed(4)})`);
                    return res.status(400).json({ error: `Face is already enrolled for ${emp.full_name}` });
                }
            } catch (e) { }
        }

        console.log(`[FACE_REG] SUCCESS: Saving face for employee ${employeeId}`);
        db.run('UPDATE employees SET face_descriptor = ? WHERE id = ?', [JSON.stringify(descriptor), employeeId]);
        saveDb();
        res.json({ message: 'Face descriptor saved' });
    } catch (err) {
        console.error('[FACE_REG_ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id/face - Nullify Biometric Data
router.delete('/:id/face', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const employeeId = req.params.id;
        const entityId = req.user.entityId;

        console.log(`[FACE_RESET] Nullifying face for employee ${employeeId}`);
        db.run('UPDATE employees SET face_descriptor = NULL WHERE id = ? AND entity_id = ?', [employeeId, entityId]);
        saveDb();
        res.json({ message: 'Face biometric data reset successfully' });
    } catch (err) {
        console.error('[FACE_RESET_ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/:id
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        let query = 'SELECT e.*, en.name as entity_name, en.logo_url FROM employees e JOIN entities en ON e.entity_id = en.id WHERE e.id = ? AND e.entity_id = ?';
        const params = [req.params.id, entityId];

        if (String(req.user.role).toUpperCase() === 'HR') {
            const groups = req.user.managedGroups || [];
            if (groups.length === 0) return res.status(403).json({ error: 'Access denied' });

            const placeholders = groups.map(() => '?').join(',');
            query += ` AND employee_group IN (${placeholders})`;
            params.push(...groups);
        }

        const result = db.exec(query, params);
        const employees = toObjects(result);
        if (!employees.length) return res.status(404).json({ error: 'Employee not found or access denied' });
        res.json(employees[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees
router.post('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const e = req.body;
        const isResident = ['Citizen', 'PR'].includes(e.nationality);
        let warning = null;

        if (isResident) {
            if (!e.national_id) return res.status(400).json({ error: 'National ID (NRIC/FIN) is required for Citizens/PRs.' });
            const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ?', [e.national_id]);
            const activeEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
            if (activeEntitiesCount >= 2) return res.status(400).json({ error: 'This employee has reached the maximum limit of 2 entities.' });
            if (activeEntitiesCount === 1) warning = 'Note: This employee is now assigned to the maximum of 2 entities.';
        }

        db.run(
            `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, gender, language, mobile_number, whatsapp_number, email, highest_education, designation, department, employee_group, employee_grade, date_joined, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, status, payment_mode, custom_allowances, custom_deductions, site_id, working_days_per_week, rest_day, working_hours_per_day, working_hours_per_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [entityId, e.employee_id || '', e.full_name || '', e.date_of_birth || null, e.national_id || null, e.nationality || 'Singapore Citizen', e.tax_residency || 'Resident', e.race || 'Chinese', e.gender || '', e.language || '', e.mobile_number || '', e.whatsapp_number || '', e.email || '', e.highest_education || 'Others', e.designation || '', e.department || '', e.employee_group || 'General', e.employee_grade || '', e.date_joined || null, e.basic_salary || 0, e.transport_allowance || 0, e.meal_allowance || 0, e.other_allowance || 0, e.bank_name || '', e.bank_account || '', e.cpf_applicable !== undefined ? e.cpf_applicable : 1, e.status || 'Active', e.payment_mode || 'Bank Transfer', e.custom_allowances || '{}', e.custom_deductions || '{}', e.site_id || null, e.working_days_per_week || 5.5, e.rest_day || 'Sunday', e.working_hours_per_day || 8, e.working_hours_per_week || 44]
        );
        saveDb();

        const result = db.exec('SELECT * FROM employees WHERE employee_id = ? AND entity_id = ?', [e.employee_id, entityId]);
        const created = toObjects(result)[0];

        db.run(
            `INSERT INTO employee_kets (employee_id, job_title, employment_start_date, basic_salary, fixed_allowances, working_days_per_week, rest_day, working_hours_per_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [created.id, e.designation || 'Employee', e.date_joined || new Date().toISOString().split('T')[0], e.basic_salary || 0,
            JSON.stringify({ transport: e.transport_allowance || 0, meal: e.meal_allowance || 0 }),
            e.working_days_per_week || 5.5, e.rest_day || 'Sunday', e.working_hours_per_day || 8]
        );

        const leaveTypesResult = db.exec('SELECT * FROM leave_types');
        const types = toObjects(leaveTypesResult);
        const year = new Date().getFullYear();
        types.forEach(lt => {
            db.run(`INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, 0, ?)`,
                [created.id, lt.id, year, lt.default_days, lt.default_days]);
        });
        saveDb();
        res.status(201).json({ ...created, warning });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/employees/:id
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const e = req.body;
        db.run(
            `UPDATE employees SET full_name=?, date_of_birth=?, national_id=?, nationality=?, tax_residency=?, race=?, gender=?, language=?, mobile_number=?, whatsapp_number=?, email=?, highest_education=?, designation=?, department=?, employee_group=?, employee_grade=?, date_joined=?, basic_salary=?, transport_allowance=?, meal_allowance=?, other_allowance=?, bank_name=?, bank_account=?, cpf_applicable=?, status=?, payment_mode=?, custom_allowances=?, custom_deductions=?, site_id=?, working_days_per_week=?, rest_day=?, working_hours_per_day=?, working_hours_per_week=? WHERE id=? AND entity_id=?`,
            [e.full_name || '', e.date_of_birth || null, e.national_id || null, e.nationality || 'Singapore Citizen', e.tax_residency || 'Resident', e.race || 'Chinese', e.gender || '', e.language || '', e.mobile_number || '', e.whatsapp_number || '', e.email || '', e.highest_education || 'Others', e.designation || '', e.department || '', e.employee_group || 'General', e.employee_grade || '', e.date_joined || null, e.basic_salary || 0, e.transport_allowance || 0, e.meal_allowance || 0, e.other_allowance || 0, e.bank_name || '', e.bank_account || '', e.cpf_applicable !== undefined ? e.cpf_applicable : 1, e.status || 'Active', e.payment_mode || 'Bank Transfer', e.custom_allowances || '{}', e.custom_deductions || '{}', e.site_id || null, e.working_days_per_week || 5.5, e.rest_day || 'Sunday', e.working_hours_per_day || 8, e.working_hours_per_week || 44, req.params.id, entityId]
        );
        saveDb();
        const result = db.exec('SELECT * FROM employees WHERE id = ?', [req.params.id]);
        res.json(toObjects(result)[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/employees/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run('DELETE FROM employee_kets WHERE employee_id = ?', [req.params.id]);
        db.run('DELETE FROM leave_balances WHERE employee_id = ?', [req.params.id]);
        db.run('DELETE FROM leave_requests WHERE employee_id = ?', [req.params.id]);
        db.run('DELETE FROM employees WHERE id = ?', [req.params.id]);
        saveDb();
        res.json({ message: 'Employee deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/employees/:id/transfer
router.post('/:id/transfer', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const currentEntityId = req.user.entityId;
        const { targetEntityId } = req.body;
        db.exec('BEGIN TRANSACTION');
        try {
            const empResult = db.exec('SELECT * FROM employees WHERE id = ? AND entity_id = ?', [req.params.id, currentEntityId]);
            const emp = toObjects(empResult)[0];
            db.run(
                `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, gender, language, mobile_number, whatsapp_number, email, highest_education, designation, department, employee_group, employee_grade, date_joined, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, status, payment_mode, custom_allowances, custom_deductions, site_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [targetEntityId, emp.employee_id || '', emp.full_name || '', emp.date_of_birth || null, emp.national_id || null, emp.nationality || 'Singapore Citizen', emp.tax_residency || 'Resident', emp.race || 'Chinese', emp.gender || '', emp.language || '', emp.mobile_number || '', emp.whatsapp_number || '', emp.email || '', emp.highest_education || 'Others', emp.designation || '', emp.department || '', emp.employee_group || 'General', emp.employee_grade || '', emp.date_joined || null, emp.basic_salary || 0, emp.transport_allowance || 0, emp.meal_allowance || 0, emp.other_allowance || 0, emp.bank_name || '', emp.bank_account || '', emp.cpf_applicable !== undefined ? emp.cpf_applicable : 1, 'Active', emp.payment_mode || 'Bank Transfer', emp.custom_allowances || '{}', emp.custom_deductions || '{}', emp.site_id || null]
            );
            const newEmpId = db.exec(`SELECT last_insert_rowid() AS id`)[0].values[0][0];
            db.run('UPDATE employees SET status = \'Transferred\' WHERE id = ?', [emp.id]);
            db.exec('COMMIT');
            saveDb();
            res.json({ message: 'Employee transferred', newId: newEmpId });
        } catch (err) { db.exec('ROLLBACK'); throw err; }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/employees/bulk-custom
router.post('/bulk-custom', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { records } = req.body;
        db.exec('BEGIN TRANSACTION');
        try {
            records.forEach(rc => {
                db.run(`UPDATE employees SET custom_allowances = ?, custom_deductions = ? WHERE id = ? AND entity_id = ?`,
                    [JSON.stringify(rc.custom_allowances || {}), JSON.stringify(rc.custom_deductions || {}), rc.id, req.user.entityId]);
            });
            db.exec('COMMIT');
            saveDb();
            res.json({ message: 'Bulk modifiers applied' });
        } catch (err) { db.exec('ROLLBACK'); throw err; }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/employees/bulk-import
router.post('/bulk-import', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const db = await getDb();
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const workbook = XLSX.readFile(req.file.path);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const results = { processed: 0, skipped: 0, errors: [] };
        db.exec('BEGIN TRANSACTION');
        try {
            for (const row of data) {
                const e = {
                    employee_id: String(row['Employee ID'] || ''),
                    full_name: row['Full Name'] || '',
                    national_id: row['National ID'] || '',
                    nationality: row['Nationality'] || 'Citizen',
                    basic_salary: parseFloat(row['Basic Salary'] || 0),
                };
                if (!e.full_name || !e.employee_id) { results.skipped++; continue; }
                db.run(`INSERT INTO employees (entity_id, employee_id, full_name, national_id, nationality, basic_salary, status) VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
                    [req.user.entityId, e.employee_id, e.full_name, e.national_id, e.nationality, e.basic_salary]);
                results.processed++;
            }
            db.exec('COMMIT');
            saveDb();
            res.json({ message: 'Import completed', ...results });
        } catch (err) { db.exec('ROLLBACK'); throw err; }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// JSON 404 handler for employees router
router.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found in employees router` });
});

module.exports = router;
