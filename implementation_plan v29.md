# MOM & Employment Act Compliance Plan (2026)

This plan ensures the HRMS follows strict Singapore Ministry of Manpower (MOM) regulations and the Employment Act, specifically for salary formulations, deductions, OT limits, and leave entitlements.

## Proposed Changes

### [Component: Payroll Engine]
#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- **Gross Rate of Pay Deduction**: Update the `unpaidLeaveDeduction` calculation to use [(basicSalary + fixedAllowances) / totalWorkingDaysInMonth](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx#394-404).
- **Deduction Cap**: Implement a check to ensure total deductions (excluding absence and loans) do not exceed 50% of total wages, as per Section 32 of the Employment Act.
- **OT Rate Base**: Verify that OT is calculated on **Basic Rate of Pay** (currently it is).

### [Component: Payroll Route]
#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- **OT Hour Limit**: Add a validation/warning if an employee exceeds 72 hours of overtime in a single month.
- **Gross Rate vs Basic Rate**: Ensure variables passed to the engine clearly distinguish between Basic and Gross.

### [Component: Leave & Entitlements]
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- **Paternity Leave**: Increase default entitlement to 4 weeks (20 working days) for 2026.
- **Shared Parental Leave**: Add "Shared Parental Leave" as a new leave type with 10 weeks entitlement (50 working days) for 2026.
- **Annual Leave Progression**: Ensure the seeding reflects the "7 days min, +1 per year" statutory rule.

### [Component: Employee Profile]
#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx)
- **KETs**: Ensure fields like `working_hours_per_day` are visible and saved correctly, as they impact the hourly rate divisor.

## Verification Plan

### Automated Verification
- Run a test script to verify that:
    - 1-day absence deduction correctly includes fixed allowances in the calculation.
    - Total deductions are capped at 50% if they exceed it.
    - A warning is logged/returned for >72 OT hours.

### Manual Verification
- Verify in the UI that new leave types (Shared Parental) appear with correct balances.
- Check that the payslip reflects the new deduction amounts.
