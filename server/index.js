const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/init');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const ketsRoutes = require('./routes/kets');
const leaveRoutes = require('./routes/leave');
const payrollRoutes = require('./routes/payroll');
const reportRoutes = require('./routes/reports');
const documentRoutes = require('./routes/documents');
const entityRoutes = require('./routes/entities');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Entity-Id']
}));
app.use(express.json({ limit: '10mb' }));

// Serve uploaded documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../client/dist')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/kets', ketsRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/entities', require('./routes/entities'));
app.use('/api/user-roles', require('./routes/user_roles'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/employee-groups', require('./routes/employee_groups'));
app.use('/api/employee-grades', require('./routes/employee_grades'));
app.use('/api/leave-policies', require('./routes/leave_policies'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/holidays', require('./routes/holidays'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/attendance', attendanceRoutes);
app.use('/api/iras', require('./routes/iras'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'HRMS Singapore API', version: '1.0.0' });
});

// React Catch-all route for single-page application routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Initialize DB and start server
async function start() {
    try {
        await getDb();
        console.log('📦 Database initialized');

        app.listen(PORT, () => {
            console.log(`🚀 HRMS Server running on http://localhost:${PORT}`);
            console.log(`📋 API Routes:`);
            console.log(`   POST /api/auth/login`);
            console.log(`   GET  /api/employees`);
            console.log(`   GET  /api/kets/:employeeId`);
            console.log(`   GET  /api/leave/types`);
            console.log(`   POST /api/payroll/run`);
            console.log(`   GET  /api/reports/dashboard`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
