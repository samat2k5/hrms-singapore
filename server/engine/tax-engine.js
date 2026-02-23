/**
 * IRAS Tax Engine — Singapore Income Tax Estimation
 * Year of Assessment 2026 (income earned in 2025)
 */

// Progressive tax brackets for tax residents
const TAX_BRACKETS = [
    { upTo: 20000, rate: 0, cumTax: 0 },
    { upTo: 30000, rate: 0.02, cumTax: 0 },
    { upTo: 40000, rate: 0.035, cumTax: 200 },
    { upTo: 80000, rate: 0.07, cumTax: 550 },
    { upTo: 120000, rate: 0.115, cumTax: 3350 },
    { upTo: 160000, rate: 0.15, cumTax: 7950 },
    { upTo: 200000, rate: 0.18, cumTax: 13950 },
    { upTo: 240000, rate: 0.19, cumTax: 21150 },
    { upTo: 280000, rate: 0.195, cumTax: 28750 },
    { upTo: 320000, rate: 0.20, cumTax: 36550 },
    { upTo: 500000, rate: 0.22, cumTax: 44550 },
    { upTo: 1000000, rate: 0.23, cumTax: 84150 },
    { upTo: Infinity, rate: 0.24, cumTax: 199150 },
];

// Non-resident flat rate
const NON_RESIDENT_EMPLOYMENT_RATE = 0.15;
const NON_RESIDENT_OTHER_RATE = 0.24;

/**
 * Calculate annual income tax for a resident
 * @param {number} annualIncome - Total chargeable income
 * @returns {number} Annual tax
 */
function calculateResidentTax(annualIncome) {
    if (annualIncome <= 20000) return 0;

    for (let i = 1; i < TAX_BRACKETS.length; i++) {
        const bracket = TAX_BRACKETS[i];
        const prevBracket = TAX_BRACKETS[i - 1];
        if (annualIncome <= bracket.upTo) {
            const taxableInBracket = annualIncome - prevBracket.upTo;
            return bracket.cumTax + (taxableInBracket * bracket.rate);
        }
    }

    // Above highest bracket
    const lastBracket = TAX_BRACKETS[TAX_BRACKETS.length - 1];
    const prevBracket = TAX_BRACKETS[TAX_BRACKETS.length - 2];
    return lastBracket.cumTax + ((annualIncome - prevBracket.upTo) * lastBracket.rate);
}

/**
 * Calculate annual income tax for a non-resident
 * @param {number} annualIncome - Total employment income
 * @returns {number} Annual tax (higher of flat 15% or progressive)
 */
function calculateNonResidentTax(annualIncome) {
    const flatTax = annualIncome * NON_RESIDENT_EMPLOYMENT_RATE;
    const progressiveTax = calculateResidentTax(annualIncome);
    return Math.max(flatTax, progressiveTax);
}

/**
 * Estimate monthly tax for payroll purposes
 * @param {Object} params
 * @param {number} params.annualIncome - Projected annual income
 * @param {string} params.taxResidency - 'Resident' or 'Non-Resident'
 * @returns {Object} Tax breakdown
 */
function estimateMonthlyTax({ annualIncome, taxResidency = 'Resident' }) {
    const annualTax = taxResidency === 'Resident'
        ? calculateResidentTax(annualIncome)
        : calculateNonResidentTax(annualIncome);

    return {
        annualIncome,
        annualTax: Math.round(annualTax * 100) / 100,
        monthlyTax: Math.round((annualTax / 12) * 100) / 100,
        effectiveRate: annualIncome > 0 ? Math.round((annualTax / annualIncome) * 10000) / 100 : 0,
        taxResidency,
    };
}

module.exports = { estimateMonthlyTax, calculateResidentTax, calculateNonResidentTax, TAX_BRACKETS };
