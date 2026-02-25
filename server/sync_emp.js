const { getDb, saveDb } = require('./db/init');

async function syncEmployeeData() {
    const db = await getDb();

    // Get full data from Entity 2
    const sourceResult = db.exec("SELECT * FROM employees WHERE employee_id = '2007' AND entity_id = 2");
    if (sourceResult.length === 0 || sourceResult[0].values.length === 0) {
        console.log("Source employee (Entity 2) not found.");
        process.exit(0);
    }

    // Helper to map values to columns
    const columns = sourceResult[0].columns;
    const values = sourceResult[0].values[0];
    const sourceData = {};
    columns.forEach((col, i) => sourceData[col] = values[i]);

    console.log("Source Data found for:", sourceData.full_name);

    // Fields to sync (Personal/Core info ONLY, not employment/payroll specifics which might differ)
    const fieldsToSync = [
        'full_name', 'date_of_birth', 'national_id', 'nationality', 'tax_residency',
        'race', 'gender', 'language', 'mobile_number', 'whatsapp_number',
        'email', 'highest_education', 'photo_url'
    ];

    // Build update query for Entity 5
    const setClauses = fieldsToSync.map(f => `${f} = ?`).join(', ');
    const params = fieldsToSync.map(f => sourceData[f]);
    params.push('2007', 5); // employee_id and entity_id for WHERE clause

    const query = `UPDATE employees SET ${setClauses} WHERE employee_id = ? AND entity_id = ?`;

    console.log("Syncing to Entity 5...");
    db.run(query, params);
    saveDb();
    console.log("Sync complete.");
    process.exit(0);
}

syncEmployeeData().catch(err => {
    console.error(err);
    process.exit(1);
});
