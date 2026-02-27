# Payroll Detail Report Implementation Plan

This plan outlines the steps to create a new "Payroll Detail Report" that provides a detailed breakdown of allowances and deductions per employee, featuring a drill-down UI.

## Proposed Changes

### Backend

#### [MODIFY] [reports.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/reports.js)
- Add a new endpoint `GET /api/reports/payroll-detail/:year/:month` to fetch detailed payslip data for all employees in a given period.
- The query will join `payslips` and `payroll_runs` to filter by `entity_id`, `period_year`, and `period_month`.

### Frontend

#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/services/api.js)
- Add `getPayrollDetail(year, month)` to the `api` object.

#### [MODIFY] [Reports.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/Reports.jsx)
- Add "📝 Payroll Detail" to the `tabs` array.
- Update [fetchReport](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Reports.jsx#42-71) to handle the `detail` tab.
- Implement the "Payroll Detail Report" UI:
    - Main table showing Employee Name, Code, Basic, Total Allowances, Total Deductions, and Net Pay.
    - Drill-down (expandable row) showing a detailed list of:
        - **Allowances**: Transport, Meal, Other, Custom Allowances, Overtime Pay, Bonus, Performance Allowance, NS Makeup.
        - **Deductions**: CPF (EE), SHG, Unpaid Leave, Attendance Penalty, Custom Deductions, Other Deductions.

## Verification Plan

### Automated Verification
- I will create a scratch script `test-payroll-detail-report.js` to verify the new backend endpoint returns the expected data structure.

### Manual Verification
- Expand an employee row in the "Payroll Detail Report" tab and verify all components (allowances/deductions) are visible and correctly formatted.
- Verify the "Excel Master" and "PDF" exports include the new report data (if applicable/requested, otherwise focus on the UI).
- Toggle between different months to ensure the data updates correctly.
