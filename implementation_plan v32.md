# Statutory Compliance 2026 (CPF, SHG, SDL)

Ensure the HRMS accurately calculates statutory deductions and contributions for the 2026 tax year, while maintaining backward compatibility for 2025.

## User Review Required

> [!IMPORTANT]
> The CPF Ordinary Wage (OW) ceiling increases to **S$8,000** effective 1 Jan 2026. Payroll runs for 2025 will continue to use the S$7,400 ceiling.

## Proposed Changes

### Payroll Engines

#### [MODIFY] [cpf-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js)
- Refactor the engine to be year-aware.
- Implement OW Ceiling toggle: 2025 (S$7,400) vs 2026 (S$8,000).
- Update Age-Band rates for 2026 (increases for ages 55-65).

#### [MODIFY] [shg-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/shg-engine.js)
- Update **SINDA** tiered contribution rates to match the latest 2026 statutory requirements.
- Ensure CDAC, MBMF, and ECF are aligned with 2026 tiers.

#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- Update [processEmployeePayroll](file:///C:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js#10-191) to accept `year` as a parameter.
- Pass the `year` to [calculateCPF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js#82-138) and [calculateSHG](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/shg-engine.js#57-82).

### Payroll Routes

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- Pass the `year` from the payroll run request (period_year) to the engine.

## Verification Plan

### Automated Tests
- Create a verification script `verify-statutory-2026.js` to test:
    - 2025 vs 2026 CPF OW Ceiling.
    - 2026 CPF Age Band increases.
    - 2026 SINDA tiered contributions.
    - 2026 SDL calculations.

### Manual Verification
- Run a payroll for Dec 2025 and Jan 2026 in the UI.
- Verify the CPF and SHG deductions match the expected values in the payslip view.
