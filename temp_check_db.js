const init = require('./server/db/init');

async function checkLatest() {
    try {
        const db = await init.getDb();
        const results = db.exec("SELECT id, employee_name, performance_allowance FROM payslips ORDER BY id DESC LIMIT 10;");

        if (results.length === 0) {
            console.log("No payslips found.");
            return;
        }

        const { columns, values } = results[0];
        const payslips = values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });

        console.log("Latest Payslips Audit:");
        console.log(JSON.stringify(payslips, null, 2));

    } catch (err) {
        console.error("Error checking database:", err);
    }
}

checkLatest();
