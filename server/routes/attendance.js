const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/temp/' });

// Utility to convert sql.js results to objects
const toObjects = (result) => {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
};

router.post('/import', authMiddleware, upload.any(), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const dryRun = req.body.dryRun === 'true';

    try {
        const db = await getDb();
        const userId = req.user.id;

        // 1. Fetch authorized entities
        const authSql = `
            SELECT uer.entity_id, uer.role, ur.permissions
            FROM user_entity_roles uer
            JOIN user_roles ur ON uer.role = ur.name
            WHERE uer.user_id = ?
        `;
        const authResult = db.exec(authSql, [userId]);
        const authorizations = toObjects(authResult);

        if (!authorizations.length) {
            return res.status(403).json({ error: 'User is not authorized for any entities.' });
        }

        const authorizedEntityIds = authorizations.map(a => a.entity_id);
        const hasCrossEntityPermission = authorizations.some(a => {
            if (a.role === 'Admin') return true; // Admins always have cross-entity permission
            try {
                const perms = JSON.parse(a.permissions);
                return perms.includes('attendance:import:cross-entity');
            } catch (e) { return false; }
        });

        let activeEntityIds = authorizedEntityIds;
        if (!hasCrossEntityPermission) {
            const contextEntityId = req.user.entityId;
            if (!contextEntityId) return res.status(400).json({ error: 'Missing entity context and no cross-entity permission.' });
            activeEntityIds = [contextEntityId];
        }

        const placeholders = activeEntityIds.map(() => '?').join(',');

        // 2. Cache lookups
        const employeeResult = db.exec(`SELECT id, employee_id, site_id, entity_id FROM employees WHERE entity_id IN (${placeholders})`, activeEntityIds);
        const employeeMap = {};
        toObjects(employeeResult).forEach(emp => {
            employeeMap[emp.employee_id] = { id: emp.id, site_id: emp.site_id, entity_id: emp.entity_id };
        });

        const siteHoursResult = db.exec(`
            SELECT h.* FROM site_working_hours h
            JOIN sites s ON h.site_id = s.id
            JOIN customers c ON s.customer_id = c.id
            WHERE c.entity_id IN (${placeholders})
        `, activeEntityIds);
        const hoursMap = {};
        toObjects(siteHoursResult).forEach(h => {
            hoursMap[`${h.site_id}_${h.day_of_week}_${h.shift_type}`] = h;
        });

        const globalShiftsResult = db.exec(`SELECT * FROM shift_settings WHERE entity_id IN (${placeholders})`, activeEntityIds);
        const globalShiftsMap = {};
        toObjects(globalShiftsResult).forEach(gs => {
            globalShiftsMap[`${gs.entity_id}_${gs.shift_name}`] = gs;
        });

        const results = {
            processed: 0,
            skipped: 0,
            errors: [],
            filesProcessed: 0
        };

        console.log(`[Import] User: ${userId}, Entities: ${activeEntityIds}, Files: ${req.files.length}, DryRun: ${dryRun}`);

        if (!dryRun) db.exec("BEGIN TRANSACTION");

        for (const file of req.files) {
            const workbook = XLSX.readFile(file.path);
            results.filesProcessed++;

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                let reportDate = null;
                let dayOfWeek = 1;
                for (let i = 0; i < Math.min(10, data.length); i++) {
                    const row = data[i];
                    if (!row) continue;
                    // Flexible date marker search
                    const dateMarkerIdx = row.findIndex(cell => cell && String(cell).toLowerCase().includes('day & date'));
                    if (dateMarkerIdx !== -1 && row[dateMarkerIdx + 1]) {
                        const rawValue = row[dateMarkerIdx + 1];
                        if (typeof rawValue === 'number') {
                            // Excel serial date (Number of days since 1899-12-30)
                            const date = new Date((rawValue - 25569) * 86400 * 1000);
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            reportDate = `${y}-${m}-${d}`;
                            dayOfWeek = date.getDay();
                        } else {
                            // Support DD-MM-YYYY or DD/MM/YYYY, possibly with trailing text (e.g. 11/01/2025 SUNDAY)
                            const dateMatch = String(rawValue).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
                            if (dateMatch) {
                                const d = dateMatch[1].padStart(2, '0');
                                const m = dateMatch[2].padStart(2, '0');
                                const y = dateMatch[3];
                                reportDate = `${y}-${m}-${d}`;
                                dayOfWeek = new Date(reportDate).getDay();
                            } else {
                                results.errors.push(`${file.originalname} [${sheetName}]: Date value '${rawValue}' did not match format (e.g., 01-01-2026, 01/01/2026 or 46023).`);
                            }
                        }
                        break;
                    }
                }

                if (!reportDate) {
                    // Only log error if the sheet isn't obviously empty (to avoid noise)
                    if (data.length > 5) {
                        results.errors.push(`${file.originalname} [${sheetName}]: Could not identify report date markers.`);
                    }
                    return;
                }

                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(20, data.length); i++) {
                    if (data[i] && data[i].some(cell => cell && String(cell).toLowerCase().includes('emp.no'))) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    results.errors.push(`${file.originalname} [${sheetName}]: Could not find 'Emp.No' header.`);
                    return;
                }

                const header = data[headerRowIdx].map(h => String(h || '').toLowerCase().trim());
                const empNoIdx = header.findIndex(h => h.includes('emp.no'));
                const inIdx = header.findIndex(h => h === 'in');
                const outIdx = header.findIndex(h => h === 'out');
                const shiftIdx = header.findIndex(h => h.includes('shift'));
                const remarksIdx = header.findIndex(h => h.includes('remarks'));
                const perfCreditIdx = header.findIndex(h => h.includes('performance credit') || h.includes('perf credit') || h.includes('perfcredit'));

                // Fetch holidays for this entity once per sheet if needed
                let holidaysInSheet = [];
                try {
                    const hRes = db.exec(`SELECT date FROM holidays WHERE entity_id = ?`, [req.user.entityId]);
                    holidaysInSheet = toObjects(hRes).map(h => h.date);
                } catch (e) { console.error("Holiday fetch error:", e); }

                for (let i = headerRowIdx + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length === 0) continue;
                    const rawEmpId = row[empNoIdx];
                    if (!rawEmpId) continue;

                    const empIdStr = String(rawEmpId).trim();
                    const empData = employeeMap[empIdStr];

                    if (!empData) {
                        results.skipped++;
                        // Avoid flooding if many employees skipped, but log first few
                        if (results.errors.length < 100) {
                            // Only report as error if it looks like a real ID
                            if (empIdStr.length > 1 && empIdStr !== 'Emp.No') {
                                results.errors.push(`${file.originalname} [${sheetName}]: Employee ID '${empIdStr}' not found or unauthorized.`);
                            }
                        }
                        continue;
                    }

                    if (dryRun) {
                        results.processed++;
                        continue;
                    }

                    // Save logic ... (rest of the existing logic)
                    const internalEmpId = empData.id;
                    const empSiteId = empData.site_id;
                    const rowEntityId = empData.entity_id;
                    const inTime = row[inIdx];
                    const outTime = row[outIdx];
                    const shift = String(row[shiftIdx] || '').toUpperCase().includes('N') ? 'Night' : 'Day';
                    const remarks = remarksIdx !== -1 ? String(row[remarksIdx] || '') : '';
                    const perfCredit = perfCreditIdx !== -1 ? parseFloat(row[perfCreditIdx]) || 0 : 0;

                    let otHours = 0, ot15Hours = 0, ot20Hours = 0, normalHours = 0, lateMins = 0, earlyOutMins = 0, phHours = 0;

                    // Improved Excel Time Parsing
                    const parseExcelTime = (val) => {
                        if (!val) return null;
                        if (typeof val === 'number') {
                            // If it's a decimal < 1, it's likely an Excel Time value (0.333 = 08:00)
                            if (val < 1) {
                                let totalMins = Math.round(val * 24 * 60);
                                let h = Math.floor(totalMins / 60);
                                let m = totalMins % 60;
                                return h * 100 + m;
                            }
                            return val; // Assume it's already HHmm
                        }
                        return parseInt(String(val).replace(':', '')) || null;
                    };

                    let inTimeInt = parseExcelTime(inTime), outTimeInt = parseExcelTime(outTime);

                    let config = empSiteId ? hoursMap[`${empSiteId}_${dayOfWeek}_${shift}`] : null;

                    // 1st Fallback: Master Shift Settings for the Entity
                    if (!config) {
                        config = globalShiftsMap[`${rowEntityId}_${shift}`];
                    }

                    // 2nd Fallback: Hardcoded Standard Shifts (failsafe if Master Shifts not configured yet)
                    if (!config) {
                        config = {
                            start_time: shift === 'Night' ? '20:00' : '08:00',
                            end_time: shift === 'Night' ? '05:00' : '17:00',
                            ot_start_time: shift === 'Night' ? '05:30' : '17:30',
                            compulsory_ot_hours: 0,
                            late_arrival_threshold_mins: 15,
                            early_departure_threshold_mins: 15,
                            late_arrival_penalty_block_mins: 0,
                            early_departure_penalty_block_mins: 0
                        };
                    }

                    if (config) {
                        let otStartBoundary = 1730, shiftStartBoundary = 800, shiftEndBoundary = 1700;
                        if (config.ot_start_time) otStartBoundary = parseInt(config.ot_start_time.replace(':', ''));
                        if (config.start_time) shiftStartBoundary = parseInt(config.start_time.replace(':', ''));
                        if (config.end_time) shiftEndBoundary = parseInt(config.end_time.replace(':', ''));

                        const lateThreshold = parseInt(config.late_arrival_threshold_mins || 0);
                        const earlyThreshold = parseInt(config.early_departure_threshold_mins || 0);
                        const lateBlock = parseInt(config.late_arrival_penalty_block_mins || 0);
                        const earlyBlock = parseInt(config.early_departure_penalty_block_mins || 0);

                        const timeToMins = (t) => Math.floor(t / 100) * 60 + (t % 100);
                        let shiftStartMins = timeToMins(shiftStartBoundary);
                        let shiftEndMins = timeToMins(shiftEndBoundary);
                        let otStartMins = timeToMins(otStartBoundary);

                        // Night shift crossing midnight logic
                        if (shiftEndMins <= shiftStartMins) shiftEndMins += 1440;
                        if (otStartMins <= shiftStartMins) otStartMins += 1440;

                        // Basic attendance
                        if (inTimeInt && outTimeInt) {
                            let inMins = timeToMins(inTimeInt);
                            let outMins = timeToMins(outTimeInt);

                            if (outMins < shiftStartMins && inMins >= 1200) outMins += 1440;

                            const totalWorkedMins = outMins - inMins;
                            const workedDurationHours = Math.max(0, (totalWorkedMins / 60) - 1); // 1h lunch

                            if (dayOfWeek === 0) {
                                // Sunday: All 2.0x OT
                                normalHours = 0;
                                ot20Hours = workedDurationHours;
                                ot15Hours = 0;
                                otHours = ot20Hours;
                            } else if (dayOfWeek === 6) {
                                // Saturday: First 4h are Normal (Basic), rest are 1.5x OT
                                normalHours = Math.min(4, workedDurationHours);
                                ot15Hours = Math.max(0, workedDurationHours - 4);
                                ot20Hours = 0;
                                otHours = ot15Hours;
                            } else if (holidaysInSheet.includes(reportDate)) {
                                // Public Holiday: 8h Normal, rest 2.0x OT
                                normalHours = Math.min(8, workedDurationHours);
                                phHours = normalHours;
                                ot20Hours = Math.max(0, workedDurationHours - 8);
                                ot15Hours = 0;
                                otHours = ot20Hours;
                            } else {
                                // Weekday: 8h Normal, rest 1.5x OT
                                normalHours = Math.min(8, workedDurationHours);
                                ot15Hours = Math.max(0, workedDurationHours - 8);
                                ot20Hours = 0;
                                otHours = ot15Hours;
                            }

                            // Late arrival calculation
                            const lateDiff = inMins - shiftStartMins;
                            if (lateDiff > lateThreshold) {
                                lateMins = lateBlock > 0 ? Math.ceil(lateDiff / lateBlock) * lateBlock : lateDiff;
                            }

                            // Early departure calculation
                            const earlyDiff = shiftEndMins - outMins;
                            if (earlyDiff > earlyThreshold) {
                                earlyOutMins = earlyBlock > 0 ? Math.ceil(earlyDiff / earlyBlock) * earlyBlock : earlyDiff;
                            }
                        }
                    }

                    try {
                        db.run(`
                            INSERT INTO timesheets (entity_id, employee_id, date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, normal_hours, ph_hours, late_mins, early_out_mins, performance_credit, remarks, source_file)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                            in_time = excluded.in_time, out_time = excluded.out_time, shift = excluded.shift, ot_hours = excluded.ot_hours,
                            ot_1_5_hours = excluded.ot_1_5_hours, ot_2_0_hours = excluded.ot_2_0_hours, normal_hours = excluded.normal_hours, 
                            ph_hours = excluded.ph_hours, late_mins = excluded.late_mins,
                            early_out_mins = excluded.early_out_mins, performance_credit = excluded.performance_credit, remarks = excluded.remarks, source_file = excluded.source_file
                        `, [rowEntityId, internalEmpId, reportDate, String(inTimeInt || ''), String(outTimeInt || ''), shift, otHours, ot15Hours, ot20Hours, normalHours, phHours, lateMins, earlyOutMins, perfCredit, remarks, file.originalname]);

                        if (remarks.toUpperCase().includes('LEAVE') || remarks.toUpperCase().includes('M/C')) {
                            db.run(`
                                INSERT INTO attendance_remarks(entity_id, employee_id, date, remark_type, description)
                        VALUES(?, ?, ?, ?, ?)
                                ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                        remark_type = excluded.remark_type, description = excluded.description
                            `, [rowEntityId, internalEmpId, reportDate, 'Leave/Notice', remarks]);
                        }
                        results.processed++;
                    } catch (e) {
                        results.errors.push(`${file.originalname} [Row ${i}]: ${e.message} `);
                    }
                }
            });

            // Cleanup temp file
            try { fs.unlinkSync(file.path); } catch (e) { }
        }

        if (!dryRun) {
            db.exec("COMMIT");
            saveDb();
        }

        console.log(`[Import] Finished.Processed: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors.length} `);
        res.json({ message: dryRun ? 'Scan completed' : 'Import completed', results, dryRun });
    } catch (err) {
        if (!req.body.dryRun) {
            const db = await getDb();
            try { db.exec("ROLLBACK"); } catch (e) { }
        }
        res.status(500).json({ error: 'Process failed: ' + err.message });
    }
});

router.get('/history', authMiddleware, async (req, res) => {
    const entityId = req.user.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    try {
        const db = await getDb();
        const runs = db.exec(`
            SELECT t.*, e.full_name as employee_name, e.employee_id as employee_code
            FROM timesheets t
            JOIN employees e ON t.employee_id = e.id
            WHERE t.entity_id = ?
                            ORDER BY t.date DESC
            LIMIT 500
        `, [entityId]);
        res.json(toObjects(runs));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/attendance/monthly?employeeId=X&year=YYYY&month=M
router.get('/monthly', authMiddleware, async (req, res) => {
    const { employeeId, year, month, entityId: queryEntityId } = req.query;
    if (!employeeId || !year || !month) return res.status(400).json({ error: 'Missing parameters' });

    let entityId = queryEntityId || req.user.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    // Authorization check
    try {
        const db = await getDb();
        const userId = req.user.id;
        const authSql = `SELECT uer.entity_id FROM user_entity_roles uer WHERE uer.user_id = ? AND uer.entity_id = ? `;
        const authRes = db.exec(authSql, [userId, entityId]);
        if (authRes.length === 0) {
            // Check if user is Admin (who has cross-entity access)
            const roleSql = `SELECT role FROM user_entity_roles WHERE user_id = ? AND role = 'Admin' LIMIT 1`;
            const roleRes = db.exec(roleSql, [userId]);
            if (roleRes.length === 0) {
                return res.status(403).json({ error: 'Not authorized for this entity' });
            }
        }

        const paddedMonth = month.toString().padStart(2, '0');
        const startStr = `${year}-${paddedMonth}-01`;
        const endStr = `${year}-${paddedMonth}-31`;

        const runs = db.exec(`
                        SELECT
                        id, date, in_time, out_time, shift,
                            ot_hours, ot_1_5_hours, ot_2_0_hours,
                            normal_hours, ph_hours, late_mins, early_out_mins,
                            performance_credit, remarks
            FROM timesheets 
            WHERE entity_id = ?
                            AND employee_id = ?
                                AND date >= ?
                                    AND date <= ?
                                        ORDER BY date ASC
        `, [entityId, employeeId, startStr, endStr]);

        res.json(toObjects(runs));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/attendance/monthly
// Body: { employeeId, records: [{ date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, remarks }] }
router.post('/monthly', authMiddleware, async (req, res) => {
    const { employeeId, records, entityId: bodyEntityId } = req.body;
    if (!employeeId || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Missing parameters or invalid records array' });
    }

    let entityId = bodyEntityId || req.user.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    try {
        const db = await getDb();
        const userId = req.user.id;

        // Authorization check
        const authSql = `SELECT uer.entity_id FROM user_entity_roles uer WHERE uer.user_id = ? AND uer.entity_id = ? `;
        const authRes = db.exec(authSql, [userId, entityId]);
        if (authRes.length === 0) {
            const roleSql = `SELECT role FROM user_entity_roles WHERE user_id = ? AND role = 'Admin' LIMIT 1`;
            const roleRes = db.exec(roleSql, [userId]);
            if (roleRes.length === 0) {
                return res.status(403).json({ error: 'Not authorized for this entity' });
            }
        }

        db.exec("BEGIN TRANSACTION");
        records.forEach(rc => {
            db.run(`
                INSERT INTO timesheets(entity_id, employee_id, date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, normal_hours, ph_hours, late_mins, early_out_mins, performance_credit, remarks, source_file)
                        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual Override')
                ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                        in_time = excluded.in_time,
                            out_time = excluded.out_time,
                            shift = excluded.shift,
                            ot_hours = excluded.ot_hours,
                            ot_1_5_hours = excluded.ot_1_5_hours,
                            ot_2_0_hours = excluded.ot_2_0_hours,
                            normal_hours = excluded.normal_hours,
                            ph_hours = excluded.ph_hours,
                            late_mins = excluded.late_mins,
                            early_out_mins = excluded.early_out_mins,
                            performance_credit = excluded.performance_credit,
                            remarks = excluded.remarks
                                `, [
                entityId,
                employeeId,
                rc.date,
                rc.in_time || '',
                rc.out_time || '',
                rc.shift || 'Day',
                rc.ot_hours || 0,
                rc.ot_1_5_hours || 0,
                rc.ot_2_0_hours || 0,
                rc.normal_hours || 0,
                rc.ph_hours || 0,
                rc.late_mins || 0,
                rc.early_out_mins || 0,
                rc.performance_credit || 0,
                rc.remarks || ''
            ]);
        });
        db.exec("COMMIT");
        saveDb();

        res.json({ message: 'Monthly records updated manually' });
    } catch (err) {
        const db = await getDb();
        try { db.exec("ROLLBACK"); } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

router.get('/holidays', authMiddleware, async (req, res) => {
    const { year, month } = req.query;
    let entityId = req.query.entityId || req.user.entityId;

    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    try {
        const db = await getDb();
        const paddedMonth = month ? month.toString().padStart(2, '0') : null;
        const datePattern = year ? (month ? `${year}-${paddedMonth}-%` : `${year}-%`) : '%';

        const sql = `SELECT * FROM holidays WHERE entity_id = ? AND date LIKE ? ORDER BY date ASC`;
        const result = db.exec(sql, [entityId, datePattern]);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
