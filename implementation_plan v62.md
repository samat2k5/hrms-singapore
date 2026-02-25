# Payroll Fields Reorganization

Rename and reorganize compensation/deduction fields in the Employee Form for better consistency and alignment with MOM requirements.

## Proposed Changes

### Database Migration
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/db/init.js)
- Add migration logic for `other_deduction` column in the `employees` table.
- Ensure `meal_allowance` and `other_allowance` are preserved (we will reuse these columns but rename labels in UI, or might add new specific ones if requested, but for now, I'll add `other_deduction` and use existing ones for the others as requested).

### Backend API
#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/employees.js)
- Update code to handle `other_deduction` in creation and update routes.

### Frontend UI
#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/EmployeeForm.jsx)
- Update labels:
    - "Meal Allowance" -> "Fixed Allowance"
    - "Other Allowance" -> "Accommodation Deduction"
- Add new field: "Other Deduction" (`other_deduction`).
- Adjust grid layout to accommodate 4 fields in the compensation row (likely changing to a 4-column grid for that specific section or using `md:col-span`).

## Verification Plan

### Automated Tests
- Run database migration check.
- Verify `FormData` submission in browser console.

### Manual Verification
- Open Employee Form and verify labels are updated.
- Create/Edit an employee and verify the values are saved correctly in the database.
- Check Payroll calculation logic (if applicable) to ensure "Deductions" are subtracted instead of added.
