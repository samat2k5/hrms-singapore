# Comprehensive HRMS Enhancements

## Goal
To implement five major feature requests:
1. Issue Key Employment Terms (KET) in PDF format.
2. Enable customized Allowance(s) & Deduction(s) per employee.
3. Track and calculate OT Rates at 1.5x and 2.0x, displayed on the Payslip.
4. Attach a detailed timesheet attendance report alongside the issued Payslip PDF.
5. Define Payday and Payment Mode across the system.

## Proposed Changes

### Database Migrations
#### [NEW] server/db/migrate-features.js
- `employees`: Add `custom_allowances` (TEXT JSON), `custom_deductions` (TEXT JSON), `payment_mode` (TEXT).
- `employee_kets`: Add `custom_allowances` (TEXT JSON), `custom_deductions` (TEXT JSON).
- `timesheets`: Add `ot_1_5_hours` (REAL), `ot_2_0_hours` (REAL).
- `payroll_runs`: Add `payment_date` (DATE).
- `payslips`: Add `ot_1_5_hours`, `ot_2_0_hours`, `ot_1_5_pay`, `ot_2_0_pay`, `custom_allowances` (TEXT JSON), `custom_deductions` (TEXT JSON), `payment_mode` (TEXT).

### Backend Changes
#### [MODIFY] server/routes/employees.js & server/routes/kets.js
- Update POST/PUT endpoints to accept and save the JSON strings for customized allowances and deductions, and strings for payment_mode.

#### [MODIFY] server/routes/attendance.js
- Parse the Excel upload to intelligently split OT into 1.5x (normal days) and 2.0x (Sundays/Public Holidays), or accept an explicit `Rate` column and map to the new database fields.

#### [MODIFY] server/engine/payroll-engine.js
- **Custom Modifiers**: Parse `custom_allowances` and `custom_deductions` JSON. Iterate through the key-value pairs to add them to `totalAllowances` and `otherDeductions`, keeping them itemized for the payslip response.
- **OT Rates**: Calculate the hourly rate [(12 * Basic) / (52 * 44)](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/App.jsx#60-85). Compute exact pay for `ot_1_5_hours * 1.5 * rate` and `ot_2_0_hours * 2.0 * rate`.

#### [MODIFY] server/routes/payroll.js
- In the `POST /api/payroll/run` endpoint, accept `payment_date` to store in the `payroll_runs` table.
- In the `GET /api/payroll/payslip/:id` endpoint, fetch the corresponding monthly `timesheets` for that explicit employee and return them in the payload so the frontend can generate the detailed attendance table.

### Frontend Changes
#### [NEW] KET PDF Generation
- In [client/src/pages/EmployeeKETs.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeKETs.jsx), add a "Generate PDF" button that utilizes `jspdf` to create a standard, formatted Key Employment Terms document.

#### [MODIFY] client/src/pages/Employees.jsx
- Update the UI to include a "Custom Settings" tab or section where users can add arbitrary Key-Value pairs for Allowances and Deductions, and select a Payment Mode (e.g., Bank Transfer, GIRO, Cash, Cheque).

#### [MODIFY] client/src/pages/Payroll.jsx & Payslip Generation
- **Payment Date**: Add a date picker when initiating a "Run Payroll" action.
- **Payslip PDF Details**: Update the existing `jspdf` Payslip generation script to:
  - Display the exact breakdown of "1.5x Overtime" and "2.0x Overtime".
  - Parse and list individual "Custom Allowances" and "Custom Deductions".
  - Display the "Payment Mode" and "Payment Date".
  - Utilize `jspdf-autotable` to append an entire second page titled "Detailed Timesheet Attendance" using the `timesheets` data returned by the backend API.

## Verification Plan

### Manual Verification
1. **Employees**: Edit an employee, set "Handphone Allowance" to $50, select "GIRO", and save.
2. **Attendance**: Upload an attendance sheet and verify that it correctly parses 1.5x and 2.0x hours.
3. **Payroll Run**: Set "Payment Date" to today, run payroll.
4. **Payslip PDF**: Download the payslip. Ensure the PDF correctly itemizes the allowances, explicitly shows the OT breakdown, and successfully attaches the detailed timesheet on page 2.
5. **KET PDF**: Navigate to Employee KETs and successfully issue and download the KET document as a PDF.
