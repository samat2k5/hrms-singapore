# MOM & Employment Act Compliance Plan (2026)

This plan ensures the HRMS follows strict Singapore Ministry of Manpower (MOM) regulations and the Employment Act, specifically for salary formulations, deductions, OT limits, and leave entitlements.

## Proposed Changes

### [Component: Payroll Engine]
#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- **Gross Rate of Pay Deduction**: Update the `unpaidLeaveDeduction` calculation to use [(basicSalary + fixedAllowances) / totalWorkingDaysInMonth](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/test-logins.js#28-37).
- **Deduction Cap**: Implement a check to ensure total deductions (excluding absence and loans) do not exceed 50% of total wages, as per Section 32 of the Employment Act.
- **OT Rate Base**: Verify that OT is calculated on **Basic Rate of Pay** (currently it is).

### [Component: Payroll Route]
#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- **OT Hour Limit**: Add a validation/warning if an employee exceeds 72 hours of overtime in a single month.
- **Gross Rate vs Basic Rate**: Ensure variables passed to the engine clearly distinguish between Basic and Gross.

### [Component: MOM Rate Calculations]
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add `working_hours_per_week` REAL DEFAULT 44 to `employees` table.

#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx)
- Add "Normal Working Hours Per Week" input (default 44).
- Add read-only displays for:
    - **Daily Basic Rate**: [(12 * Basic) / (52 * Working Days Per Week)](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/test-logins.js#28-37)
    - **Hourly Basic Rate**: [(12 * Basic) / (52 * Working Hours Per Week)](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/test-logins.js#28-37)
    - **1.5x OT Rate**: `Hourly Basic Rate * 1.5`
    - **2.0x OT Rate**: `Hourly Basic Rate * 2`

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- Use `emp.working_hours_per_week` directly for OT calculations instead of deriving it.

#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Include `working_hours_per_week` in INSERT and UPDATE.

### [Component: Leave & Entitlements]
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- **Paternity Leave**: Increase default entitlement to 4 weeks (20 working days) for 2026.
- **Shared Parental Leave**: Add "Shared Parental Leave" as a new leave type with 10 weeks entitlement (50 working days) for 2026.
- **Annual Leave Progression**: Ensure the seeding reflects the "7 days min, +1 per year" statutory rule.

### [Component: Employee Profile]
#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx)
- **KETs**: Ensure fields like `working_hours_per_day` are visible and saved correctly, as they impact the hourly rate divisor.

### [Component: Public Holiday Entitlements]
#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- **Extra PH Pay**: Add `phWorkedDays` and `phOffDaysPaid` inputs.
- Calculate `phExtraPay = phWorkedDays * (basicSalary / totalWorkingDaysInMonth)`.
- Calculate `phOffDayPay = phOffDaysPaid * (grossRateOfMonth / totalWorkingDaysInMonth)`.

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- **Detection**: Check if holidays fall on an employee's `rest_day`.
- **Leave Credit**: If PH falls on off-day and not paid, increment `Annual Leave` balance for the employee.
- **Worked PH**: Detect if an employee has timesheet entries on a holiday date.

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Ensure default leave types include "PH in Lieu" or similar if preferred (we'll use credit to Annual Leave for now as per user preference).

### [Component: IRAS Compliance 2026]
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Fix `iras_forms` table schema to match route usage: `year`, `data_json`, `status`, `version`.
- Add `benefits_in_kind` and `share_options` tables to support Appendix 8A and 8B.

#### [MODIFY] [iras.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/iras.js)
- **AIS-API 2.0**: Implement `/export-ais-json/:year` to generate REST JSON for IRAS submission.
- **Appendices**: Update generation logic to include data from `benefits_in_kind` and `share_options`.
- **IR8S Removal**: Update CPF excess logic to refer to IR8A inclusion.

#### [MODIFY] [Reports.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Reports.jsx)
- Add UI sections for managing **Benefits-in-Kind** and **Stock Options**.
- Implement **Itemized IR8A PDF** generation using a standard mock-up template.
- Add "Download AIS JSON" button.

#### [NEW] [iras-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/iras-engine.js)
- Helper for mapping DB records to IRAS JSON/PDF structures.

## Verification Plan

### Automated Verification
- Run a test script to verify that:
    - 1-day absence deduction correctly includes fixed allowances in the calculation.
    - Total deductions are capped at 50% if they exceed it.
    - A warning is logged/returned for >72 OT hours.

### Manual Verification
- Verify in the UI that new leave types (Shared Parental) appear with correct balances.
- Check that the payslip reflects the new deduction amounts.
