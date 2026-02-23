# Implementation Plan - Multi-Entity Constraints & Overtime

Implement nationality-based entity employment limits, an employee transfer mechanism, and MOM-compliant overtime calculation via timesheet import.

## Proposed Changes

### [Component] Database Layer
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add `national_id` (TEXT) to the `employees` table schema to uniquely identify individuals across entities. This must be a required field for Resident statuses (Citizen/PR) and optional/ignored for others.
- Create a new `timesheets` table schema: `id, entity_id, employee_id, date, ot_hours, created_at, UNIQUE(entity_id, employee_id, date)`.

### [Component] Backend APIs
#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Update `POST /` and `PUT /:id` to accept `national_id`.
- Add validation in `POST /` and `PUT /:id`: Count active records with the same `national_id` across all entities. 
  - If `Citizen` or `PR`: Enforce that the `national_id` exists. Reject if count >= 2. Alert (via response flag) if already in 1 entity.
  - If `Foreigner` (others): Implicitly restricted to 1 entity (the one they are created in). No cross-entity `national_id` tracking needed.
- Add `POST /:id/transfer`: Endpoint to clone an employee, their KETs, and leave balances to a new entity ID, marking the old record as 'Transferred' or inactive.

#### [NEW] [timesheets.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/timesheets.js)
- Add `POST /upload`: Fast-csv/multer parsing endpoint to accept timesheet data and UPSERT into `timesheets` table.
- Add `GET /`: Retrieve timesheets for a given month/entity.

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- Update `POST /run` to automatically fetch total `ot_hours` for each employee in the period from the `timesheets` table.
- Calculate `overtimeRate` dynamically using MOM formula: [(12 * basic_salary) / (52 * working_hours_per_week)](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/App.jsx#59-83) (fallback to 44 hours).

### [Component] Frontend Pages
#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)
- Add `national_id` input to the form.
- Add a "Transfer" button to the employee actions, opening a modal to select the target entity.
- Handle API warnings (e.g., "User is already in 1 entity") gracefully using toast.

#### [MODIFY] [Payroll.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payroll.jsx)
- Add a "Import Timesheet" button opening an upload modal.

#### [NEW] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Add endpoints `transferEmployee`, `uploadTimesheet`, `getTimesheets`.

## Verification Plan
1. **Employment Limits**: Attempt to create a Citizen in 3 entities (should fail). Attempt to create a Foreigner in 2 entities (should fail).
2. **Transfer**: Transfer an employee to another entity; verify leave balances are preserved in the new entity.
3. **Timesheets**: Upload a CSV with 10 OT hours. Run payroll and verify 1.5x basic pay logic is applied to the gross calculations.
