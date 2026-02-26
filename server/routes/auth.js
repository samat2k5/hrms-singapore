const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const db = await getDb();
        const user = db.exec(`SELECT * FROM users WHERE username = '${username}'`);

        if (!user.length || !user[0].values.length) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const row = user[0].values[0];
        const columns = user[0].columns;
        const userData = {};
        columns.forEach((col, i) => userData[col] = row[i]);

        const valid = bcrypt.compareSync(password, userData.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: userData.id,
                username: userData.username,
                fullName: userData.full_name,
                role: userData.role,
                managedGroups: JSON.parse(userData.managed_groups || '[]')
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: userData.id,
                username: userData.username,
                fullName: userData.full_name,
                role: userData.role,
                managedGroups: JSON.parse(userData.managed_groups || '[]')
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName } = req.body;
        if (!username || !password || !fullName) {
            return res.status(400).json({ error: 'All fields required' });
        }

        const db = await getDb();
        const hash = bcrypt.hashSync(password, 10);
        db.run(
            `INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)`,
            [username, hash, fullName]
        );
        saveDb();

        res.json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Both old and new passwords are required' });
        }

        const db = await getDb();
        const userResult = db.exec('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const userList = toObjects(userResult);

        if (!userList.length) return res.status(404).json({ error: 'User not found' });
        const user = userList[0];

        if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const newHash = bcrypt.hashSync(newPassword, 10);
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
        saveDb();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
