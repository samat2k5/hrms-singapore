# Enhancing Leave Management (Policy Compliance)

This plan outlines the enhancements to the Leave Management module to support flexible policies, MOM-compliant proration (excluding unpaid leave), unearned leave allowances, and year-end unutilized leave processing.

## Proposed Changes

### Database Schema
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Update `leave_policies` table:
    - Add `carry_forward_max`: REAL (Limit for unutilized leave carry-over)
    - Add `carry_forward_expiry_months`: INTEGER (Usually 6 or 12 months)
    - Add `encashment_allowed`: BOOLEAN (If unused leave can be paid out)
- Update `leave_balances` table:
    - Add `carried_forward`: REAL (Leave balance brought from previous year)

### Backend Logic
#### [MODIFY] [leave.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js)
- **Refactor [computeDynamicBalances](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js#28-158)**:
    - Incorporate `carried_forward` balance.
    - Adjust "earned leave" calculation to exclude periods of Unpaid Leave or AWOL (by checking `leave_requests` and `attendance_remarks`).
    - Support unutilized leave policy enforcement (forfeiture/carry-over logic based on year-end dates).
- **Update `POST /api/leave/request`**:
    - Relax balance validation: Allow submission if `days <= entitled` (full year amount) instead of just `earned`, provided it is approved by a manager.
    - Tag requests as "Unearned" if they exceed the current `earned` balance for UI visibility.

### Frontend UI
#### [MODIFY] [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx)
- Update the Leave Balance display to show **Entitled**, **Earned**, **Taken**, and **Available** (including carried forward).
- Add clear indicators when a request is using "Unearned" leave.
- Enhance the Management view to allow setting the Year-End policy (Carry forward vs Encash vs Forfeit).

## Verification Plan

### Automated Tests
- Run `test-leave-calc.js` (NEW) to verify proration logic with various join dates and unpaid leave scenarios.

### Manual Verification
1. **Unearned Leave Request**:
    - Submit a leave request for more days than currently "earned" but less than the annual "entitled" amount.
    - Verify the request is submitted successfully and tagged appropriately.
2. **Unpaid Leave Impact**:
    - Record a 1-month Unpaid Leave for an employee.
    - Verify that the "Earned Annual Leave" for that employee decreases proportionally.
3. **Carry Forward Logic**:
    - Simulate a year-end transition and verify that the correct amount of unused leave is moved to the next year's `carried_forward` column.
