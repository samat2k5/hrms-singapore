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

function getWorkingDaysInMonth(year, month, restDayName, holidays) {
    const lastDay = new Date(year, month, 0).getDate();
    let workingDays = 0;

    // Map rest day name to day index (0=Sunday, 1=Monday, ...)
    const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const restDayIdx = dayMap[restDayName] !== undefined ? dayMap[restDayName] : 0;

    const holidayStrings = holidays.map(h => h.date);

    for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (dayOfWeek === restDayIdx) continue;
        if (holidayStrings.includes(dateStr)) continue;

        workingDays++;
    }
    return workingDays;
}

// GET /api/payroll/runs — List all payroll runs
router.get('/runs', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const query = 'SELECT * FROM payroll_runs WHERE entity_id = ? ORDER BY period_year DESC, period_month DESC';
        const result = db.exec(query, [entityId]);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payroll/run — Process payroll for a period
router.post('/run', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const { year, month, employee_group, payment_date } = req.body;

        if (!year || !month || !employee_group) {
            return res.status(400).json({ error: 'Year, month, and employee_group are required' });
        }

        // Check for existing run
        const existing = db.exec(
            'SELECT id FROM payroll_runs WHERE entity_id = ? AND period_year = ? AND period_month = ? AND employee_group = ?',
            [entityId, year, month, employee_group]
        );
        if (toObjects(existing).length) {
            return res.status(400).json({ error: `Payroll already processed for ${employee_group} in ${month}/${year}` });
        }

        // Get active employees
        const empResult = db.exec('SELECT * FROM employees WHERE entity_id = ? AND status = \'Active\' AND employee_group = ?', [entityId, employee_group]);
        const employees = toObjects(empResult);

        if (!employees.length) {
            console.warn(`[PAYROLL_RUN] No active employees found for Entity: ${entityId}, Group: ${employee_group}`);
            return res.status(400).json({ error: `No active employees found in group "${employee_group}" for this entity.` });
        }

        // Fetch Public Holidays for this month
        const holidayResult = db.exec(
            'SELECT date FROM holidays WHERE entity_id = ? AND strftime(\'%Y\', date) = ? AND strftime(\'%m\', date) = ?',
            [entityId, String(year), String(month).padStart(2, '0')]
        );
        const holidays = toObjects(holidayResult);

        // Fetch master shift settings for this entity (used for OT rate calculation)
        const shiftSettingsResult = db.exec(
            'SELECT * FROM shift_settings WHERE entity_id = ?',
            [entityId]
        );
        const shiftSettingsList = toObjects(shiftSettingsResult);
        // Build a map: shift_name (lowercase) -> settings
        const shiftSettingsMap = {};
        shiftSettingsList.forEach(ss => {
            shiftSettingsMap[ss.shift_name.toLowerCase()] = ss;
        });

        // Create payroll run
        const runDate = new Date().toISOString().split('T')[0];
        db.run(
            `INSERT INTO payroll_runs (entity_id, employee_group, period_year, period_month, run_date, payment_date, status) VALUES (?, ?, ?, ?, ?, ?, 'Draft')`,
            [entityId, employee_group, year, month, runDate, payment_date || null]
        );

        const runResult = db.exec(`SELECT last_insert_rowid() as id`);
        if (!runResult.length || !runResult[0].values.length) {
            throw new Error("Failed to retrieve the ID of the new payroll run.");
        }
        const runId = runResult[0].values[0][0];
        console.log(`[PAYROLL_RUN] Created Run ID: ${runId} for Group: ${employee_group}`);

        // Fetch entity-level performance multiplier
        const entityResult = db.exec('SELECT performance_multiplier FROM entities WHERE id = ?', [entityId]);
        const entityPerfMultiplier = toObjects(entityResult)[0]?.performance_multiplier || 0;

        let totalGross = 0, totalCPFEmployee = 0, totalCPFEmployer = 0, totalSDL = 0, totalSHG = 0, totalNet = 0;

        // Process each employee
        for (const emp of employees) {
            // Get unpaid leave days for this month from leave requests
            const leaveResult = db.exec(
                'SELECT COALESCE(SUM(lr.days), 0) as unpaid_days FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id WHERE lr.employee_id = ? AND lr.status = \'Approved\' AND lt.name = \'Unpaid Leave\' AND strftime(\'%Y\', lr.start_date) = ? AND strftime(\'%m\', lr.start_date) = ?',
                [emp.id, String(year), String(month).padStart(2, '0')]
            );

            // Also get absences recorded via Attendance Import (remarks suggesting leave/absence)
            const attendanceAbsenceResult = db.exec(
                'SELECT COUNT(*) as absence_days FROM attendance_remarks WHERE employee_id = ? AND (remark_type = \'Leave/Notice\' OR description LIKE \'%LEAVE%\' OR description LIKE \'%ABSENT%\') AND strftime(\'%Y\', date) = ? AND strftime(\'%m\', date) = ?',
                [emp.id, String(year), String(month).padStart(2, '0')]
            );

            const approvedUnpaidDays = toObjects(leaveResult)[0]?.unpaid_days || 0;
            const siteReportedAbsenceDays = toObjects(attendanceAbsenceResult)[0]?.absence_days || 0;
            const unpaidDays = approvedUnpaidDays + siteReportedAbsenceDays;

            // Get OT hours and Penalties for this month from timesheets
            const otResult = db.exec(
                `SELECT 
                    SUM(ot_hours) as total_ot, 
                    SUM(ot_1_5_hours) as total_ot_1_5, 
                    SUM(ot_2_0_hours) as total_ot_2_0,
                    SUM(late_mins) as total_late,
                    SUM(early_out_mins) as total_early_out,
                    SUM(performance_credit) as total_perf_credit
                FROM timesheets 
                WHERE employee_id = ? 
                AND date LIKE ?`,
                [emp.id, `${year}-${String(month).padStart(2, '0')}-%`]
            );
            const otData = toObjects(otResult)[0];
            const totalOtHours = otData.total_ot || 0;
            const ot15Hours = otData.total_ot_1_5 || 0;
            const ot20Hours = otData.total_ot_2_0 || 0;
            // Standard (unclassified) OT = total minus already-categorised hours.
            // Prevents double-counting when ot_hours stores the grand total inclusive of 1.5x/2.0x.
            const otHours = Math.max(0, totalOtHours - ot15Hours - ot20Hours);
            const lateMins = otData.total_late || 0;
            const earlyOutMins = otData.total_early_out || 0;
            const perfCredits = otData.total_perf_credit || 0;

            console.log(`[Payroll Debug] Emp: ${emp.full_name}, Month: ${year}-${month}, OT1.5: ${ot15Hours}, OT2.0: ${ot20Hours}, Perf: ${perfCredits}`);

            // MOM Overtime Rate: (12 * basic) / (52 * weekly_hours) * 1.5
            // MUST use CONTRACTUAL weekly hours from KET — NOT shift actual hours.
            // Ref: MOM Employment Act, Section 38 & Seventh Schedule.
            let contractualWeeklyHours = emp.working_hours_per_week || 44;
            const hoursPerDay = emp.working_hours_per_day || 8;

            let daysPerWeek = 5.5;
            const rawDays = emp.working_days_per_week;
            if (typeof rawDays === 'string') {
                daysPerWeek = parseFloat(rawDays.split(' ')[0]) || 5.5;
            } else if (typeof rawDays === 'number') {
                daysPerWeek = rawDays;
            }

            // If contractual weekly hours not explicitly set, derive from KET days × hours
            if (!emp.working_hours_per_week && hoursPerDay && daysPerWeek) {
                contractualWeeklyHours = hoursPerDay * daysPerWeek;
            }

            // Determine the employee's primary shift for attendance/deduction context only
            const primaryShiftResult = db.exec(
                `SELECT shift, COUNT(*) as cnt FROM timesheets 
                 WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ? 
                 AND shift IS NOT NULL AND shift != ''
                 GROUP BY shift ORDER BY cnt DESC LIMIT 1`,
                [emp.id, String(year), String(month).padStart(2, '0')]
            );
            const primaryShiftData = toObjects(primaryShiftResult)[0];
            const primaryShiftName = (primaryShiftData?.shift || 'day').toLowerCase();

            // Shift hours used ONLY for attendance deduction calculation (not OT rate)
            const shiftConfig = shiftSettingsMap[primaryShiftName];
            let shiftHoursPerDay = hoursPerDay;
            if (shiftConfig) {
                const [sh, sm] = (shiftConfig.start_time || '08:00').split(':').map(Number);
                const [eh, em] = (shiftConfig.end_time || '17:00').split(':').map(Number);
                const lunchMins = shiftConfig.lunch_break_mins || 0;
                const dinnerMins = shiftConfig.dinner_break_mins || 0;
                const midnightMins = shiftConfig.midnight_break_mins || 0;
                const totalBreakMins = lunchMins + dinnerMins + midnightMins;
                let rawMins = (eh * 60 + em) - (sh * 60 + sm);
                if (rawMins <= 0) rawMins += 24 * 60;
                shiftHoursPerDay = Math.round(((rawMins - totalBreakMins) / 60) * 100) / 100;
                if (shiftHoursPerDay <= 0) shiftHoursPerDay = 8;
            }

            const restDay = emp.rest_day || 'Sunday';
            const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
            const restDayIdx = dayMap[restDay] !== undefined ? dayMap[restDay] : 0;

            const totalWorkingDaysInMonth = getWorkingDaysInMonth(year, month, restDay, holidays);

            // Audit: Check for 72-hour OT Limit
            const totalOtHoursInLimits = ot15Hours + ot20Hours + otHours;
            const otLimitWarning = totalOtHoursInLimits > 72 ? `WARNING: ${emp.full_name} exceed 72h OT limit (${totalOtHoursInLimits.toFixed(1)}h)` : null;
            if (otLimitWarning) console.warn(otLimitWarning);

            // 1. Detect Public Holidays in this month
            const holidayDates = holidays.map(h => h.date);
            let phWorkedDays = 0;
            let phOffDaysToCredit = 0;

            for (const hDate of holidayDates) {
                const dateObj = new Date(hDate);
                const dayOfWeek = dateObj.getDay();

                // Check if employee worked on this PH (any timesheet entry on this date)
                const workedOnPHResult = db.exec(
                    'SELECT id FROM timesheets WHERE employee_id = ? AND date = ?',
                    [emp.id, hDate]
                );
                if (toObjects(workedOnPHResult).length > 0) {
                    phWorkedDays++;
                }

                // Check if PH falls on rest day
                if (dayOfWeek === restDayIdx) {
                    phOffDaysToCredit++;
                }
            }

            // 2. Implement "Leave Credit" for PH on Off-Day (MOM Section 42(3))
            if (phOffDaysToCredit > 0) {
                // Increment Annual Leave balance (Leave Type ID for Annual Leave usually is 1 or name 'Annual Leave')
                db.run(
                    'UPDATE leave_balances SET entitled = entitled + ? WHERE employee_id = ? AND leave_type_id = (SELECT id FROM leave_types WHERE name = \'Annual Leave\' LIMIT 1)',
                    [phOffDaysToCredit, emp.id]
                );
            }

            let overtimeRate = 0;
            if (emp.basic_salary && emp.basic_salary > 0) {
                // MOM-compliant OT hourly base rate uses CONTRACTUAL weekly hours (from KET).
                const hourlyRate = (12 * emp.basic_salary) / (52 * contractualWeeklyHours);
                overtimeRate = hourlyRate * 1.5; // stored as the 1.5x base; engine divides to get 1.0x for 2.0x calc
            }

            const payslip = processEmployeePayroll(emp, {
                unpaidLeaveDays: unpaidDays,
                totalWorkingDaysInMonth: totalWorkingDaysInMonth,
                phWorkedDays: phWorkedDays,
                phOffDaysPaid: 0,
                lateMins: lateMins,
                earlyOutMins: earlyOutMins,
                overtimeHours: otHours,
                ot15Hours: ot15Hours,
                ot20Hours: ot20Hours,
                overtimeRate: overtimeRate,
                momHourlyRate: overtimeRate / 1.5,
                otherDeductions: emp.other_deduction || 0,
                performanceCredits: perfCredits,
                performanceMultiplier: entityPerfMultiplier,
                year: year
            });

            // Insert payslip (including the new PH and Penalty fields)
            db.run(
                `INSERT INTO payslips (
                    payroll_run_id, employee_id, employee_name, employee_code, basic_salary, 
                    transport_allowance, meal_allowance, other_allowance, custom_allowances, 
                    custom_deductions, payment_mode, total_allowances, overtime_hours, 
                    ot_1_5_hours, ot_2_0_hours, overtime_pay, ot_1_5_pay, ot_2_0_pay, 
                    ph_worked_pay, ph_off_day_pay, bonus, gross_pay, cpf_employee, 
                    cpf_employer, cpf_oa, cpf_sa, cpf_ma, sdl, shg_deduction, shg_fund, 
                    other_deductions, unpaid_leave_days, unpaid_leave_deduction, 
                    late_mins, early_out_mins, attendance_deduction, performance_allowance, net_pay, compliance_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    runId, payslip.employee_id, payslip.employee_name, payslip.employee_code,
                    payslip.basic_salary, payslip.transport_allowance, payslip.meal_allowance,
                    payslip.other_allowance, payslip.custom_allowances, payslip.custom_deductions,
                    payslip.payment_mode, payslip.total_allowances, payslip.overtime_hours,
                    payslip.ot_1_5_hours, payslip.ot_2_0_hours, payslip.overtime_pay,
                    payslip.ot_1_5_pay, payslip.ot_2_0_pay, payslip.ph_worked_extra_pay,
                    payslip.ph_off_day_extra_pay, payslip.bonus, payslip.gross_pay,
                    payslip.cpf_employee, payslip.cpf_employer, payslip.cpf_oa, payslip.cpf_sa,
                    payslip.cpf_ma, payslip.sdl, payslip.shg_deduction, payslip.shg_fund,
                    payslip.other_deductions, payslip.unpaid_leave_days, payslip.unpaid_leave_deduction,
                    payslip.late_mins, payslip.early_out_mins, payslip.attendance_deduction,
                    payslip.performance_allowance, payslip.net_pay, payslip.compliance_notes
                ]
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
        const finalRun = toObjects(db.exec('SELECT * FROM payroll_runs WHERE id = ?', [runId]))[0];
        const payslips = toObjects(db.exec('SELECT * FROM payslips WHERE payroll_run_id = ?', [runId]));

        res.status(201).json({ run: finalRun, payslips });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payroll/run/:id — Get payroll run details with payslips
router.get('/run/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const runResult = db.exec('SELECT * FROM payroll_runs WHERE id = ? AND entity_id = ?', [req.params.id, entityId]);
        const run = toObjects(runResult)[0];
        if (!run) return res.status(404).json({ error: 'Payroll run not found or access denied' });

        const payslips = toObjects(db.exec('SELECT * FROM payslips WHERE payroll_run_id = ?', [req.params.id]));
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
            SELECT p.*, pr.period_year, pr.period_month, pr.run_date, pr.payment_date, be.name as entity_name, be.logo_url,
                   e.email, e.whatsapp_number, e.mobile_number
            FROM payslips p 
            JOIN payroll_runs pr ON p.payroll_run_id = pr.id 
            JOIN employees e ON p.employee_id = e.id
            JOIN entities be ON e.entity_id = be.id
            WHERE p.id = ? AND e.entity_id = ?
        `, [req.params.id, req.user.entityId]);
        const payslips = toObjects(result);
        if (!payslips.length) return res.status(404).json({ error: 'Payslip not found' });

        const payslip = payslips[0];

        // Fetch detailed timesheets for this employee/month
        const timesheetsResult = db.exec(`
            SELECT * FROM timesheets
            WHERE employee_id = ${payslip.employee_id}
            AND strftime('%Y', date) = '${payslip.period_year}' 
            AND strftime('%m', date) = '${String(payslip.period_month).padStart(2, '0')}'
            ORDER BY date ASC
        `);
        payslip.timesheets = toObjects(timesheetsResult);

        res.json(payslip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/payroll/run/:id — Delete a payroll run
router.delete('/run/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        console.log(`[PAYROLL_DELETE] Attempting to delete run ${id} for entity ${entityId}`);

        // Ensure the run belongs to the active entity
        const runRes = db.exec('SELECT id FROM payroll_runs WHERE id = ? AND entity_id = ?', [id, entityId]);
        if (!runRes.length || !runRes[0].values.length) {
            console.warn(`[PAYROLL_DELETE] Run ${id} not found or access denied for entity ${entityId}`);
            return res.status(404).json({ error: 'Payroll run not found or access denied' });
        }

        db.exec('BEGIN TRANSACTION');
        try {
            db.run(`DELETE FROM payslips WHERE payroll_run_id = ?`, [id]);
            db.run(`DELETE FROM payroll_runs WHERE id = ?`, [id]);
            db.exec('COMMIT');
            saveDb();
            console.log(`[PAYROLL_DELETE] Successfully deleted run ${id}`);
            res.json({ message: 'Payroll run deleted successfully' });
        } catch (err) {
            db.exec('ROLLBACK');
            console.error(`[PAYROLL_DELETE_ERROR] Transaction failed for run ${id}:`, err);
            res.status(500).json({ error: 'Failed to delete payroll run: ' + err.message });
        }
    } catch (err) {
        console.error(`[PAYROLL_DELETE_ERROR] Outer catch for run ${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

const { generateGIROFile } = require('../engine/giro-engine');

// GET /api/payroll/export-giro/:runId
router.get('/export-giro/:runId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const runId = req.params.runId;
        const format = req.query.format || 'DBS';
        const entityId = req.user.entityId;

        const runResult = db.exec(`SELECT * FROM payroll_runs WHERE id = ? AND entity_id = ?`, [runId, entityId]);
        if (!runResult.length || !runResult[0].values.length) return res.status(404).json({ error: 'Run not found or access denied' });
        const run = toObjects(runResult)[0];

        const slipsResult = db.exec(`
            SELECT p.*, e.bank_name, e.bank_account, e.employee_id as emp_code
            FROM payslips p 
            JOIN employees e ON p.employee_id = e.id 
            WHERE p.payroll_run_id = ?
        `, [runId]);
        const slips = toObjects(slipsResult);

        const { content, extension, type } = generateGIROFile(format, run, slips);

        res.setHeader('Content-Type', type);
        res.setHeader('Content-Disposition', `attachment; filename="GIRO_${format}_${run.employee_group}_${run.period_year}_${run.period_month}.${extension}"`);
        res.status(200).end(content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payroll/export-cpf/:runId
router.get('/export-cpf/:runId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const runId = req.params.runId;
        const entityId = req.user.entityId;

        const runResult = db.exec(`SELECT * FROM payroll_runs WHERE id = ? AND entity_id = ?`, [runId, entityId]);
        if (!runResult.length || !runResult[0].values.length) return res.status(404).json({ error: 'Run not found or access denied' });
        const run = toObjects(runResult)[0];

        const slipsResult = db.exec(`
            SELECT p.*, e.employee_id as emp_code
            FROM payslips p 
            JOIN employees e ON p.employee_id = e.id 
            WHERE p.payroll_run_id = ? AND (p.cpf_employee > 0 OR p.cpf_employer > 0)
        `, [runId]);
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

module.exports = router;

