/**
 * CPF Engine — Singapore Central Provident Fund Calculation
 * Based on 2026 rates (effective 1 Jan 2026)
 */

// CPF 2026 contribution rates by age band
const CPF_RATES = [
    { minAge: 0, maxAge: 55, employerRate: 0.17, employeeRate: 0.20, totalRate: 0.37 },
    { minAge: 55, maxAge: 60, employerRate: 0.16, employeeRate: 0.18, totalRate: 0.34 },
    { minAge: 60, maxAge: 65, employerRate: 0.125, employeeRate: 0.125, totalRate: 0.25 },
    { minAge: 65, maxAge: 70, employerRate: 0.09, employeeRate: 0.075, totalRate: 0.165 },
    { minAge: 70, maxAge: 999, employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125 },
];

// OA/SA/MA allocation rates by age band (as % of total wages)
const CPF_ALLOCATION = [
    { minAge: 0, maxAge: 35, oa: 0.2308, sa: 0.0608, ma: 0.0800 },
    { minAge: 35, maxAge: 45, oa: 0.2115, sa: 0.0608, ma: 0.0800 },
    { minAge: 45, maxAge: 50, oa: 0.1915, sa: 0.0608, ma: 0.0800 },
    { minAge: 50, maxAge: 55, oa: 0.1615, sa: 0.0608, ma: 0.1000 },
    { minAge: 55, maxAge: 60, oa: 0.1192, sa: 0.0408, ma: 0.1050 },
    { minAge: 60, maxAge: 65, oa: 0.0369, sa: 0.0231, ma: 0.1050 },
    { minAge: 65, maxAge: 70, oa: 0.0150, sa: 0.0150, ma: 0.1050 },
    { minAge: 70, maxAge: 999, oa: 0.0100, sa: 0.0100, ma: 0.0800 },
];

const OW_CEILING = 8000;  // Monthly Ordinary Wage ceiling (2026)
const ANNUAL_CEILING = 102000; // Annual salary ceiling

function getAge(dateOfBirth, referenceDate = new Date()) {
    const dob = new Date(dateOfBirth);
    let age = referenceDate.getFullYear() - dob.getFullYear();
    const m = referenceDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && referenceDate.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

function getRateBand(age) {
    return CPF_RATES.find(r => age > r.minAge && age <= r.maxAge) || CPF_RATES[0];
}

function getAllocationBand(age) {
    return CPF_ALLOCATION.find(r => age > r.minAge && age <= r.maxAge) || CPF_ALLOCATION[0];
}

/**
 * Calculate CPF contributions for an employee
 * @param {Object} params
 * @param {string} params.dateOfBirth - Employee DOB
 * @param {number} params.ordinaryWages - Monthly ordinary wages (basic + fixed allowances)
 * @param {number} params.additionalWages - Additional wages (bonus, OT) for the month
 * @param {number} params.ytdOrdinaryWages - Year-to-date ordinary wages (for annual ceiling check)
 * @param {number} params.ytdAdditionalWages - Year-to-date additional wages
 * @returns {Object} CPF breakdown
 */
function calculateCPF({ dateOfBirth, ordinaryWages, additionalWages = 0, ytdOrdinaryWages = 0, ytdAdditionalWages = 0 }) {
    const age = getAge(dateOfBirth);
    const rateBand = getRateBand(age);
    const allocBand = getAllocationBand(age);

    // Cap OW at ceiling
    const cappedOW = Math.min(ordinaryWages, OW_CEILING);

    // Additional wages ceiling: Annual ceiling - (12 * OW ceiling if OW >= ceiling, else YTD OW)
    let awCeiling = ANNUAL_CEILING - (ytdOrdinaryWages + cappedOW);
    awCeiling = Math.max(0, awCeiling);
    const cappedAW = Math.min(additionalWages, awCeiling);

    const totalCPFWages = cappedOW + cappedAW;

    // Calculate contributions (round to nearest dollar)
    const employeeContrib = Math.round(totalCPFWages * rateBand.employeeRate);
    const employerContrib = Math.round(totalCPFWages * rateBand.employerRate);
    const totalContrib = employeeContrib + employerContrib;

    // Allocate to OA/SA/MA
    const oa = Math.round(totalCPFWages * allocBand.oa);
    const sa = Math.round(totalCPFWages * allocBand.sa);
    const ma = totalContrib - oa - sa; // Remainder to MA to avoid rounding issues

    return {
        age,
        ordinaryWages: cappedOW,
        additionalWages: cappedAW,
        totalCPFWages,
        employeeRate: rateBand.employeeRate,
        employerRate: rateBand.employerRate,
        employeeContrib,
        employerContrib,
        totalContrib,
        oa: Math.max(0, oa),
        sa: Math.max(0, sa),
        ma: Math.max(0, ma),
    };
}

module.exports = { calculateCPF, getAge, OW_CEILING, ANNUAL_CEILING, CPF_RATES };
