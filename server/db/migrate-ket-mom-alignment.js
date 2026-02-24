const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hrms.sqlite');

async function migrate() {
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found.');
        return;
    }

    const SQL = await initSQL();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    console.log('Migrating employee_kets table for MOM alignment...');

    try {
        // Add new columns to employee_kets
        const columns = [
            { name: 'main_duties', type: 'TEXT' },
            { name: 'employment_end_date', type: 'DATE' },
            { name: 'working_hours_details', type: 'TEXT' }, // e.g. "9am to 6pm"
            { name: 'break_hours', type: 'TEXT' }, // e.g. "1 hour"
            { name: 'salary_payment_date', type: 'TEXT' },
            { name: 'overtime_payment_date', type: 'TEXT' },
            { name: 'gross_rate_of_pay', type: 'REAL' },
            { name: 'other_salary_components', type: 'TEXT' },
            { name: 'cpf_payable', type: 'BOOLEAN DEFAULT 1' },
            { name: 'probation_start_date', type: 'DATE' },
            { name: 'probation_end_date', type: 'DATE' }
        ];

        for (const col of columns) {
            try {
                db.run(`ALTER TABLE employee_kets ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added column ${col.name}`);
            } catch (e) {
                if (e.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else {
                    throw e;
                }
            }
        }

        // Save progress
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
