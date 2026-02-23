# Pre-Payroll Bulk Adjustments Matrix

## Goal Description
The objective is to allow administrators to perform bulk updates of custom allowances and deductions for a list of employees on a single screen *before* processing the final payroll run.

Currently, the [processEmployeePayroll](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js#10-151) engine safely parses `custom_allowances` and `custom_deductions` JSON payloads directly from an employee's master record. To achieve this bulk capability without complex schema overrides, we will build a "Pre-Processing" staging grid that fetches the active employees for a requested group, allows HR to rapidly input transient monetary values into a matrix, safely commits those values to the employee records, and then immediately triggers the standard payroll routine.

## Proposed Changes

### Backend Module ([server/routes/payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js) & [server/routes/employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js))
#### [NEW] `GET /api/payroll/pre-run` (or use existing `GET /api/employees`)
- No new complex endpoints are required. The frontend can query `GET /api/employees` filtered by active status and chosen `employee_group` to hydrate the matrix.
#### [NEW] `POST /api/employees/bulk-custom`
- Create a dedicated high-performance endpoint to receive an array of employee data.
- Payload: `[{ id: 1, custom_allowances: { "Transport": 50 }, custom_deductions: { "Loan": 100 } }, ...]`
- The endpoint will use a SQL `BEGIN TRANSACTION` block to execute rapid `UPDATE employees SET custom_allowances=?, custom_deductions=? WHERE id=?` queries.

### Frontend Module ([client/src/pages/Payroll.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payroll.jsx))
#### [MODIFY] [Payroll.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payroll.jsx)
- Re-design the "Process New Payroll" card. Instead of a 1-click `Run Payroll` execution, clicking "Initialize Run" transitions the view into the **Pre-Processing Matrix Panel**.
- **The Matrix Panel**:
  - Automatically fetches all active employees belonging to the selected [Group](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#107-109).
  - Maps rows for every employee with their `Basic Salary` statically displayed.
  - Generates interactive input cells allowing the rapid input of:
    - **Custom Allowance Value** & **Custom Allowance Label** (e.g. `150`, `Performance Bonus`)
    - **Custom Deduction Value** & **Custom Deduction Label** (e.g. `50`, `Uniform Fee`)
  - A bottom action bar containing **"Finalize & Run Payroll"**.
- When "Finalize & Run Payroll" is clicked:
  1. The UI dispatches the `POST /api/employees/bulk-custom` route, forcefully updating the master DB records with the values within the matrix.
  2. The UI then instantaneously dispatches the existing `POST /api/payroll/run` endpoint, guaranteeing the engine parses the newly injected custom values.
  
### State & API Integration ([client/src/services/api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js))
#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Generate `updateBulkCustomModifiers(records)` binding.

## Verification Plan
### Manual Verification
1. Access `PayrollProcessing`. Select the `General` group.
2. Click "Initialize Run". Observe the matrix populate with `General` employees.
3. For Employee A, inject an allowance of `$500` labeled `Performance`.
4. For Employee B, inject a deduction of `$50` labeled `Laptop Recovery`.
5. Click "Finalize & Run Payroll". 
6. Open their respective Payslips and assert that Employee A has `$500 Performance` inside `Custom Allowances` and Employee B has `$50 Laptop Recovery` inside `Custom Deductions`.
