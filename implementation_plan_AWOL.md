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
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add "AWOL" to the default `leave_types` in [seedConfigData](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js#831-848).
- Add a migration script to ensure "AWOL" is inserted into `leave_types` if it doesn't already exist.

#### [MODIFY] [leave.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js)
- **Refactor [computeDynamicBalances](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js#28-184)**:
    - Incorporate internal logic to detect "AWOL" leave type ID (to avoid hardcoding ID 8).
    - Update the logic that calculates `total_unpaid` to include requests for **both** "Unpaid Leave" and "AWOL" types.
    - Ensure AWOL requests (like Unpaid Leave) reduce the adjusted service months for proration.
    - Incorporate `carried_forward` balance and support unutilized leave policy enforcement (forfeiture logic).
- **Update `POST /api/leave/request`**:
    - Relax balance validation: Allow submission if `days <= entitled` even if > earned.

### Frontend UI
#### [MODIFY] [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx)
- Update the Leave Balance display to show **Entitled**, **Earned**, **Taken**, and **Available** (including carried forward).
- Add clear indicators when a request is using "Unearned" leave.
- Enhance the Management view to allow setting the Year-End policy (Carry forward vs Encash vs Forfeit).

## Verification Plan

### Automated Tests
- Run [test-leave-calc.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/tests/test-leave-calc.js) (NEW) to verify proration logic with various join dates and unpaid leave scenarios.

### Manual Verification
1. **Unearned Leave Request**:
    - Submit a leave request for more days than currently "earned" but less than the annual "entitled" amount.
    - Verify the request is submitted successfully and tagged appropriately.
2. **Unpaid Leave Impact**:
    - Record a 1-month Unpaid Leave for an employee.
    - Verify that the "Earned Annual Leave" for that employee decreases proportionally.
3. **Carry Forward Logic**:
    - Simulate a year-end transition and verify that the correct amount of unused leave is moved to the next year's `carried_forward` column.
