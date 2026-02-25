# Fix Leave Management Bugs and Isolation

This plan addresses the "not rectified" issue by fixing critical calculation bugs and reinforcing data isolation.

## Proposed Changes

### Backend: Leave Management Logic
#### [MODIFY] [leave.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js)
- Parse `year` parameter as integer in all routes to prevent `year + 1 === 20261` bug.
- Update `Sick Leave` string to `Medical Leave` to match the database and ensure proper MOM proration.
- Fix potentially missing `req.user.entityId` by adding a fallback or stricter check.

### Frontend: Resilient Filtering
#### [MODIFY] [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx)
- Re-add the secondary entity filter in the [load](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx#28-52) function. While the backend isolates data, a frontend safety layer prevents UI glitches during entity transitions.
- Ensure the `year` passed to API calls is always a number.

## Verification Plan

### Automated Tests
- Run `node server/test-leave-api.js` to verify that balances are returned correctly as numbers (not NaN).
- Run `node server/test-leaks.js` to re-verify isolation.

### Manual Verification
- Log in and switch between Entity 1 and Entity 2.
- Verify that "Leave Balances" show correct numbers and that "Medical Leave" proration follows MOM rules (5, 8, 11, 14 days based on service).
