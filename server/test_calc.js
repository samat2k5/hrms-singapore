const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');
const { processEmployeePayroll } = require('./engine/payroll-engine');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

function toObjects(res) {
    if (!res || !res.length) return [];
    const columns = res[0].columns;
    return res[0].values.map(values => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = values[i]);
        return obj;
    });
}

async function runTest() {
    const SQL = await initSQL();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    const year = 2026;
    const month = 1;
    const entityId = 2; // Hypex Engineering & Services

    console.log(`--- Testing Payroll for Jan 2026, Entity ${entityId} ---`);

    // Fetch entity multiplier
    const entRes = db.exec('SELECT performance_multiplier FROM entities WHERE id = ?', [entityId]);
    const multiplier = toObjects(entRes)[0]?.performance_multiplier || 0;
    console.log("Entity Multiplier:", multiplier);

    // Fetch employees for this entity
    const empRes = db.exec('SELECT * FROM employees WHERE entity_id = ?', [entityId]);
    const employees = toObjects(empRes);
    console.log(`Found ${employees.length} employees.`);

    for (const emp of employees) {
        // We only care about emp 84 for now since we know he has data
        if (emp.id !== 84 && emp.id !== 160) continue;

        const otResult = db.exec(
            `SELECT 
                SUM(ot_hours) as total_ot, 
                SUM(ot_1_5_hours) as total_ot_1_5, 
                SUM(ot_2_0_hours) as total_ot_2_0,
                SUM(performance_credit) as total_perf_credit
            FROM timesheets 
            WHERE employee_id = ? 
            AND date LIKE ?`,
            [emp.id, `${year}-${String(month).padStart(2, '0')}-%`]
        );
        const otData = toObjects(otResult)[0];

        console.log(`Emp: ${emp.full_name} (ID: ${emp.id})`);
        console.log(`  Raw Stats: OT1.5=${otData.total_ot_1_5}, OT2.0=${otData.total_ot_2_0}, Perf=${otData.total_perf_credit}`);

        const workingHoursPerWeek = emp.working_hours_per_week || 44;
        const basicSalary = emp.basic_salary || 0;

        const hourlyRate = (12 * basicSalary) / (52 * workingHoursPerWeek);
        const overtimeRate = hourlyRate * 1.5;

        console.log(`  Basic: ${basicSalary}, Hourly: ${hourlyRate.toFixed(4)}, OTRate: ${overtimeRate.toFixed(4)}`);

        const payslip = processEmployeePayroll(emp, {
            overtimeHours: otData.total_ot || 0,
            ot15Hours: otData.total_ot_1_5 || 0,
            ot20Hours: otData.total_ot_2_0 || 0,
            overtimeRate: overtimeRate,
            performanceCredits: otData.total_perf_credit || 0,
            performanceMultiplier: multiplier,
            totalWorkingDaysInMonth: 22,
            year: year
        });

        console.log(`  Result -> OT Pay: ${payslip.overtime_pay}, Perf Allow: ${payslip.performance_allowance}, Gross: ${payslip.gross_pay}`);
    }
}

runTest().catch(console.error);
