const jwt = require('jsonwebtoken');
const JWT_SECRET = 'hrms-sg-secret-key-2026';

const payload = {
    id: 1,
    username: 'admin',
    full_name: 'System Administrator'
};

const token = jwt.sign(payload, JWT_SECRET);
console.log(token);
