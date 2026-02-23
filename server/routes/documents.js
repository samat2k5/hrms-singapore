const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

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

// GET /api/documents/expiring
router.get('/expiring', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
        const cutoffDate = ninetyDaysFromNow.toISOString().split('T')[0];

        // Base query with join to employees for name/group
        let query = `
            SELECT d.*, e.full_name, e.employee_id as emp_code, e.employee_group 
            FROM employee_documents d 
            JOIN employees e ON d.employee_id = e.id 
            WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= '${cutoffDate}'
        `;

        // Apply RBAC
        if (req.user.role === 'HR') {
            const groups = req.user.managedGroups || [];
            if (groups.length === 0) return res.json([]);
            const groupList = groups.map(g => `'${g}'`).join(',');
            query += ` AND e.employee_group IN (${groupList})`;
        }

        query += ' ORDER BY d.expiry_date ASC';

        const result = db.exec(query);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/documents/:employeeId
router.get('/:employeeId', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const result = db.exec(`SELECT * FROM employee_documents WHERE employee_id = ${req.params.employeeId} ORDER BY expiry_date ASC`);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for document uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// POST /api/documents
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const db = await getDb();
        const d = req.body;
        const filePath = req.file ? `/uploads/${req.file.filename}` : null;

        db.run(
            `INSERT INTO employee_documents (employee_id, document_type, document_number, issue_date, expiry_date, file_path) VALUES (?, ?, ?, ?, ?, ?)`,
            [d.employee_id, d.document_type, d.document_number, d.issue_date, d.expiry_date || null, filePath]
        );
        saveDb();
        res.status(201).json({ message: 'Document added', filePath });
    } catch (err) {
        console.error("Document Upload Error Details:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/documents/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`DELETE FROM employee_documents WHERE id = ${req.params.id}`);
        saveDb();
        res.json({ message: 'Document deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
