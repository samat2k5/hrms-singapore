const { getDb, saveDb } = require('./init');

async function migrate() {
    const db = await getDb();

    const alters = [
        "ALTER TABLE employees ADD COLUMN custom_allowances TEXT DEFAULT '{}'",
        "ALTER TABLE employees ADD COLUMN custom_deductions TEXT DEFAULT '{}'",
        "ALTER TABLE employees ADD COLUMN payment_mode TEXT DEFAULT 'Bank Transfer'",

        "ALTER TABLE employee_kets ADD COLUMN custom_allowances TEXT DEFAULT '{}'",
        "ALTER TABLE employee_kets ADD COLUMN custom_deductions TEXT DEFAULT '{}'",

        "ALTER TABLE payroll_runs ADD COLUMN payment_date DATE",

        "ALTER TABLE payslips ADD COLUMN ot_1_5_hours REAL DEFAULT 0",
        "ALTER TABLE payslips ADD COLUMN ot_2_0_hours REAL DEFAULT 0",
        "ALTER TABLE payslips ADD COLUMN ot_1_5_pay REAL DEFAULT 0",
        "ALTER TABLE payslips ADD COLUMN ot_2_0_pay REAL DEFAULT 0",
        "ALTER TABLE payslips ADD COLUMN custom_allowances TEXT DEFAULT '{}'",
        "ALTER TABLE payslips ADD COLUMN custom_deductions TEXT DEFAULT '{}'",
        "ALTER TABLE payslips ADD COLUMN payment_mode TEXT DEFAULT 'Bank Transfer'",

        "ALTER TABLE timesheets ADD COLUMN ot_1_5_hours REAL DEFAULT 0",
        "ALTER TABLE timesheets ADD COLUMN ot_2_0_hours REAL DEFAULT 0"
    ];

    for (const stmt of alters) {
        try {
            db.run(stmt);
            console.log("Success:", stmt);
        } catch (err) {
            console.log("Skipped (probably already exists):", stmt.split(' ADD COLUMN ')[1]);
        }
    }

    saveDb();
    console.log("Migration complete.");
}

migrate().catch(console.error);
