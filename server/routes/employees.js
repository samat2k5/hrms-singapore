const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ dest: 'uploads/temp/' });

const router = express.Router();

// Helper to convert sql.js result to array of objects
function toObjects(result) {
    if (!result.length) return [];
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
                return res.json([]); // HR with no groups sees no one
            }
            // Since sql.js doesn't support array parameters for IN easily without dynamic placeholder generation
            // we will use a safe join for groups if they are trusted strings
            const placeholders = groups.map(() => '?').join(',');
            query += ` AND employee_group IN (${placeholders})`;
            params.push(...groups);
        }

        query += ' ORDER BY employee_id';
        const result = db.exec(query, params);
        const emps = toObjects(result);
        console.log(`[DEBUG] GET /employees - Return: ${emps.length} employees`);
        res.json(emps);
    } catch (err) {
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

        // Multi-Entity constraints for Residents
        const isResident = ['Citizen', 'PR'].includes(e.nationality);
        let warning = null;

        if (isResident) {
            if (!e.national_id) {
                return res.status(400).json({ error: 'National ID (NRIC/FIN) is required for Citizens/PRs.' });
            }

            // Count how many entities this resident is already in
            const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ?', [e.national_id]);
            const activeEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;

            if (activeEntitiesCount >= 2) {
                return res.status(400).json({ error: 'This employee has reached the maximum limit of 2 entities for Citizens/PRs.' });
            }

            if (activeEntitiesCount === 1) {
                warning = 'Note: This employee is now assigned to the maximum of 2 entities.';
            }
        }

        db.run(
            `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, gender, language, mobile_number, whatsapp_number, email, highest_education, designation, department, employee_group, employee_grade, date_joined, cessation_date, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, status, payment_mode, custom_allowances, custom_deductions, site_id, working_days_per_week, rest_day, working_hours_per_day, working_hours_per_week) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [entityId, e.employee_id || '', e.full_name || '', e.date_of_birth || null, e.national_id || null, e.nationality || 'Singapore Citizen', e.tax_residency || 'Resident', e.race || 'Chinese', e.gender || '', e.language || '', e.mobile_number || '', e.whatsapp_number || '', e.email || '', e.highest_education || 'Others', e.designation || '', e.department || '', e.employee_group || 'General', e.employee_grade || '', e.date_joined || null, e.cessation_date || null, e.basic_salary || 0, e.transport_allowance || 0, e.meal_allowance || 0, e.other_allowance || 0, e.bank_name || '', e.bank_account || '', e.cpf_applicable !== undefined ? e.cpf_applicable : 1, e.status || 'Active', e.payment_mode || 'Bank Transfer', e.custom_allowances || '{}', e.custom_deductions || '{}', e.site_id || null, e.working_days_per_week || 5.5, e.rest_day || 'Sunday', e.working_hours_per_day || 8, e.working_hours_per_week || 44]
        );
        saveDb();

        // Get the created employee
        const result = db.exec('SELECT * FROM employees WHERE employee_id = ? AND entity_id = ?', [e.employee_id, entityId]);
        const created = toObjects(result)[0];

        // Auto-create KET record
        db.run(
            `INSERT INTO employee_kets (employee_id, job_title, employment_start_date, basic_salary, fixed_allowances, working_days_per_week, rest_day, working_hours_per_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [created.id, e.designation || 'Employee', e.date_joined || new Date().toISOString().split('T')[0], e.basic_salary || 0,
            JSON.stringify({ transport: e.transport_allowance || 0, meal: e.meal_allowance || 0 }),
            e.working_days_per_week || 5.5, e.rest_day || 'Sunday', e.working_hours_per_day || 8]
        );

        // Auto-create leave balances
        const leaveTypes = db.exec('SELECT * FROM leave_types');
        const types = toObjects(leaveTypes);
        const year = new Date().getFullYear();
        types.forEach(lt => {
            db.run(
                `INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, 0, ?)`,
                [created.id, lt.id, year, lt.default_days, lt.default_days]
            );
        });

        saveDb();
        res.status(201).json({ ...created, warning });
    } catch (err) {
        console.error('ERROR IN POST /api/employees:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/employees/:id
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const e = req.body;

        const isResident = ['Citizen', 'PR'].includes(e.nationality);
        let warning = null;
        if (isResident) {
            if (!e.national_id) {
                return res.status(400).json({ error: 'National ID (NRIC/FIN) is required for Citizens/PRs.' });
            }
            // Exclude current entity from the count
            const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ? AND entity_id != ?', [e.national_id, entityId]);
            const otherEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;

            if (otherEntitiesCount >= 2) {
                return res.status(400).json({ error: 'This employee has reached the maximum limit of 2 entities for Citizens/PRs.' });
            }
            if (otherEntitiesCount === 1) {
                warning = 'Note: This employee is assigned to the maximum of 2 entities.';
            }
        }

        db.run(
            `UPDATE employees SET full_name=?, date_of_birth=?, national_id=?, nationality=?, tax_residency=?, race=?, gender=?, language=?, mobile_number=?, whatsapp_number=?, email=?, highest_education=?, designation=?, department=?, employee_group=?, employee_grade=?, date_joined=?, cessation_date=?, basic_salary=?, transport_allowance=?, meal_allowance=?, other_allowance=?, bank_name=?, bank_account=?, cpf_applicable=?, status=?, payment_mode=?, custom_allowances=?, custom_deductions=?, site_id=?, working_days_per_week=?, rest_day=?, working_hours_per_day=?, working_hours_per_week=? WHERE id=? AND entity_id=?`,
            [e.full_name || '', e.date_of_birth || null, e.national_id || null, e.nationality || 'Singapore Citizen', e.tax_residency || 'Resident', e.race || 'Chinese', e.gender || '', e.language || '', e.mobile_number || '', e.whatsapp_number || '', e.email || '', e.highest_education || 'Others', e.designation || '', e.department || '', e.employee_group || 'General', e.employee_grade || '', e.date_joined || null, e.cessation_date || null, e.basic_salary || 0, e.transport_allowance || 0, e.meal_allowance || 0, e.other_allowance || 0, e.bank_name || '', e.bank_account || '', e.cpf_applicable !== undefined ? e.cpf_applicable : 1, e.status || 'Active', e.payment_mode || 'Bank Transfer', e.custom_allowances || '{}', e.custom_deductions || '{}', e.site_id || null, e.working_days_per_week || 5.5, e.rest_day || 'Sunday', e.working_hours_per_day || 8, e.working_hours_per_week || 44, req.params.id, entityId]
        );
        saveDb();

        const result = db.exec('SELECT * FROM employees WHERE id = ?', [req.params.id]);
        res.json({ ...toObjects(result)[0], warning });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/:id/transfer
router.post('/:id/transfer', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const currentEntityId = req.user.entityId;
        const { targetEntityId } = req.body;

        if (!currentEntityId || !targetEntityId) return res.status(400).json({ error: 'Missing entity context' });
        if (currentEntityId === targetEntityId) return res.status(400).json({ error: 'Target entity must be different' });

        db.exec('BEGIN TRANSACTION');

        try {
            // Get original employee
            const empResult = db.exec('SELECT * FROM employees WHERE id = ? AND entity_id = ?', [req.params.id, currentEntityId]);
            if (empResult.length === 0) throw new Error('Employee not found');
            const emp = toObjects(empResult)[0];

            const isResident = ['Citizen', 'PR'].includes(emp.nationality);
            if (isResident) {
                const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ? AND entity_id != ?', [emp.national_id, currentEntityId]);
                const otherEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
                if (otherEntitiesCount >= 2) throw new Error('Citizen/PR employee is already at the 2 entity limit. Cannot transfer directly.');
            } else {
                const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ? AND entity_id != ?', [emp.national_id, currentEntityId]);
                const otherEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
                if (otherEntitiesCount >= 1) throw new Error('Foreigner can only be in one entity. Transfer blocked.');
            }

            // 2. Clone basic profile
            db.run(
                `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, gender, language, mobile_number, whatsapp_number, email, highest_education, designation, department, employee_group, employee_grade, date_joined, cessation_date, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, status, payment_mode, custom_allowances, custom_deductions, site_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [targetEntityId, emp.employee_id || '', emp.full_name || '', emp.date_of_birth || null, emp.national_id || null, emp.nationality || 'Citizen', emp.tax_residency || 'Resident', emp.race || 'Chinese', emp.gender || '', emp.language || '', emp.mobile_number || '', emp.whatsapp_number || '', emp.email || '', emp.highest_education || 'Others', emp.designation || '', emp.department || '', emp.employee_group || 'General', emp.employee_grade || '', emp.date_joined || null, emp.cessation_date || null, emp.basic_salary || 0, emp.transport_allowance || 0, emp.meal_allowance || 0, emp.other_allowance || 0, emp.bank_name || '', emp.bank_account || '', emp.cpf_applicable !== undefined ? emp.cpf_applicable : 1, 'Active', emp.payment_mode || 'Bank Transfer', emp.custom_allowances || '{}', emp.custom_deductions || '{}', emp.site_id || null]
            );

            const newEmpIdResult = db.exec(`SELECT last_insert_rowid() AS id`);
            const newEmpId = newEmpIdResult[0].values[0][0];

            // 3. Clone Leave Balances
            const leaveBalances = db.exec('SELECT * FROM leave_balances WHERE employee_id = ?', [emp.id]);
            const lbRows = toObjects(leaveBalances);
            lbRows.forEach(lb => {
                db.run(`INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, ?, ?)`,
                    [newEmpId, lb.leave_type_id, lb.year, lb.entitled, lb.taken, lb.balance]);
            });

            // 4. Clone KETs
            const kets = db.exec('SELECT * FROM employee_kets WHERE employee_id = ?', [emp.id]);
            if (kets.length > 0) {
                const ket = toObjects(kets)[0];
                db.run(`INSERT INTO employee_kets (
                    employee_id, job_title, employment_start_date, employment_type, contract_duration, 
                    working_hours_per_day, working_days_per_week, rest_day, salary_period, 
                    basic_salary, fixed_allowances, fixed_deductions, overtime_rate, 
                    overtime_payment_period, bonus_structure, annual_leave_days, sick_leave_days, 
                    hospitalization_days, maternity_weeks, paternity_weeks, childcare_days, 
                    medical_benefits, probation_months, notice_period, place_of_work,
                    main_duties, employment_end_date, working_hours_details, break_hours,
                    salary_payment_date, overtime_payment_date, gross_rate_of_pay, 
                    other_salary_components, cpf_payable, probation_start_date, probation_end_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newEmpId, ket.job_title, ket.employment_start_date, ket.employment_type, ket.contract_duration,
                        ket.working_hours_per_day, ket.working_days_per_week, ket.rest_day, ket.salary_period,
                        ket.basic_salary, ket.fixed_allowances, ket.fixed_deductions, ket.overtime_rate,
                        ket.overtime_payment_period, ket.bonus_structure, ket.annual_leave_days, ket.sick_leave_days,
                        ket.hospitalization_days, ket.maternity_weeks, ket.paternity_weeks, ket.childcare_days,
                        ket.medical_benefits, ket.probation_months, ket.notice_period, ket.place_of_work,
                        ket.main_duties, ket.employment_end_date, ket.working_hours_details, ket.break_hours,
                        ket.salary_payment_date, ket.overtime_payment_date, ket.gross_rate_of_pay,
                        ket.other_salary_components, ket.cpf_payable, ket.probation_start_date, ket.probation_end_date
                    ]);
            }

            // 5. Update old record to 'Transferred' so it's technically inactive but retains history
            db.run('UPDATE employees SET status = \'Transferred\' WHERE id = ?', [emp.id]);

            db.exec('COMMIT');
            saveDb();
            res.status(200).json({ message: 'Employee successfully transferred.', newId: newEmpId });

        } catch (err) {
            db.exec('ROLLBACK');
            res.status(400).json({ error: err.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/bulk-custom
router.post('/bulk-custom', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const { records } = req.body;
        if (!Array.isArray(records)) {
            return res.status(400).json({ error: 'Records must be an array' });
        }

        db.exec('BEGIN TRANSACTION');

        try {
            records.forEach(rc => {
                const allowancesStr = JSON.stringify(rc.custom_allowances || {});
                const deductionsStr = JSON.stringify(rc.custom_deductions || {});

                db.run(
                    `UPDATE employees SET custom_allowances = ?, custom_deductions = ? WHERE id = ? AND entity_id = ?`,
                    [allowancesStr, deductionsStr, rc.id, entityId]
                );
            });

            db.exec('COMMIT');
            saveDb();
            res.json({ message: 'Bulk modifiers successfully applied to employees.' });
        } catch (err) {
            db.exec('ROLLBACK');
            res.status(400).json({ error: err.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/bulk-import
router.post('/bulk-import', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const results = {
            processed: 0,
            skipped: 0,
            errors: []
        };

        const leaveTypesResult = db.exec('SELECT * FROM leave_types');
        const leaveTypes = toObjects(leaveTypesResult);
        const currentYear = new Date().getFullYear();

        db.exec('BEGIN TRANSACTION');

        try {
            for (const row of data) {
                // --- Helper: Convert Excel serial date to ISO string ---
                const parseExcelDate = (val) => {
                    if (!val) return null;
                    if (typeof val === 'number') {
                        // Excel serial date: days since 1900-01-01 (with the 1900 leap year bug)
                        const date = new Date((val - 25569) * 86400000);
                        return date.toISOString().split('T')[0];
                    }
                    // Already a string date
                    return String(val);
                };

                // --- Helper: Normalize nationality ---
                const normalizeNationality = (val) => {
                    if (!val) return 'Citizen';
                    const upper = String(val).toUpperCase().trim();
                    if (['SINGAPOREAN', 'SINGAPORE CITIZEN', 'SC', 'CITIZEN'].includes(upper)) return 'Citizen';
                    if (['SPR', 'PR', 'SINGAPORE PR', 'PERMANENT RESIDENT'].includes(upper)) return 'PR';
                    return 'Foreigner';
                };

                // --- Helper: Normalize gender ---
                const normalizeGender = (val) => {
                    if (!val) return '';
                    const upper = String(val).toUpperCase().trim();
                    if (upper === 'MALE' || upper === 'M') return 'Male';
                    if (upper === 'FEMALE' || upper === 'F') return 'Female';
                    return String(val);
                };

                // Map common Excel header variations to database fields
                const e = {
                    employee_id: String(row['Employee ID'] || row['Employee No'] || row['ID'] || ''),
                    full_name: row['Full Name'] || row['Name'] || '',
                    national_id: row['National ID'] || row['NRIC/FIN'] || '',
                    nationality: normalizeNationality(row['Nationality']),
                    gender: normalizeGender(row['Gender']),
                    date_of_birth: parseExcelDate(row['Date of Birth'] || row['DOB']),
                    date_joined: parseExcelDate(row['Date Joined'] || row['Joining Date']),
                    designation: row['Designation'] || row['DESIGNATION'] || row['Job Title'] || '',
                    employee_group: row['Group'] || row['GROUP ID'] || row['Employee Group'] || 'General',
                    basic_salary: parseFloat(row['Basic Salary'] || 0),
                    email: row['Email'] || '',
                    mobile_number: String(row['Mobile'] || row['Phone'] || ''),
                    bank_name: row['Bank Name'] || '',
                    bank_account: String(row['Bank Account'] || ''),
                    // Future: row['Department'] || row['DEPT'] could map to a department field
                };

                if (!e.full_name || !e.employee_id) {
                    results.skipped++;
                    results.errors.push(`Row missing Name or ID: ${JSON.stringify(row)}`);
                    continue;
                }

                // Check constraints
                const isResident = ['Citizen', 'PR'].includes(e.nationality);
                if (isResident) {
                    if (!e.national_id) {
                        results.errors.push(`Skipped ${e.full_name}: National ID required for Citizen/PR`);
                        results.skipped++;
                        continue;
                    }
                    const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ?', [e.national_id]);
                    const activeEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
                    if (activeEntitiesCount >= 2) {
                        results.errors.push(`Skipped ${e.full_name}: Already in 2 entities`);
                        results.skipped++;
                        continue;
                    }
                } else if (e.nationality === 'Foreigner') {
                    if (!e.national_id) {
                        results.errors.push(`Skipped ${e.full_name}: FIN required for Foreigner`);
                        results.skipped++;
                        continue;
                    }
                    const countCheck = db.exec('SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = ?', [e.national_id]);
                    const activeEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
                    if (activeEntitiesCount >= 1) {
                        results.errors.push(`Skipped ${e.full_name}: Foreigner already in another entity`);
                        results.skipped++;
                        continue;
                    }
                }

                // Check if already in THIS entity
                const dupCheck = db.exec('SELECT id FROM employees WHERE employee_id = ? AND entity_id = ?', [e.employee_id, entityId]);
                if (dupCheck.length > 0) {
                    results.errors.push(`Skipped ${e.full_name}: Employee ID ${e.employee_id} already exists in this entity`);
                    results.skipped++;
                    continue;
                }

                // Insert Employee
                db.run(
                    `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, gender, designation, employee_group, date_joined, basic_salary, email, mobile_number, bank_name, bank_account, status, cpf_applicable) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
                    [entityId, e.employee_id, e.full_name, e.date_of_birth, e.national_id, e.nationality, e.gender, e.designation, e.employee_group, e.date_joined, e.basic_salary, e.email, e.mobile_number, e.bank_name, e.bank_account, isResident ? 1 : 0]
                );

                const empIdResult = db.exec('SELECT last_insert_rowid() AS id');
                const empId = empIdResult[0].values[0][0];

                // Auto-create KET
                db.run(
                    `INSERT INTO employee_kets (employee_id, job_title, employment_start_date, basic_salary, fixed_allowances, cpf_payable) VALUES (?, ?, ?, ?, ?, ?)`,
                    [empId, e.designation || 'Employee', e.date_joined || new Date().toISOString().split('T')[0], e.basic_salary || 0, '{}', isResident ? 1 : 0]
                );

                // Auto-create Leave Balances
                leaveTypes.forEach(lt => {
                    db.run(
                        `INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, 0, ?)`,
                        [empId, lt.id, currentYear, lt.default_days, lt.default_days]
                    );
                });

                results.processed++;
            }

            db.exec('COMMIT');
            saveDb();
            res.json({ message: 'Bulk import completed', ...results });
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }
    } catch (err) {
        console.error('Bulk Import Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
