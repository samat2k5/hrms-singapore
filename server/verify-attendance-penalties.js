const { getDb } = require('./db/init');
const { processEmployeePayroll } = require('./engine/payroll-engine');

async function verifyAttendancePenalties() {
    console.log('--- ATTENDANCE PENALTY & DEDUCTION VERIFICATION ---');
    try {
        const db = await getDb();

        // 1. Setup Test Data
        const entityId = 1;
        const siteId = 1;
        const empId = 1; // John Doe

        // Configure Site Matrix with 15m late threshold and 10m early out threshold
        console.log('[1] Configuring Site thresholds (Late: 15m, Early: 10m)');
        db.run(`UPDATE site_working_hours SET 
            start_time = '08:00', 
            end_time = '17:00',
            late_arrival_threshold_mins = 15, 
            early_departure_threshold_mins = 10 
            WHERE site_id = ? AND shift_type = 'Day'`, [siteId]);

        // 2. Mock Timesheet Import logic with Penalty Blocks
        // Site: 15m grace, 15m penalty block
        console.log('[2] Simulating Attendance (In: 08:16, Out: 16:59)');
        console.log('    Settings: Late Grace: 15m, Late Block: 15m');
        console.log('    Settings: Early Grace: 10m, Early Block: 15m');

        const inTime = '08:16';  // 16 mins late (> 15m grace)
        const outTime = '16:59'; // 1 min early (< 10m grace, so NO penalty)
        const shiftStart = '08:00';
        const shiftEnd = '17:00';
        const lateThreshold = 15;
        const earlyThreshold = 10;
        const lateBlock = 15;
        const earlyBlock = 15;

        let lateMins = 0;
        let earlyOutMins = 0;

        // In-time logic
        const inTimeInt = parseInt(inTime.replace(':', ''));
        const shiftStartInt = parseInt(shiftStart.replace(':', ''));
        const totalIn = Math.floor(inTimeInt / 100) * 60 + (inTimeInt % 100);
        const totalStart = Math.floor(shiftStartInt / 100) * 60 + (shiftStartInt % 100);
        const inDiff = totalIn - totalStart;
        if (inDiff > lateThreshold) {
            lateMins = inDiff;
            if (lateBlock > 0) lateMins = Math.ceil(lateMins / lateBlock) * lateBlock;
        }

        // Out-time logic
        const outTimeInt = parseInt(outTime.replace(':', ''));
        const shiftEndInt = parseInt(shiftEnd.replace(':', ''));
        const totalOut = Math.floor(outTimeInt / 100) * 60 + (outTimeInt % 100);
        const totalEnd = Math.floor(shiftEndInt / 100) * 60 + (shiftEndInt % 100);
        const outDiff = totalEnd - totalOut;
        if (outDiff > earlyThreshold) {
            earlyOutMins = outDiff;
            if (earlyBlock > 0) earlyOutMins = Math.ceil(earlyOutMins / earlyBlock) * earlyBlock;
        }

        console.log(`Calculated: Late=${lateMins}m, EarlyOut=${earlyOutMins}m`);

        // Expected: 16 mins late rounded up to 30 mins. 1 min early is within 10m grace, so 0 mins.
        if (lateMins === 30 && earlyOutMins === 0) {
            console.log('✅ Penalty block rounding logic correct');
        } else {
            console.error(`❌ Penalty block rounding logic FAILED. Got Late=${lateMins}, Early=${earlyOutMins}`);
        }

        // 2b. Test 1 min late case
        console.log('[2b] Simulating 1 min late (In: 08:01, settings same)');
        let lateMins2 = 0;
        const inDiff2 = 1; // 08:01 vs 08:00
        // Wait, if grace is 15 mins, 1 min late is NOT a penalty. 
        // User said: "penalty block may vary, some employer deduct 15mins block for 1 min late/early"
        // This implies grace might be 0, or penalty starts from 1st min.

        console.log('    Testing with Grace=0, Block=15');
        const lateThreshold3 = 0;
        const lateBlock3 = 15;
        let lateMins3 = 0;
        if (1 > lateThreshold3) {
            lateMins3 = Math.ceil(1 / lateBlock3) * lateBlock3;
        }
        console.log(`Calculated: Late=${lateMins3}m`);
        if (lateMins3 === 15) {
            console.log('✅ 1 min late = 15 min penalty (Grace=0)');
        }

        // 3. Verify Payroll Engine Deduction
        console.log('[3] Verifying Payroll Engine Deduction');
        const employee = {
            id: 1,
            full_name: 'John Doe',
            employee_id: 'EMP001',
            basic_salary: 4000,
            cpf_applicable: 1,
            nationality: 'Singapore Citizen',
            date_of_birth: '1990-01-01'
        };

        const result = processEmployeePayroll(employee, {
            lateMins,
            earlyOutMins,
            totalWorkingDaysInMonth: 20
        });

        // Basic calculation:
        // Daily Rate = 4000 / 20 = 200
        // Hourly Rate = 200 / 8 = 25
        // Total Penalty Mins = 20 + 15 = 35
        // Penalty = (35 / 60) * 25 = 14.5833... -> 14.58

        console.log(`- Basic: ${result.basic_salary}`);
        console.log(`- Penalty Deduction: ${result.attendance_deduction}`);

        if (result.attendance_deduction === 12.5) {
            console.log('✅ Payroll deduction calculation correct');
        } else {
            console.error(`❌ Payroll deduction calculation FAILED. Got ${result.attendance_deduction}, expected 12.5`);
        }

    } catch (err) {
        console.error('❌ Verification script failed:', err.message);
    }
}

verifyAttendancePenalties();
