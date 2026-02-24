const { processEmployeePayroll } = require('./engine/payroll-engine');

async function runTests() {
    console.log('--- VERIFYING MOM COMPLIANCE LOGIC (2026) ---');

    const employee = {
        id: 1,
        full_name: 'Compliance Test User',
        basic_salary: 5000,
        transport_allowance: 200,
        meal_allowance: 100,
        other_allowance: 0,
        nationality: 'Singapore Citizen',
        race: 'Chinese',
        cpf_applicable: 1,
        date_of_birth: '1990-01-01'
    };

    const options = {
        unpaidLeaveDays: 1,
        totalWorkingDaysInMonth: 25, // Correct for May 2026
        overtimeHours: 0
    };

    console.log('\nTEST 1: Gross Rate of Pay Deduction');
    console.log(`Basic Salary: $5000, Allowances: $300`);
    const result1 = processEmployeePayroll(employee, options);
    // Expected Deduction: (5000 + 300) / 25 * 1 = 212
    console.log(`Absence Deduction (Gross): $${result1.unpaid_leave_deduction}`);
    if (result1.unpaid_leave_deduction === 212) {
        console.log('✅ Deduction follows Gross Rate of Pay.');
    } else {
        console.error('❌ Expected $212, got $' + result1.unpaid_leave_deduction);
    }

    console.log('\nTEST 2: 50% Deduction Cap');
    // Force a high deduction
    const result2 = processEmployeePayroll(employee, {
        ...options,
        otherDeductions: 3000 // Total ded would be CPF (~1000) + SHG + 3000 > 2500 (50% of gross)
    });
    const totalWages = result2.gross_pay;
    const statutoryLimit = totalWages * 0.5;
    const miscDeductions = result2.cpf_employee + result2.shg_deduction + result2.other_deductions;

    console.log(`Gross Pay: $${result2.gross_pay}`);
    console.log(`Statutory Limit (50%): $${statutoryLimit}`);
    console.log(`Capped Deductions: $${miscDeductions}`);
    console.log(`Compliance Notes: ${result2.compliance_notes}`);

    if (result2.compliance_notes.includes('Cap Applied')) {
        console.log('✅ Deduction cap correctly applied.');
    } else {
        console.error('❌ Deduction cap NOT applied.');
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
}

runTests();
