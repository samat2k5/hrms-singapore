/**
 * CPF Engine — Singapore Central Provident Fund Calculation
 * Based on 2026 rates (effective 1 Jan 2026)
 */

// CPF contribution rates by year and age band
const CPF_RATES_BY_YEAR = {
    2025: [
        { minAge: 0, maxAge: 55, employerRate: 0.17, employeeRate: 0.20, totalRate: 0.37 },
        { minAge: 55, maxAge: 60, employerRate: 0.155, employeeRate: 0.17, totalRate: 0.325 },
        { minAge: 60, maxAge: 65, employerRate: 0.12, employeeRate: 0.115, totalRate: 0.235 },
        { minAge: 65, maxAge: 70, employerRate: 0.09, employeeRate: 0.075, totalRate: 0.165 },
        { minAge: 70, maxAge: 999, employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125 },
    ],
    2026: [
        { minAge: 0, maxAge: 55, employerRate: 0.17, employeeRate: 0.20, totalRate: 0.37 },
        { minAge: 55, maxAge: 60, employerRate: 0.16, employeeRate: 0.18, totalRate: 0.34 },
        { minAge: 60, maxAge: 65, employerRate: 0.125, employeeRate: 0.125, totalRate: 0.25 },
        { minAge: 65, maxAge: 70, employerRate: 0.09, employeeRate: 0.075, totalRate: 0.165 },
        { minAge: 70, maxAge: 999, employerRate: 0.075, employeeRate: 0.05, totalRate: 0.125 },
    ]
};

// OA/SA/MA allocation rates by age band (remains largely consistent or follows slightly different rules, adhering to standard tables)
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

// CPF contribution rates for SPR 1st Year (Graduated/Graduated)
const SPR1_RATES = [
    { minAge: 0, maxAge: 55, employerRate: 0.04, employeeRate: 0.05, totalRate: 0.09 },
    { minAge: 55, maxAge: 60, employerRate: 0.04, employeeRate: 0.05, totalRate: 0.09 },
    { minAge: 60, maxAge: 65, employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085 },
    { minAge: 65, maxAge: 999, employerRate: 0.035, employeeRate: 0.05, totalRate: 0.085 },
];

// CPF contribution rates for SPR 2nd Year (Graduated/Graduated)
const SPR2_RATES = [
    { minAge: 0, maxAge: 55, employerRate: 0.09, employeeRate: 0.15, totalRate: 0.24 },
    { minAge: 55, maxAge: 60, employerRate: 0.09, employeeRate: 0.125, totalRate: 0.215 },
    { minAge: 60, maxAge: 65, employerRate: 0.07, employeeRate: 0.075, totalRate: 0.145 },
    { minAge: 65, maxAge: 999, employerRate: 0.05, employeeRate: 0.05, totalRate: 0.10 },
];

const OW_CEILINGS_BY_YEAR = {
    2025: 7400,
    2026: 8000
};
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

function getSPRYear(prStatusStartDate, referenceDate = new Date()) {
    if (!prStatusStartDate) return 3; // Default to Year 3+ (Full)
    const startDate = new Date(prStatusStartDate);
    const months = (referenceDate.getFullYear() - startDate.getFullYear()) * 12 + (referenceDate.getMonth() - startDate.getMonth());
    if (months < 12) return 1;
    if (months < 24) return 2;
    return 3;
}

function getRateBand(age, year = 2026, nationality = 'Singapore Citizen', sprYear = 3, isFullRateAgreed = false) {
    const rates = CPF_RATES_BY_YEAR[year] || CPF_RATES_BY_YEAR[2026];
    if (nationality === 'Singapore Citizen' || sprYear >= 3 || isFullRateAgreed) {
        return rates.find(r => age > r.minAge && age <= r.maxAge) || rates[0];
    }
    if (sprYear === 1) {
        return SPR1_RATES.find(r => age > r.minAge && age <= r.maxAge) || SPR1_RATES[0];
    }
    if (sprYear === 2) {
        return SPR2_RATES.find(r => age > r.minAge && age <= r.maxAge) || SPR2_RATES[0];
    }
    return rates.find(r => age > r.minAge && age <= r.maxAge) || rates[0];
}

function getAllocationBand(age) {
    return CPF_ALLOCATION.find(r => age > r.minAge && age <= r.maxAge) || CPF_ALLOCATION[0];
}

/**
 * Calculate CPF contributions for an employee
 */
function calculateCPF({
    dateOfBirth,
    ordinaryWages,
    additionalWages = 0,
    ytdOrdinaryWages = 0,
    ytdAdditionalWages = 0,
    nationality = 'Singapore Citizen',
    prStatusStartDate = null,
    isFullRateAgreed = false,
    referenceDate = new Date(),
    year = null
}) {
    const calcYear = year || referenceDate.getFullYear();
    const age = getAge(dateOfBirth, referenceDate);
    const sprYear = (nationality === 'SPR') ? getSPRYear(prStatusStartDate, referenceDate) : 3;
    const rateBand = getRateBand(age, calcYear, nationality, sprYear, isFullRateAgreed);
    const allocBand = getAllocationBand(age);
    const owCeiling = OW_CEILINGS_BY_YEAR[calcYear] || 8000;

    // Cap OW at ceiling
    const cappedOW = Math.min(ordinaryWages, owCeiling);

    // Additional wages ceiling
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
    const ma = totalContrib - oa - sa;

    return {
        age,
        calcYear,
        sprYear,
        isFullRate: (nationality === 'Singapore Citizen' || sprYear >= 3 || isFullRateAgreed),
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

module.exports = { calculateCPF, getAge, getSPRYear, OW_CEILINGS_BY_YEAR, ANNUAL_CEILING };
