const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
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
            if (a.role === 'Admin') return true;
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
                    const dateMarkerIdx = row.findIndex(cell => cell && String(cell).toLowerCase().includes('day & date'));
                    if (dateMarkerIdx !== -1 && row[dateMarkerIdx + 1]) {
                        const rawValue = row[dateMarkerIdx + 1];
                        if (typeof rawValue === 'number') {
                            const date = new Date((rawValue - 25569) * 86400 * 1000);
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            reportDate = `${y}-${m}-${d}`;
                            dayOfWeek = date.getDay();
                        } else {
                            const dateMatch = String(rawValue).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
                            if (dateMatch) {
                                const d = dateMatch[1].padStart(2, '0');
                                const m = dateMatch[2].padStart(2, '0');
                                const y = dateMatch[3];
                                reportDate = `${y}-${m}-${d}`;
                                dayOfWeek = new Date(reportDate).getDay();
                            } else {
                                results.errors.push(`${file.originalname} [${sheetName}]: Date value '${rawValue}' did not match format.`);
                            }
                        }
                        break;
                    }
                }

                if (!reportDate) return;

                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(20, data.length); i++) {
                    if (data[i] && data[i].some(cell => cell && String(cell).toLowerCase().includes('emp.no'))) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) return;

                const header = data[headerRowIdx].map(h => String(h || '').toLowerCase().trim());
                const empNoIdx = header.findIndex(h => h.includes('emp.no'));
                const inIdx = header.findIndex(h => h === 'in');
                const outIdx = header.findIndex(h => h === 'out');
                const shiftIdx = header.findIndex(h => h.includes('shift'));
                const remarksIdx = header.findIndex(h => h.includes('remarks'));
                const perfCreditIdx = header.findIndex(h => h.includes('performance credit') || h.includes('perf credit'));

                let holidaysInSheet = [];
                try {
                    const hRes = db.exec(`SELECT date FROM holidays WHERE entity_id = ?`, [req.user.entityId]);
                    holidaysInSheet = toObjects(hRes).map(h => h.date);
                } catch (e) { }

                for (let i = headerRowIdx + 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || !row[empNoIdx]) continue;

                    const empIdStr = String(row[empNoIdx]).trim();
                    const empData = employeeMap[empIdStr];
                    if (!empData) {
                        results.skipped++;
                        continue;
                    }

                    if (dryRun) { results.processed++; continue; }

                    const internalEmpId = empData.id;
                    const empSiteId = empData.site_id;
                    const rowEntityId = empData.entity_id;
                    const inTime = row[inIdx];
                    const outTime = row[outIdx];
                    const shift = String(row[shiftIdx] || '').toUpperCase().includes('N') ? 'Night' : 'Day';
                    const remarks = remarksIdx !== -1 ? String(row[remarksIdx] || '') : '';
                    const perfCredit = perfCreditIdx !== -1 ? parseFloat(row[perfCreditIdx]) || 0 : 0;

                    let otHours = 0, ot15Hours = 0, ot20Hours = 0, normalHours = 0, lateMins = 0, earlyOutMins = 0, phHours = 0;

                    const parseExcelTime = (val) => {
                        if (!val) return null;
                        if (typeof val === 'number') {
                            if (val < 1) {
                                let totalMins = Math.round(val * 24 * 60);
                                return Math.floor(totalMins / 60) * 100 + (totalMins % 60);
                            }
                            return val;
                        }
                        return parseInt(String(val).replace(':', '')) || null;
                    };

                    let inTimeInt = parseExcelTime(inTime), outTimeInt = parseExcelTime(outTime);
                    let config = empSiteId ? hoursMap[`${empSiteId}_${dayOfWeek}_${shift}`] : null;

                    if (!config) config = globalShiftsMap[`${rowEntityId}_${shift}`];
                    if (!config) {
                        config = {
                            start_time: shift === 'Night' ? '20:00' : '08:00',
                            end_time: shift === 'Night' ? '05:00' : '17:00',
                            ot_start_time: shift === 'Night' ? '05:30' : '17:30',
                            late_arrival_threshold_mins: 15,
                            early_departure_threshold_mins: 15
                        };
                    }

                    if (config) {
                        const timeToMins = (t) => Math.floor(t / 100) * 60 + (t % 100);
                        let shiftStartMins = timeToMins(parseInt(config.start_time.replace(':', '')));
                        let shiftEndMins = timeToMins(parseInt(config.end_time.replace(':', '')));
                        if (shiftEndMins <= shiftStartMins) shiftEndMins += 1440;

                        if (inTimeInt && outTimeInt) {
                            let inMins = timeToMins(inTimeInt);
                            let outMins = timeToMins(outTimeInt);
                            if (outMins < shiftStartMins && inMins >= 1200) outMins += 1440;

                            const totalWorkedMins = outMins - inMins;
                            const workedDurationHours = Math.max(0, (totalWorkedMins / 60) - 1);

                            if (dayOfWeek === 0) {
                                ot20Hours = workedDurationHours;
                            } else if (dayOfWeek === 6) {
                                normalHours = Math.min(4, workedDurationHours);
                                ot15Hours = Math.max(0, workedDurationHours - 4);
                            } else if (holidaysInSheet.includes(reportDate)) {
                                normalHours = Math.min(8, workedDurationHours);
                                phHours = normalHours;
                                ot20Hours = Math.max(0, workedDurationHours - 8);
                            } else {
                                normalHours = Math.min(8, workedDurationHours);
                                ot15Hours = Math.max(0, workedDurationHours - 8);
                            }

                            const lateThres = parseInt(config.late_arrival_threshold_mins || 0);
                            if (inMins - shiftStartMins > lateThres) lateMins = inMins - shiftStartMins;
                            const earlyThres = parseInt(config.early_departure_threshold_mins || 0);
                            if (shiftEndMins - outMins > earlyThres) earlyOutMins = shiftEndMins - outMins;
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
                        results.processed++;
                    } catch (e) { results.errors.push(`${file.originalname}: ${e.message}`); }
                }
            });
            try { fs.unlinkSync(file.path); } catch (e) { }
        }

        if (!dryRun) { db.exec("COMMIT"); saveDb(); }
        res.json({ message: 'Import completed', results, dryRun });
    } catch (err) {
        const db = await getDb();
        try { db.exec("ROLLBACK"); } catch (e) { }
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
            ORDER BY t.date DESC LIMIT 500
        `, [entityId]);
        res.json(toObjects(runs));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/monthly', authMiddleware, async (req, res) => {
    const { employeeId, year, month, entityId: queryEntityId } = req.query;
    let entityId = queryEntityId || req.user.entityId;
    if (!employeeId || !year || !month || !entityId) return res.status(400).json({ error: 'Missing parameters' });
    try {
        const db = await getDb();
        const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endStr = `${year}-${String(month).padStart(2, '0')}-31`;
        const runs = db.exec(`
            SELECT id, date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, normal_hours, ph_hours, late_mins, early_out_mins, performance_credit, remarks
            FROM timesheets WHERE entity_id = ? AND employee_id = ? AND date >= ? AND date <= ? ORDER BY date ASC
        `, [entityId, employeeId, startStr, endStr]);
        res.json(toObjects(runs));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/monthly', authMiddleware, async (req, res) => {
    const { employeeId, records, entityId: bodyEntityId } = req.body;
    let entityId = bodyEntityId || req.user.entityId;
    if (!employeeId || !Array.isArray(records) || !entityId) return res.status(400).json({ error: 'Missing parameters' });
    try {
        const db = await getDb();
        db.exec("BEGIN TRANSACTION");
        records.forEach(rc => {
            db.run(`
                INSERT INTO timesheets(entity_id, employee_id, date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, normal_hours, ph_hours, late_mins, early_out_mins, performance_credit, remarks, source_file)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual Override')
                ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                in_time = excluded.in_time, out_time = excluded.out_time, shift = excluded.shift, ot_hours = excluded.ot_hours,
                ot_1_5_hours = excluded.ot_1_5_hours, ot_2_0_hours = excluded.ot_2_0_hours, normal_hours = excluded.normal_hours, 
                ph_hours = excluded.ph_hours, late_mins = excluded.late_mins,
                early_out_mins = excluded.early_out_mins, performance_credit = excluded.performance_credit, remarks = excluded.remarks
            `, [entityId, employeeId, rc.date, rc.in_time || '', rc.out_time || '', rc.shift || 'Day', rc.ot_hours || 0, rc.ot_1_5_hours || 0, rc.ot_2_0_hours || 0, rc.normal_hours || 0, rc.ph_hours || 0, rc.late_mins || 0, rc.early_out_mins || 0, rc.performance_credit || 0, rc.remarks || '']);
        });
        db.exec("COMMIT");
        saveDb();
        res.json({ message: 'Monthly records updated' });
    } catch (err) {
        const db = await getDb();
        try { db.exec("ROLLBACK"); } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

router.post('/face-clock', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const { descriptor } = req.body;
        const entityId = req.user.entityId;
        if (!descriptor || !entityId) return res.status(400).json({ error: 'Missing descriptor or entity context' });

        const empsRes = db.exec('SELECT id, full_name, employee_id, face_descriptor FROM employees WHERE entity_id = ? AND face_descriptor IS NOT NULL', [entityId]);
        const emps = toObjects(empsRes);
        console.log(`[FACE_CLOCK] Comparing against ${emps.length} enrolled employees for entity ${entityId}`);

        let bestMatch = null;
        let minDistance = 0.65; // Relaxed from 0.6

        const calculateDistance = (d1, d2) => Math.sqrt(d1.reduce((sum, val, i) => sum + Math.pow(val - d2[i], 2), 0));

        emps.forEach(emp => {
            try {
                const empDescriptor = JSON.parse(emp.face_descriptor);
                const distance = calculateDistance(descriptor, empDescriptor);
                console.log(`   - Distance for ${emp.full_name}: ${distance.toFixed(4)}`);
                if (distance < minDistance) { minDistance = distance; bestMatch = emp; }
            } catch (e) { }
        });

        if (!bestMatch) {
            console.warn(`[FACE_CLOCK] No match found. Min distance observed: ${minDistance.toFixed(4)}`);
            return res.status(404).json({ error: 'Face not recognized' });
        }

        const now = new Date();
        const sgtOffset = 8 * 60; // Singapore is UTC+8
        const sgtTime = new Date(now.getTime() + (sgtOffset * 60 * 1000));

        const today = sgtTime.toISOString().split('T')[0];
        const timeStr = String(sgtTime.getUTCHours()).padStart(2, '0') + String(sgtTime.getUTCMinutes()).padStart(2, '0');

        const checkRes = db.exec('SELECT in_time, out_time FROM timesheets WHERE employee_id = ? AND date = ? AND entity_id = ?', [bestMatch.id, today, entityId]);
        const existing = toObjects(checkRes)[0];

        let action = 'In';
        if (existing && existing.in_time && !existing.out_time) {
            db.run('UPDATE timesheets SET out_time = ? WHERE employee_id = ? AND date = ? AND entity_id = ?', [timeStr, bestMatch.id, today, entityId]);
            action = 'Out';
        } else if (existing && existing.in_time && existing.out_time) {
            return res.status(400).json({ error: 'Already clocked in and out today' });
        } else {
            db.run('INSERT INTO timesheets (entity_id, employee_id, date, in_time, shift) VALUES (?, ?, ?, ?, ?)', [entityId, bestMatch.id, today, timeStr, 'Day']);
        }
        saveDb();
        res.json({ message: `Successfully clocked ${action} for ${bestMatch.full_name}`, employee: bestMatch, action });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
