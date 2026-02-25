const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

function timeToMins(t) {
    if (!t) return 0;
    const clean = String(t).replace(':', '').padStart(4, '0');
    const h = parseInt(clean.substring(0, 2)) || 0;
    const m = parseInt(clean.substring(2, 4)) || 0;
    return h * 60 + m;
}

async function runMigration() {
    const SQL = await initSQL();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    console.log("--- Recalculating Jan 2026 Timesheets (v2) ---");

    const res = db.exec("SELECT * FROM timesheets WHERE date LIKE '2026-01-%'");
    if (res.length === 0) {
        console.log("No timesheets found for Jan 2026.");
        return;
    }

    const columns = res[0].columns;
    const timesheets = res[0].values.map(values => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = values[i]);
        return obj;
    });

    const holidayRes = db.exec("SELECT date FROM holidays WHERE date LIKE '2026-01-%'");
    const holidayDates = holidayRes.length > 0 ? holidayRes[0].values.map(v => v[0]) : [];

    console.log(`Processing ${timesheets.length} records...`);

    let updatedCount = 0;
    for (const ts of timesheets) {
        const inMins = timeToMins(ts.in_time);
        let outMins = timeToMins(ts.out_time);
        if (inMins === 0 && outMins === 0) continue;

        if (outMins <= inMins && inMins >= 1000) outMins += 1440; // Overnight

        const isHoliday = holidayDates.includes(ts.date);
        const dateObj = new Date(ts.date);
        const dayOfWeek = dateObj.getDay();

        let normal = 0;
        let ot15 = 0;
        let ot20 = 0;
        let ph = 0;

        if (outMins > inMins) {
            const totalDuration = (outMins - inMins) / 60;
            const workedDurationHours = Math.max(0, totalDuration - 1);

            if (dayOfWeek === 0) {
                normal = 0;
                ot20 = workedDurationHours;
            } else if (dayOfWeek === 6) {
                normal = Math.min(4, workedDurationHours);
                ot15 = Math.max(0, workedDurationHours - 4);
            } else if (isHoliday) {
                normal = Math.min(8, workedDurationHours);
                ph = normal;
                ot20 = Math.max(0, workedDurationHours - 8);
            } else {
                normal = Math.min(8, workedDurationHours);
                ot15 = Math.max(0, workedDurationHours - 8);
            }
        }

        db.run(`
            UPDATE timesheets 
            SET normal_hours = ?, ot_1_5_hours = ?, ot_2_0_hours = ?, ph_hours = ?, ot_hours = ?
            WHERE id = ?
        `, [normal, ot15, ot20, ph, ot15 + ot20, ts.id]);

        updatedCount++;
        if (ts.employee_id === 84 && (ot15 > 0 || ot20 > 0)) {
            console.log(`[ID 84] ${ts.date} ${ts.in_time}-${ts.out_time} -> Worked=${(outMins - inMins - 60) / 60}h, Normal=${normal}, OT1.5=${ot15}, OT2.0=${ot20}`);
        }
    }

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log(`Migration completed. ${updatedCount} records processed and saved.`);
}

runMigration().catch(console.error);
