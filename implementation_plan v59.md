# Biometric Data Reset

Goal: Provide an option for HR/Admin to reset (nullify) an employee's face enrollment data.

## Proposed Changes

### Backend Logic
#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Add `DELETE /api/employees/:id/face` to:
  - Set `face_descriptor = NULL` for the specified employee.
  - Require authentication and proper entity context.

### Frontend Integration
#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Add `resetEmployeeFace(id)` calling the new `DELETE` endpoint.

#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)
- Add a "Reset Face Data" button (🔄) to the Actions column.
- The button should only be visible for employees who have an active `face_descriptor`.
- Add a confirmation dialog before resetting.

## Verification Plan
### Manual Verification
- Identify an employee with a 🛡️ icon (enrolled).
- Click the 🔄 button.
- Confirm the reset.
- Verify that the 🛡️ icon disappears and the employee can no longer clock-in using face attendance.
