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
        overtimeRate = 0,
        bonus = 0,
        otherDeductions = 0,
        unpaidLeaveDays = 0,
        ytdOrdinaryWages = 0,
        ytdAdditionalWages = 0,
    } = options;

    // 1. Calculate gross pay
    const basicSalary = employee.basic_salary || 0;
    const transportAllowance = employee.transport_allowance || 0;
    const mealAllowance = employee.meal_allowance || 0;
    const otherAllowance = employee.other_allowance || 0;
    const totalAllowances = transportAllowance + mealAllowance + otherAllowance;

    // Unpaid leave deduction (daily rate = basic / working days)
    const workingDaysPerMonth = 22; // Average
    const dailyRate = basicSalary / workingDaysPerMonth;
    const unpaidLeaveDeduction = Math.round(dailyRate * unpaidLeaveDays * 100) / 100;

    const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;
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
    const totalDeductions = cpfResult.employeeContrib + shgResult.amount + otherDeductions;
    const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

    return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        employee_code: employee.employee_id,
        basic_salary: basicSalary,
        transport_allowance: transportAllowance,
        meal_allowance: mealAllowance,
        other_allowance: otherAllowance,
        total_allowances: totalAllowances,
        overtime_hours: overtimeHours,
        overtime_pay: overtimePay,
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
        other_deductions: otherDeductions,
        tax_monthly_estimate: taxResult.monthlyTax,
        net_pay: netPay,
    };
}

module.exports = { processEmployeePayroll };
