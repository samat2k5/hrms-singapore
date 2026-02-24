const { calculateCPF, getSPRYear } = require('./engine/cpf-engine');

const DOB = '1990-01-01'; // 36 years old in 2026
const WAGES = 5000;

console.log('--- CPF VERIFICATION (2026 RATES) ---');

// 1. Citizen / PR Year 3 (Standard)
const resStandard = calculateCPF({
    dateOfBirth: DOB,
    ordinaryWages: WAGES,
    nationality: 'Citizen'
});
console.log('Citizen/PR3 (Full):', {
    sprYear: resStandard.sprYear,
    isFullRate: resStandard.isFullRate,
    employer: resStandard.employerContrib,
    employee: resStandard.employeeContrib,
    total: resStandard.totalContrib
});

// 2. PR Year 1 (Graduated)
const resPR1 = calculateCPF({
    dateOfBirth: DOB,
    ordinaryWages: WAGES,
    nationality: 'PR',
    prStatusStartDate: '2025-06-01', // 8 months as PR
    referenceDate: new Date('2026-02-01')
});
console.log('PR Year 1 (Graduated):', {
    sprYear: resPR1.sprYear,
    isFullRate: resPR1.isFullRate,
    employer: resPR1.employerContrib,
    employee: resPR1.employeeContrib,
    total: resPR1.totalContrib
});

// 3. PR Year 1 (Full Rate Agreed)
const resPR1Full = calculateCPF({
    dateOfBirth: DOB,
    ordinaryWages: WAGES,
    nationality: 'PR',
    prStatusStartDate: '2025-06-01',
    isFullRateAgreed: true,
    referenceDate: new Date('2026-02-01')
});
console.log('PR Year 1 (Full Agreed):', {
    sprYear: resPR1Full.sprYear,
    isFullRate: resPR1Full.isFullRate,
    employer: resPR1Full.employerContrib,
    employee: resPR1Full.employeeContrib,
    total: resPR1Full.totalContrib
});

// 4. PR Year 2 (Graduated)
const resPR2 = calculateCPF({
    dateOfBirth: DOB,
    ordinaryWages: WAGES,
    nationality: 'PR',
    prStatusStartDate: '2024-06-01', // 20 months as PR
    referenceDate: new Date('2026-02-01')
});
console.log('PR Year 2 (Graduated):', {
    sprYear: resPR2.sprYear,
    isFullRate: resPR2.isFullRate,
    employer: resPR2.employerContrib,
    employee: resPR2.employeeContrib,
    total: resPR2.totalContrib
});
