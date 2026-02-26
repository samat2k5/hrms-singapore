const { getDb, saveDb } = require('./server/db/init');

async function migrate() {
    const db = await getDb();
    console.log("Updating employee_kets table...");

    const columns = [
        "job_title_tr",
        "main_duties_tr",
        "medical_benefits_tr",
        "notice_period_tr",
        "other_salary_components_tr",
        "target_language"
    ];

    for (const col of columns) {
        try {
            db.run(`ALTER TABLE employee_kets ADD COLUMN ${col} TEXT`);
            console.log(`Added column: ${col}`);
        } catch (e) {
            console.log(`Column ${col} might already exist or error occurred: ${e.message}`);
        }
    }

    saveDb();
    console.log("Migration complete.");
}

migrate();
