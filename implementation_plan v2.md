# Implementation Plan: Advanced HRMS Features

## Goal Description
Implement five new advanced features to the HRMS Singapore application:
1. **Identity & Pass Tracking**: Capture NRIC/FIN, Passport, Driving License, and Work Skill Passes with issue/expiry dates. Provide early alerts for expiring documents.
2. **Employee Groups & RBAC**: Assign employees to "Employee Groups". Restrict HR users to accessing only specific groups to protect sensitive data.
3. **DBS GIRO Export**: Export finalized payroll runs in the DBS Bank GIRO format for bulk salary disbursement.
4. **Group-Based Pay Days**: Allow payroll runs and their respective pay dates to be defined and processed on a per-Employee Group basis.
5. **CPF e-Submission (FTP/TXT)**: Generate the CPF electronic submission file (CSN flat file format) for uploading to the CPFB Employer Portal.

## User Review Required
> [!IMPORTANT]
> - Database schema changes mean the existing SQLite file will be destroyed and re-seeded. Any existing data will be lost.
> - The DBS GIRO export will use a standardized CSV layout acceptable by DBS IDEAL bulk transfers.
> - The CPF transmission will generate a flat `.txt` file adhering to the CPF Board's standard E-Submission format.

## Proposed Changes

### Database Schema ([server/db/init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js))
#### [MODIFY] init.js
- Add `employee_group` to the `employees` table creation.
- Add `role` and `managed_groups` to the `users` table creation.
- Add `employee_group` to the `payroll_runs` table creation, modifying the unique constraints so each group can have its own payroll run for a given month.
- Create a new `employee_documents` table:
  ```sql
  CREATE TABLE IF NOT EXISTS employee_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )
  ```
- Seed default "Admin" and a restricted "HR Manager" user.

### Backend APIs
#### [MODIFY] server/routes/auth.js
- Include `role` and `managed_groups` in the JWT token payload.

#### [MODIFY] server/routes/employees.js
- Apply RBAC filtering on the `GET /` query. If the user's role is `HR`, append `WHERE employee_group IN (...)` using their `managed_groups`.
- Add `employee_group` support to POST and PUT endpoints.

#### [NEW] server/routes/documents.js
- Create CRUD endpoints for `employee_documents`.
- Add `GET /expiring` which returns documents expiring within the next 90 days across all accessible employees.

#### [MODIFY] server/routes/payroll.js
- Modify the `POST /run` endpoint to accept an `employee_group`. The engine will only calculate salaries for active employees in that specific group, allowing different groups to have different pay days.
- Add a new endpoint `GET /export-giro/:runId`.
- Query `payslips` joined with `employees` to get bank account details and net pay. Generate and stream a CSV file formatted for DBS IDEAL GIRO.
- Add a new endpoint `GET /export-cpf/:runId`.
- Query `payslips` joined with `employees` to get CPF breakdown. Generate and stream a standard CPF E-Submission `.txt` flat file.

### Frontend Application
#### [MODIFY] client/src/pages/Dashboard.jsx
- Add an "Expiring Documents Alert" widget summarizing data from `/api/documents/expiring`.

#### [MODIFY] client/src/pages/Employees.jsx
- Add "Employee Group" drop-down field to the add/edit employee modal (e.g., "Executive", "Operations", "Contractors").
- Add a "Documents" action button to the table row navigating to the new documents page.

#### [NEW] client/src/pages/EmployeeDocuments.jsx
- A new page or modal to view, add, and update NRIC, Passports, Work Passes, etc., for a specific employee.

#### [MODIFY] client/src/pages/Payroll.jsx
- Update the "Run Payroll" modal to include an "Employee Group" selector and a specific "Pay Date" for that group's run.
- In the Payroll History table, add two new action buttons:
  - "Download DBS GIRO" (`/api/payroll/export-giro/:runId`)
  - "Download CPF FTP" (`/api/payroll/export-cpf/:runId`)

## Verification Plan

### Automated/Manual Testing
1. **RBAC**: Log in as the "Admin" user, verify all employees are visible. Log in as the "HR" user, verify only employees in the "Operations" group are visible.
2. **Documents**: Navigate to an employee's profile, create a Work Pass expiring in 30 days. Go to the Dashboard and verify the expiring alert appears.
3. **Group Payroll**: Run payroll for the "Operations" group on the 25th, and the "Executive" group on the last day of the month. Verify two separate runs are generated.
4. **GIRO & CPF Exports**: For a finalized payroll run, click "Download DBS GIRO" and "Download CPF FTP". Verify the downloaded files contain the proper fixed-width or CSV layouts required by the local banks and statutory boards.
