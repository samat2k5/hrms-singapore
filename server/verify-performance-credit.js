const { getDb, saveDb } = require('./db/init');
const { processEmployeePayroll } = require('./engine/payroll-engine');

async function verifyPerformanceCredit() {
    console.log('--- Performance Hour Credit System Verification ---');
    const db = await getDb();

    // 1. Setup Test Data
    const entityId = 1;
    const employeeId = 1;
    const siteId = 1;

    // Set Performance Multiplier for Site
    console.log('[1] Setting performance multiplier (1.5x) for Site 1...');
    db.run(`UPDATE site_working_hours SET performance_multiplier = 1.5 WHERE site_id = ?`, [siteId]);

    // Insert/Update Timesheet with Performance Credit
    const testDate = '2024-05-15';
    console.log(`[2] Inserting test timesheet for ${testDate} with 2.0 performance credits...`);
    db.run(`
        INSERT INTO timesheets (entity_id, employee_id, date, in_time, out_time, shift, performance_credit, source_file)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(entity_id, employee_id, date) DO UPDATE SET performance_credit = excluded.performance_credit
    `, [entityId, employeeId, testDate, '0800', '1700', 'Day', 2.0, 'test_perf.xlsx']);

    // 2. Aggregate Credits for Month
    console.log('[3] Aggregating monthly credits...');
    const month = '05';
    const year = '2024';
    const otResult = db.exec(
        `SELECT 
            COALESCE(SUM(performance_credit), 0) as total_perf_credit
        FROM timesheets 
        WHERE employee_id = ? 
        AND strftime('%Y', date) = ? 
        AND strftime('%m', date) = ?`,
        [employeeId, year, month]
    );
    const totalPerfCredit = otResult[0].values[0][0];
    console.log(`   - Total Performance Credits: ${totalPerfCredit}`);

    // 3. Calculation Check
    const empResult = db.exec('SELECT * FROM employees WHERE id = ?', [employeeId]);
    const emp = {};
    empResult[0].columns.forEach((col, idx) => emp[col] = empResult[0].values[0][idx]);

    // Hourly Rate Calculation (Manual check based on 2200 basic, 44h week)
    // (12 * 2200) / (52 * 44) = 11.538...
    const hourlyBasicRate = (12 * (emp.basic_salary || 2200)) / (52 * 44 * 8); // This is not quite right in payroll.js, let's check payroll-engine.js logic

    // In payroll-engine.js:
    // dailyBasicRate = basicSalary / totalWorkingDaysInMonth
    // hourlyBasicRate = dailyBasicRate / 8
    const totalWorkingDaysInMonth = 22;
    const dailyBasicRate = (emp.basic_salary || 2200) / totalWorkingDaysInMonth;
    const engineHourlyRate = dailyBasicRate / 8;
    const multiplier = 1.5;

    console.log(`[4] Running Payroll Engine calculation...`);
    const result = processEmployeePayroll(emp, {
        performanceCredits: totalPerfCredit,
        performanceMultiplier: multiplier,
        totalWorkingDaysInMonth
    });

    const expectedAllowance = Math.round(totalPerfCredit * engineHourlyRate * multiplier * 100) / 100;
    console.log(`   - Expected Allowance: ${expectedAllowance}`);
    console.log(`   - Engine Result: ${result.performance_allowance}`);

    if (Math.abs(result.performance_allowance - expectedAllowance) < 0.01) {
        console.log('✅ Calculation Verified!');
    } else {
        console.error('❌ Calculation Mismatch!');
    }

    saveDb();
    console.log('--- Verification Complete ---');
}

verifyPerformanceCredit().catch(console.error);
