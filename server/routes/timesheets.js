const express = require('express');
const multer = require('multer');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();

// Memory storage for multer (fast processing, no file cleanup needed)
const upload = multer({ storage: multer.memoryStorage() });

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

// Upload and Parse Timesheets
// Expects a CSV mapping: Employee ID, Date (YYYY-MM-DD), OT Hours
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const db = await getDb();
        const entityId = req.user.entityId;

        let fileContent = req.file.buffer.toString('utf8');
        let lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length === 0) return res.status(400).json({ error: 'Empty timesheet file' });

        // Assume first row is header, check it loosely
        let startIndex = 0;
        if (lines[0].toLowerCase().includes('employee')) {
            startIndex = 1;
        }

        let successCount = 0;
        let errorList = [];

        db.exec('BEGIN TRANSACTION');

        for (let i = startIndex; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));

            // Expected columns: Employee Code, Date, OT Hours
            if (cols.length < 3) continue;

            const empCode = cols[0];
            const dateStr = cols[1];
            const otHours = parseFloat(cols[2]) || 0;

            if (otHours <= 0) continue; // Skip days with no OT to save space

            // Lookup Employee internal ID by employee code (EMP-XXX) within the entity
            const empCheck = db.exec(`SELECT id FROM employees WHERE employee_id = '${empCode}' AND entity_id = ${entityId}`);

            if (empCheck.length === 0) {
                errorList.push(`Line ${i + 1}: Employee Code ${empCode} not found in this entity.`);
                continue;
            }

            const internalEmpId = empCheck[0].values[0][0];

            // Upsert Timesheet logic using SQLite ON CONFLICT
            try {
                // Ensure date string is clean
                db.run(`
                    INSERT INTO timesheets (entity_id, employee_id, date, ot_hours)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(entity_id, employee_id, date)
                    DO UPDATE SET ot_hours = excluded.ot_hours, created_at = CURRENT_TIMESTAMP
                `, [entityId, internalEmpId, dateStr, otHours]);
                successCount++;
            } catch (err) {
                errorList.push(`Line ${i + 1}: Database error inserting data. ${err.message}`);
            }
        }

        db.exec('COMMIT');
        saveDb();

        res.json({
            message: `Processed timesheet file. successfully uploaded ${successCount} records.`,
            successCount,
            errors: errorList
        });

    } catch (err) {
        // Rollback just in case
        try {
            const db = await getDb();
            db.exec('ROLLBACK');
        } catch (e) { }
        res.status(500).json({ error: err.message });
    }
});

// Get Timesheets for a specific month and entity
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        const monthPrefix = req.query.month; // e.g., '2026-02'

        let query = `
            SELECT t.*, e.employee_id as employeeCode, e.full_name 
            FROM timesheets t
            JOIN employees e ON t.employee_id = e.id
            WHERE t.entity_id = ?
        `;
        let params = [entityId];

        if (monthPrefix) {
            query += ` AND t.date LIKE ?`;
            params.push(monthPrefix + '-%');
        }

        query += ` ORDER BY t.date DESC, e.employee_id ASC LIMIT 500`;

        db.exec('BEGIN TRANSACTION');
        const stmt = db.prepare(query);
        stmt.bind(params);

        let results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        db.exec('COMMIT');

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
