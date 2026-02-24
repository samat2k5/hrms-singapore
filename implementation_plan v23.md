# Revise KET Based on MOM Template

Align the Key Employment Terms (KET) implementation with the official MOM template requirements as specified in [wr-kets-with-description-english.pdf](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/wr-kets-with-description-english.pdf).

## Proposed Changes

### Database Schema
We need to add several fields to the `employee_kets` table to capture all mandatory MOM details.

#### [NEW] [migrate-ket-mom-alignment.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/db/migrate-ket-mom-alignment.js)
Create a migration script to add the following columns to `employee_kets`:
- `main_duties` (TEXT)
- `employment_end_date` (DATE)
- `working_hours_start_end` (TEXT) - e.g. "9am to 6pm"
- `break_hours` (TEXT) - e.g. "1 hour lunch break"
- `salary_payment_date` (TEXT) - e.g. "2nd of every month"
- `overtime_payment_date` (TEXT)
- `gross_rate_of_pay` (REAL)
- `other_salary_components` (TEXT) - For items like "Productivity incentive"
- `cpf_payable` (BOOLEAN)
- `probation_start_date` (DATE)
- `probation_end_date` (DATE)

### Backend API

#### [MODIFY] [kets.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/kets.js)
- Update PUT route to synchronize shared fields back to the `employees` table:
    - `job_title` -> `designation`
    - `basic_salary` -> `basic_salary`
    - `employment_start_date` -> `date_joined`
    - `employee_grade` -> `employee_grade`
    - `cpf_payable` -> `cpf_applicable`
    - `custom_allowances` -> `custom_allowances`
    - `custom_deductions` -> `custom_deductions`
- Implement robust parameter validation and return the updated data directly in the response to prevent race conditions.
- Add explicit boolean conversion for `cpf_payable` (1/0).

### Frontend UI

#### [MODIFY] [EmployeeKETs.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/EmployeeKETs.jsx)
- Update the form state and fields to include:
    - Main Duties and Responsibilities (Textarea)
    - Employment End Date (for fixed-term)
    - Working hours details (Start/End and Break)
    - Salary and Overtime payment dates
    - Gross Rate of Pay
    - Other Salary Components
    - CPF Payable toggle
    - Probation Start and End dates
- Refactor the PDF generation logic ([handleGeneratePDF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeKETs.jsx#151-256)) to include ALL mandatory fields in a layout closer to the MOM template.

## Verification Plan

### Automated Tests
- Run migration and verify table schema using `sqlite3` or similar.
- Test API GET/PUT using a script or manual triggers.

### Manual Verification
- Edit KET for an employee and save new fields.
- Generate KET PDF and verify it matches the "Annex B" layout from the PDF provided by the user.
- Verify status banners still work (overdue checks).
