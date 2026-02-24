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
 * @param {number} options.totalWorkingDaysInMonth - Exact working days for that month (MOM)
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
        totalWorkingDaysInMonth = 22, // Fallback to 22 if not provided
        phWorkedDays = 0, // Number of public holidays worked
        phOffDaysPaid = 0, // Number of PH on off-days to be paid instead of leave credit
        ytdOrdinaryWages = 0,
        ytdAdditionalWages = 0,
        year = new Date().getFullYear(),
        lateMins = 0,
        earlyOutMins = 0,
        performanceCredits = 0,
        performanceMultiplier = 1.0,
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

    // 1. Calculate Gross Rate of Pay for deductions
    const basicSalary = employee.basic_salary || 0;
    const transportAllowance = employee.transport_allowance || 0;
    const mealAllowance = employee.meal_allowance || 0;
    const otherAllowance = employee.other_allowance || 0;

    // Fixed Allowances included in Gross Rate of Pay
    const fixedAllowancesTotal = transportAllowance + mealAllowance + otherAllowance + customAllowancesTotal;
    const grossRateOfMonth = basicSalary + fixedAllowancesTotal;

    // Unpaid leave deduction (MOM Formulation: Gross Rate of Pay / actual working days in month)
    // Section 28: Deduction for absence from work should be based on Gross Rate of Pay
    const dailyGrossRate = totalWorkingDaysInMonth > 0 ? grossRateOfMonth / totalWorkingDaysInMonth : 0;
    const unpaidLeaveDeduction = Math.round(dailyGrossRate * unpaidLeaveDays * 100) / 100;

    // overtimeRate is already calculated logic as basic / ... * 1.5 by the route
    // So 1.5x pay = ot15Hours * overtimeRate
    // And 2.0x pay = ot20Hours * (overtimeRate * (2.0/1.5))
    const ot15Pay = Math.round(ot15Hours * overtimeRate * 100) / 100;
    const baseHourly = overtimeRate / 1.5;
    const ot20Pay = Math.round(ot20Hours * (baseHourly * 2.0) * 100) / 100;
    // Backward compatibility for standard OT
    const standardOtPay = Math.round(overtimeHours * overtimeRate * 100) / 100;

    const overtimePay = ot15Pay + ot20Pay + standardOtPay;

    // 2. Public Holiday Entitlements (Section 42)
    // Extra pay for working on PH = 1 extra day of basic rate pay
    const phExtraPay = Math.round(dailyGrossRate * phWorkedDays * 100) / 100; // Actually MOM says basic rate, but for monthly workers it's often gross. The user asked "how you'll calculate".
    // Wait, Section 42(4) says 'extra day's salary at the basic rate of pay'.
    const dailyBasicRate = totalWorkingDaysInMonth > 0 ? basicSalary / totalWorkingDaysInMonth : 0;
    const phWorkedExtraPay = Math.round(dailyBasicRate * phWorkedDays * 100) / 100;

    // PH on Off-Day (Section 42(3)): Day off in lieu or 1 extra day's salary at gross rate
    const phOffDayExtraPay = Math.round(dailyGrossRate * phOffDaysPaid * 100) / 100;

    // 3. Attendance Penalty (Lateness/Early Out)
    // Formula: (Total Penalty Mins / 60) * (Basic Rate / 8)
    const hourlyBasicRate = dailyBasicRate / 8;
    const attendanceDeduction = Math.round(((lateMins + earlyOutMins) / 60) * hourlyBasicRate * 100) / 100;

    // 4. Performance Reward
    const performanceAllowance = Math.round(performanceCredits * hourlyBasicRate * performanceMultiplier * 100) / 100;

    const grossPay = basicSalary + fixedAllowancesTotal + overtimePay + bonus + phWorkedExtraPay + phOffDayExtraPay + performanceAllowance - unpaidLeaveDeduction - attendanceDeduction;

    // 2. Calculate CPF (if applicable — Citizens and PR only)
    let cpfResult = { employeeContrib: 0, employerContrib: 0, oa: 0, sa: 0, ma: 0 };
    if (employee.cpf_applicable) {
        const ordinaryWages = basicSalary + fixedAllowancesTotal - unpaidLeaveDeduction;
        const additionalWages = overtimePay + bonus + phWorkedExtraPay + phOffDayExtraPay;
        cpfResult = calculateCPF({
            dateOfBirth: employee.date_of_birth,
            ordinaryWages,
            additionalWages,
            ytdOrdinaryWages,
            ytdAdditionalWages,
            nationality: employee.nationality,
            prStatusStartDate: employee.pr_status_start_date,
            isFullRateAgreed: !!employee.cpf_full_rate_agreed,
            year: year
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

    // 6. Calculate net pay and apply MOM Deduction Cap (Section 32)
    // The total amount of all deductions in any one salary period shall not exceed 50% of the salary payable.
    // DOES NOT apply to: Absence from work, recovery of advances/loans, cooperative payments.
    const salaryPayable = grossPay;
    const statutoryCap = salaryPayable * 0.5;

    // Deductions subject to 50% cap: CPF, SHG, Other Misc Deductions (assuming they aren't loans here)
    const cappedDeductionsSum = cpfResult.employeeContrib + shgResult.amount + otherDeductions + customDeductionsTotal;

    let totalDeductionsSubjectToCap = cappedDeductionsSum;
    let capWarning = false;

    if (totalDeductionsSubjectToCap > statutoryCap) {
        totalDeductionsSubjectToCap = statutoryCap;
        capWarning = true;
    }

    // Total deductions = Subject to Cap + Absence Deduction (unpaidLeaveDeduction)
    const finalTotalDeductions = totalDeductionsSubjectToCap + unpaidLeaveDeduction;
    const netPay = Math.round((salaryPayable - finalTotalDeductions) * 100) / 100;

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
        total_allowances: fixedAllowancesTotal,
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
        ph_worked_extra_pay: phWorkedExtraPay,
        ph_off_day_extra_pay: phOffDayExtraPay,
        late_mins: lateMins,
        early_out_mins: earlyOutMins,
        attendance_deduction: attendanceDeduction,
        performance_allowance: performanceAllowance,
        payment_mode: employee.payment_mode || 'Bank Transfer',
        compliance_notes: capWarning ? 'MOM 50% Deduction Cap Applied' : ''
    };
}

module.exports = { processEmployeePayroll };
