const { getDb, saveDb } = require('./db/init');
getDb().then(db => {
    console.log("Fixing empty record ID 228 in Entity 5...");
    db.run("UPDATE employees SET employee_id = '2007', full_name = 'ADIYAPATHAM SUNDAR', national_id = 'S7464706E' WHERE id = 228 AND entity_id = 5");
    saveDb();

    console.log("Resyncing data from Entity 2 to Entity 5 for 2007...");
    const entity2Data = db.exec("SELECT * FROM employees WHERE national_id = 'S7464706E' AND entity_id = 2");
    const toObjects = (res) => {
        if (!res || !res.length) return [];
        return res[0].values.map(v => Object.fromEntries(res[0].columns.map((c, i) => [c, v[i]])));
    };
    const source = toObjects(entity2Data)[0];

    if (source) {
        db.run(
            `UPDATE employees SET 
                full_name=?, date_of_birth=?, nationality=?, tax_residency=?, race=?, gender=?, language=?, 
                mobile_number=?, whatsapp_number=?, email=?, highest_education=?, photo_url=? 
             WHERE id = 228 AND entity_id = 5`,
            [
                source.full_name, source.date_of_birth, source.nationality, source.tax_residency, source.race,
                source.gender, source.language, source.mobile_number, source.whatsapp_number, source.email,
                source.highest_education, source.photo_url
            ]
        );
        saveDb();
        console.log("Restoration and Sync complete.");
    } else {
        console.error("Source data not found in Entity 2!");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
