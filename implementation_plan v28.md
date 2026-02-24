# Implementation Plan - Branding with ezyHR Logo

Brand the application using the local [ezyhr-logo.png](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/ezyhr-logo.png) file to ensure a consistent corporate identity across the UI and generated documents.

## Proposed Changes

### [Component: Logo Size Reduction - Round 6]

#### [MODIFY] [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx)
- Sidebar: Reduce header container to `h-32`. Reduce logo to `h-24` (-40% from Round 4).
- Mobile Header: Ensure logo is suitably sized (around `h-16`).

#### [MODIFY] [Login.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Login.jsx)
- Reduce Login logo to `h-48` (-40% from Round 4).

### [Component: SPR Graduated CPF Rates]

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js) & DB Migration
- Add `pr_status_start_date` (DATE) to `employees` table.
- Add `cpf_full_rate_agreed` (BOOLEAN) to `employees` table.

#### [MODIFY] [cpf-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js)
- Define `SPR_GRADUATED_RATES` for Year 1 and Year 2.
- Update [calculateCPF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js#82-138) to accept `nationality`, `dateJoined` (or better `prStatusStartDate`), and `isFullRateAgreed`.
- Logic: If PR and Year < 3 and NOT `isFullRateAgreed`, use graduated rates.

### [Component: Nationality & Language Updates]

#### [MODIFY] [cpf-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js)
- Change 'Citizen' checks to 'Singapore Citizen'.
- Change 'PR' checks to 'SPR'.

#### [MODIFY] [shg-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/shg-engine.js)
- Update nationality checks (used to determine if CPF and thus SHG applies).

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Update `employees` table default `nationality` to 'Singapore Citizen'.
- Update initial employee seed data to use new labels.

#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx)
- Update `Nationality` options: ['Singapore Citizen', 'SPR', 'Foreigner'].
- Add to `Language` options: ['Bengali', 'Telugu', 'Hindi'].
- Update conditional logic for SPR fields from `form.nationality === 'PR'` to `form.nationality === 'SPR'`.

#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)
- Update badge logic for 'Singapore Citizen' and 'SPR'.

#### [EXECUTE] Migration Script
- Run SQL update: `UPDATE employees SET nationality = 'Singapore Citizen' WHERE nationality = 'Citizen'`
- Run SQL update: `UPDATE employees SET nationality = 'SPR' WHERE nationality = 'PR'`

### [Component: MOM Payroll Formulations]

#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- Update [processEmployeePayroll](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js#10-154) to accept `totalWorkingDaysInMonth`.
- Calculate `unpaidLeaveDeduction` using: [(Monthly Basic / Total Working Days) * Days Unpaid](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx#394-404).

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js) (Route)
- Implement `getWorkingDaysInMonth(year, month, restDay, holidays)` helper.
- Pass the calculated total to the engine.

#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx)
- Ensure "Working Days Per Week" and "Rest Day" are prominent in the Employment section.

## Verification Plan
- Create a test script for a specific month (e.g., May 2026).
- Manually count working days for a 5-day week employee (excluding Sundays and PH).
- Verify the deduction amount matches MOM's calculation.

## Verification Plan

### Automated Tests
- None.

### Manual Verification
1. **Login Page**: Verify the logo is much more prominent.
2. **Sidebar**: Verify the logo is larger but still fits the design.
3. **Payslip UI**: Verify the logo is clearly visible in the header.
4. **Payslip PDF**: Export and verify the logo looks appropriately sized in the document.
