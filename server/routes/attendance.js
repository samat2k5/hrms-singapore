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
        const employeeResult = db.exec(`SELECT id, employee_id FROM employees WHERE entity_id = ${entityId}`);
        const employeeMap = {}; // employee_id -> id
        toObjects(employeeResult).forEach(emp => {
            employeeMap[emp.employee_id] = emp.id;
        });

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // 1. Identify Date (Usually in row 5 or 6 based on sample)
            let reportDate = null;
            for (let i = 0; i < Math.min(10, data.length); i++) {
                const row = data[i];
                const dateIdx = row.indexOf('Day & Date : ');
                if (dateIdx !== -1 && row[dateIdx + 1]) {
                    // Extract date from string like "08-02-2025(SATURDAY)"
                    const dateMatch = row[dateIdx + 1].match(/(\d{2})-(\d{2})-(\d{4})/);
                    if (dateMatch) {
                        reportDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                    }
                    break;
                }
            }

            if (!reportDate) {
                results.errors.push(`Sheet ${sheetName}: Could not identify report date.`);
                return;
            }

            // 2. Identify Header and Start Processing
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(15, data.length); i++) {
                if (data[i].includes('Emp.No')) {
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
                const empIdStr = row[empNoIdx];
                if (!empIdStr) continue;

                const internalEmpId = employeeMap[empIdStr];
                if (!internalEmpId) {
                    results.skipped++;
                    continue;
                }

                const inTime = row[inIdx];
                const outTime = row[outIdx];
                const shift = row[shiftIdx];
                const remarks = String(row[remarksIdx] || '');

                // Logic for OT calculation (simplified for now)
                // In example: 800 to 1830. 
                // Regular is 0800-1730 (9 hours including break).
                // Let's assume > 1730 is OT for Day shift.
                let otHours = 0;
                let ot15Hours = 0;
                let ot20Hours = 0;

                if (shift === 'D' && outTime > 1730) {
                    const diff = outTime - 1730;
                    otHours = Math.floor(diff / 100) + (diff % 100 / 60);

                    // Check if Sunday for 2.0x
                    const dateObj = new Date(reportDate);
                    const isSunday = dateObj.getDay() === 0;

                    if (isSunday) {
                        ot20Hours = otHours;
                    } else {
                        ot15Hours = otHours;
                    }
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
                    `, [entityId, internalEmpId, reportDate, String(inTime), String(outTime), shift, otHours, ot15Hours, ot20Hours, remarks, req.file.originalname]);

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
                    results.errors.push(`Row ${i}: ${e.message}`);
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
            WHERE t.entity_id = ${entityId}
            ORDER BY t.date DESC
            LIMIT 500
        `);
        res.json(toObjects(runs));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
