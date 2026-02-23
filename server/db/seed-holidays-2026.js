const fs = require('fs');
const initSQL = require('sql.js');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hrms.sqlite');

async function migrateHolidays() {
    const SQL = await initSQL();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    db.run('DELETE FROM holidays');

    // Seed Public Holidays for Singapore 2026
    // Source: MOM (Ministry of Manpower) official dates
    const holidays2026 = [
        { date: '2026-01-01', name: 'New Year\'s Day' },
        { date: '2026-02-17', name: 'Chinese New Year' },
        { date: '2026-02-18', name: 'Chinese New Year (2nd Day)' },
        { date: '2026-03-21', name: 'Hari Raya Puasa' }, // Corrected date
        { date: '2026-04-03', name: 'Good Friday' },
        { date: '2026-05-01', name: 'Labour Day' },
        { date: '2026-05-27', name: 'Hari Raya Haji' }, // Corrected date
        { date: '2026-05-31', name: 'Vesak Day' },
        { date: '2026-06-01', name: 'Vesak Day (Observed)' }, // Since May 31 is Sunday
        { date: '2026-08-09', name: 'National Day' },
        { date: '2026-08-10', name: 'National Day (Observed)' }, // Since Aug 9 is Sunday
        { date: '2026-11-08', name: 'Deepavali' },
        { date: '2026-11-09', name: 'Deepavali (Observed)' },    // Since Nov 8 is Sunday
        { date: '2026-12-25', name: 'Christmas Day' }
    ];

    const entitiesCheck = db.exec("SELECT id FROM entities");
    if (entitiesCheck.length > 0) {
        const entityIds = entitiesCheck[0].values.map(v => v[0]);
        for (const eId of entityIds) {
            holidays2026.forEach(h => {
                db.run(`INSERT INTO holidays (entity_id, date, name) VALUES (?, ?, ?)`, [eId, h.date, h.name]);
            });
        }
    }

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log('2026 Holidays seeded successfully with precise MOM dates.');
}

migrateHolidays();
