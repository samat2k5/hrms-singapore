/**
 * Master Payroll Engine — Orchestrates all compliance calculations
 */

const { calculateCPF } = require('./cpf-engine');
const { calculateSDL } = require('./sdl-engine');
const { calculateSHG } = require('./shg-engine');
const { estimateMonthlyTax } = require('./tax-engine');

/**
 * Process payroll for a single employee
 * @param {Object} employee - Employee record from DB
 * @param {Object} options - Additional payroll inputs
 * @param {number} options.overtimeHours - OT hours for the month
 * @param {number} options.overtimeRate - Hourly OT rate
 * @param {number} options.bonus - Any bonus payment
 * @param {number} options.otherDeductions - Other deductions
 * @param {number} options.unpaidLeaveDays - Number of unpaid leave days
 * @param {number} options.ytdOrdinaryWages - Year-to-date OW
 * @param {number} options.ytdAdditionalWages - Year-to-date AW
 * @returns {Object} Complete payslip data
 */
function processEmployeePayroll(employee, options = {}) {
    const {
        overtimeHours = 0,
        ot15Hours = 0,
        ot20Hours = 0,
        overtimeRate = 0, // 1.5x rate essentially
        bonus = 0,
        otherDeductions = 0,
        unpaidLeaveDays = 0,
        ytdOrdinaryWages = 0,
        ytdAdditionalWages = 0,
    } = options;

    // Parse custom allowances and deductions
    let customAllowances = {};
    let customDeductions = {};
    let customAllowancesTotal = 0;
    let customDeductionsTotal = 0;

    try {
        if (employee.custom_allowances) {
            customAllowances = JSON.parse(employee.custom_allowances);
            Object.values(customAllowances).forEach(v => customAllowancesTotal += Number(v) || 0);
        }
        if (employee.custom_deductions) {
            customDeductions = JSON.parse(employee.custom_deductions);
            Object.values(customDeductions).forEach(v => customDeductionsTotal += Number(v) || 0);
        }
    } catch (e) {
        console.error("Error parsing custom modifiers:", e);
    }

    // 1. Calculate gross pay
    const basicSalary = employee.basic_salary || 0;
    const transportAllowance = employee.transport_allowance || 0;
    const mealAllowance = employee.meal_allowance || 0;
    const otherAllowance = employee.other_allowance || 0;
    const totalAllowances = transportAllowance + mealAllowance + otherAllowance + customAllowancesTotal;

    // Unpaid leave deduction (daily rate = basic / working days)
    const workingDaysPerMonth = 22; // Average
    const dailyRate = basicSalary / workingDaysPerMonth;
    const unpaidLeaveDeduction = Math.round(dailyRate * unpaidLeaveDays * 100) / 100;

    // overtimeRate is already calculated logic as basic / ... * 1.5 by the route
    // So 1.5x pay = ot15Hours * overtimeRate
    // And 2.0x pay = ot20Hours * (overtimeRate * (2.0/1.5))
    const ot15Pay = Math.round(ot15Hours * overtimeRate * 100) / 100;
    const baseHourly = overtimeRate / 1.5;
    const ot20Pay = Math.round(ot20Hours * (baseHourly * 2.0) * 100) / 100;
    // Backward compatibility for standard OT
    const standardOtPay = Math.round(overtimeHours * overtimeRate * 100) / 100;

    const overtimePay = ot15Pay + ot20Pay + standardOtPay;
    const grossPay = basicSalary + totalAllowances + overtimePay + bonus - unpaidLeaveDeduction;

    // 2. Calculate CPF (if applicable — Citizens and PR only)
    let cpfResult = { employeeContrib: 0, employerContrib: 0, oa: 0, sa: 0, ma: 0 };
    if (employee.cpf_applicable) {
        const ordinaryWages = basicSalary + totalAllowances - unpaidLeaveDeduction;
        const additionalWages = overtimePay + bonus;
        cpfResult = calculateCPF({
            dateOfBirth: employee.date_of_birth,
            ordinaryWages,
            additionalWages,
            ytdOrdinaryWages,
            ytdAdditionalWages,
        });
    }

    // 3. Calculate SDL (employer cost, but tracked per employee)
    const sdlResult = calculateSDL(grossPay);

    // 4. Calculate SHG
    const shgResult = calculateSHG({
        race: employee.race,
        monthlyWages: grossPay,
        nationality: employee.nationality,
    });

    // 5. Estimate monthly income tax
    const annualGross = grossPay * 12;
    const annualCPFEmployee = cpfResult.employeeContrib * 12;
    const taxableIncome = annualGross - annualCPFEmployee; // CPF is tax deductible
    const taxResult = estimateMonthlyTax({
        annualIncome: Math.max(0, taxableIncome),
        taxResidency: employee.tax_residency,
    });

    // 6. Calculate net pay
    const totalDeductions = cpfResult.employeeContrib + shgResult.amount + otherDeductions + customDeductionsTotal;
    const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

    return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        employee_code: employee.employee_id,
        basic_salary: basicSalary,
        transport_allowance: transportAllowance,
        meal_allowance: mealAllowance,
        other_allowance: otherAllowance,
        custom_allowances: JSON.stringify(customAllowances),
        custom_deductions: JSON.stringify(customDeductions),
        total_allowances: totalAllowances,
        overtime_hours: overtimeHours,
        ot_1_5_hours: ot15Hours,
        ot_2_0_hours: ot20Hours,
        overtime_pay: overtimePay,
        ot_1_5_pay: ot15Pay,
        ot_2_0_pay: ot20Pay,
        bonus,
        unpaid_leave_days: unpaidLeaveDays,
        unpaid_leave_deduction: unpaidLeaveDeduction,
        gross_pay: Math.round(grossPay * 100) / 100,
        cpf_employee: cpfResult.employeeContrib,
        cpf_employer: cpfResult.employerContrib,
        cpf_oa: cpfResult.oa,
        cpf_sa: cpfResult.sa,
        cpf_ma: cpfResult.ma,
        sdl: sdlResult.sdl,
        shg_deduction: shgResult.amount,
        shg_fund: shgResult.fund,
        other_deductions: otherDeductions + customDeductionsTotal,
        tax_monthly_estimate: taxResult.monthlyTax,
        net_pay: netPay,
        payment_mode: employee.payment_mode || 'Bank Transfer'
    };
}

module.exports = { processEmployeePayroll };
