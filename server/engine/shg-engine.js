/**
 * SHG Engine — Self-Help Group Contribution Calculation
 * Based on employee race/ethnicity and monthly wages
 * Only applicable to Singapore Citizens and Permanent Residents
 */

// CDAC — Chinese Development Assistance Council
const CDAC_RATES = [
    { minWage: 0, maxWage: 2000, amount: 0.50 },
    { minWage: 2000, maxWage: 3500, amount: 1.00 },
    { minWage: 3500, maxWage: 5000, amount: 1.50 },
    { minWage: 5000, maxWage: 7500, amount: 2.00 },
    { minWage: 7500, maxWage: Infinity, amount: 3.00 },
];

// SINDA — Singapore Indian Development Association
const SINDA_RATES = [
    { minWage: 0, maxWage: 1000, amount: 1.00 },
    { minWage: 1000, maxWage: 1500, amount: 3.00 },
    { minWage: 1500, maxWage: 2500, amount: 5.00 },
    { minWage: 2500, maxWage: 4500, amount: 7.00 },
    { minWage: 4500, maxWage: 7500, amount: 9.00 },
    { minWage: 7500, maxWage: 10000, amount: 13.00 },
    { minWage: 10000, maxWage: Infinity, amount: 16.00 },
];

// MBMF — Mosque Building and Mendaki Fund (Malay/Muslim)
const MBMF_RATES = [
    { minWage: 0, maxWage: 1000, amount: 3.00 },
    { minWage: 1000, maxWage: 2000, amount: 4.50 },
    { minWage: 2000, maxWage: 3000, amount: 6.50 },
    { minWage: 3000, maxWage: 4000, amount: 15.00 },
    { minWage: 4000, maxWage: 6000, amount: 19.50 },
    { minWage: 6000, maxWage: 8000, amount: 22.00 },
    { minWage: 8000, maxWage: 10000, amount: 24.00 },
    { minWage: 10000, maxWage: Infinity, amount: 26.00 },
];

// ECF — Eurasian Community Fund
const ECF_RATES = [
    { minWage: 0, maxWage: 1000, amount: 2.00 },
    { minWage: 1000, maxWage: 1500, amount: 4.00 },
    { minWage: 1500, maxWage: 2500, amount: 6.00 },
    { minWage: 2500, maxWage: 4000, amount: 9.00 },
    { minWage: 4000, maxWage: 7000, amount: 12.00 },
    { minWage: 7000, maxWage: 10000, amount: 16.00 },
    { minWage: 10000, maxWage: Infinity, amount: 20.00 },
];

const FUND_MAP = {
    'Chinese': { fund: 'CDAC', rates: CDAC_RATES },
    'Indian': { fund: 'SINDA', rates: SINDA_RATES },
    'Malay': { fund: 'MBMF', rates: MBMF_RATES },
    'Eurasian': { fund: 'ECF', rates: ECF_RATES },
};

/**
 * Calculate SHG contribution
 * @param {Object} params
 * @param {string} params.race - Employee race
 * @param {number} params.monthlyWages - Monthly total wages
 * @param {string} params.nationality - Citizen / PR / Foreigner
 * @returns {Object} SHG breakdown
 */
function calculateSHG({ race, monthlyWages, nationality }) {
    // Only Citizens and PR contribute
    if (nationality === 'Foreigner' || !FUND_MAP[race]) {
        return { fund: 'N/A', amount: 0, applicable: false };
    }

    const { fund, rates } = FUND_MAP[race];
    const tier = rates.find(r => monthlyWages <= r.maxWage) || rates[rates.length - 1];

    return {
        fund,
        amount: tier.amount,
        applicable: true,
        monthlyWages,
        race,
    };
}

module.exports = { calculateSHG, FUND_MAP, CDAC_RATES, SINDA_RATES, MBMF_RATES, ECF_RATES };
