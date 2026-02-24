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

router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
    const entityId = req.user.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const db = await getDb();
        const workbook = XLSX.readFile(req.file.path);
        const results = {
            processed: 0,
            skipped: 0,
            errors: []
        };

        // Cache employee mapping for this entity to speed up lookups
        const employeeResult = db.exec('SELECT id, employee_id, site_id FROM employees WHERE entity_id = ?', [entityId]);
        const employeeMap = {}; // employee_id -> {id, site_id}
        toObjects(employeeResult).forEach(emp => {
            employeeMap[emp.employee_id] = { id: emp.id, site_id: emp.site_id };
        });

        // Cache all site working hours to avoid executing SQL per row
        const siteHoursResult = db.exec(`
            SELECT h.* FROM site_working_hours h
            JOIN sites s ON h.site_id = s.id
            JOIN customers c ON s.customer_id = c.id
            WHERE c.entity_id = ?
        `, [entityId]);
        const hoursMap = {}; // "siteId_dayOfWeek_shift" -> config
        toObjects(siteHoursResult).forEach(h => {
            hoursMap[`${h.site_id}_${h.day_of_week}_${h.shift_type}`] = h;
        });

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // 1. Identify Date (Usually in row 5 or 6 based on sample)
            let reportDate = null;
            let dayOfWeek = 1; // 0=Sun, 1=Mon...
            for (let i = 0; i < Math.min(10, data.length); i++) {
                const row = data[i];
                const dateIdx = row.indexOf('Day & Date : ');
                if (dateIdx !== -1 && row[dateIdx + 1]) {
                    // Extract date from string like "08-02-2025(SATURDAY)"
                    const dateMatch = row[dateIdx + 1].match(/(\d{2})-(\d{2})-(\d{4})/);
                    if (dateMatch) {
                        reportDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                        dayOfWeek = new Date(reportDate).getDay();
                    }
                    break;
                }
            }

            if (!reportDate) {
                results.errors.push(`Sheet ${sheetName}: Could not identify report date.`);
                return; // continue to next sheet
            }

            // 2. Identify Header and Start Processing
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(15, data.length); i++) {
                if (data[i] && data[i].includes('Emp.No')) {
                    headerRowIdx = i;
                    break;
                }
            }

            if (headerRowIdx === -1) {
                results.errors.push(`Sheet ${sheetName}: Could not find 'Emp.No' header.`);
                return;
            }

            const header = data[headerRowIdx];
            const empNoIdx = header.indexOf('Emp.No');
            const inIdx = header.indexOf('In');
            const outIdx = header.indexOf('Out');
            const shiftIdx = header.indexOf('Shift (D/N)');
            const remarksIdx = header.indexOf('Remarks (Piping)');

            // 3. Process each employee row
            for (let i = headerRowIdx + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;
                const empIdStr = row[empNoIdx];
                if (!empIdStr) continue;

                const empData = employeeMap[empIdStr];
                if (!empData) {
                    results.skipped++;
                    continue;
                }
                const internalEmpId = empData.id;
                const empSiteId = empData.site_id;

                const inTime = row[inIdx]; // e.g. 800
                const outTime = row[outIdx]; // e.g. 1830
                const shift = row[shiftIdx] === 'N' ? 'Night' : 'Day';
                const remarks = String(row[remarksIdx] || '');

                let otHours = 0;
                let ot15Hours = 0;
                let ot20Hours = 0;

                // Grab site configuration
                let otStartBoundary = 1730; // fallback default
                let compulsoryOT = 0;

                if (empSiteId) {
                    const config = hoursMap[`${empSiteId}_${dayOfWeek}_${shift}`];
                    if (config) {
                        if (config.ot_start_time) {
                            otStartBoundary = parseInt(config.ot_start_time.replace(':', ''));
                        }
                        if (config.compulsory_ot_hours) {
                            compulsoryOT = parseFloat(config.compulsory_ot_hours);
                        }
                    }
                }

                // Logic for OT calculation
                let otStartBoundaryInt = parseInt(otStartBoundary);
                let outTimeInt = parseInt(outTime);

                if (outTimeInt && outTimeInt > otStartBoundaryInt) {
                    const outH = Math.floor(outTimeInt / 100);
                    const outM = outTimeInt % 100;
                    // Lower 15 mins block
                    const roundedOutM = Math.floor(outM / 15) * 15;
                    const totalOutMins = outH * 60 + roundedOutM;

                    const boundH = Math.floor(otStartBoundaryInt / 100);
                    const boundM = otStartBoundaryInt % 100;
                    const totalBoundMins = boundH * 60 + boundM;

                    const diffMins = totalOutMins - totalBoundMins;

                    if (diffMins > 0) {
                        otHours = diffMins / 60;
                    }

                    // Add compulsory Night Shift OT if applicable
                    otHours += compulsoryOT;

                    // Standard MoM rate logic: 2.0x for Sundays, 1.5x for normal days
                    if (dayOfWeek === 0) { // Sunday
                        ot20Hours = otHours;
                    } else {
                        ot15Hours = otHours;
                    }
                } else if (compulsoryOT > 0) {
                    // Even if outTime isn't past OT boundary, Night shift receives compulsory OT
                    otHours = compulsoryOT;
                    if (dayOfWeek === 0) ot20Hours = otHours;
                    else ot15Hours = otHours;
                }

                try {
                    db.run(`
                        INSERT INTO timesheets (entity_id, employee_id, date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, remarks, source_file)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                        in_time = excluded.in_time,
                        out_time = excluded.out_time,
                        shift = excluded.shift,
                        ot_hours = excluded.ot_hours,
                        ot_1_5_hours = excluded.ot_1_5_hours,
                        ot_2_0_hours = excluded.ot_2_0_hours,
                        remarks = excluded.remarks
                    `, [entityId, internalEmpId, reportDate, String(inTime || ''), String(outTime || ''), shift, otHours, ot15Hours, ot20Hours, remarks, req.file.originalname]);

                    // If remarks indicate leave, log it to remarks table
                    if (remarks.toUpperCase().includes('LEAVE') || remarks.toUpperCase().includes('M/C')) {
                        db.run(`
                            INSERT INTO attendance_remarks (entity_id, employee_id, date, remark_type, description)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                            remark_type = excluded.remark_type,
                            description = excluded.description
                        `, [entityId, internalEmpId, reportDate, 'Leave/Notice', remarks]);
                    }

                    results.processed++;
                } catch (e) {
                    results.errors.push(`Row ${i} (${empIdStr}): ${e.message}`);
                }
            }
        });

        saveDb();
        res.json({ message: 'Import completed', results });
    } catch (err) {
        res.status(500).json({ error: 'Import failed: ' + err.message });
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
    const entityId = req.user.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    const { employeeId, year, month } = req.query;
    if (!employeeId || !year || !month) return res.status(400).json({ error: 'Missing parameters' });

    // Format target month strings using SQlite compliant formats
    // e.g., '2024-02-01' to '2024-02-29'
    const paddedMonth = month.toString().padStart(2, '0');
    const startStr = `${year}-${paddedMonth}-01`;
    const endStr = `${year}-${paddedMonth}-31`;

    try {
        const db = await getDb();
        const runs = db.exec(`
            SELECT * FROM timesheets 
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
    const entityId = req.user.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

    const { employeeId, records } = req.body;
    if (!employeeId || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Missing parameters or invalid records array' });
    }

    try {
        const db = await getDb();

        db.exec("BEGIN TRANSACTION");
        records.forEach(rc => {
            db.run(`
                INSERT INTO timesheets (entity_id, employee_id, date, in_time, out_time, shift, ot_hours, ot_1_5_hours, ot_2_0_hours, remarks, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual Override')
                ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET
                in_time = excluded.in_time,
                out_time = excluded.out_time,
                shift = excluded.shift,
                ot_hours = excluded.ot_hours,
                ot_1_5_hours = excluded.ot_1_5_hours,
                ot_2_0_hours = excluded.ot_2_0_hours,
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
                rc.remarks || ''
            ]);
        });
        db.exec("COMMIT");
        saveDb();

        res.json({ message: 'Monthly records updated manually' });
    } catch (err) {
        const db = await getDb();
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
