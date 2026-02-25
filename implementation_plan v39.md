# Fix 0 Records in Leave Dashboard

The Leave dashboard is currently showing 0 records because the frontend safety filter is removing all fetched records. This is happening because the `leave_balances` objects returned by the backend are missing the `entity_id` key, causing the comparison `b.entity_id == currentEntityId` to always be false.

## Proposed Changes

### [Backend] Leave API
#### [MODIFY] [leave.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/leave.js)
- Explicitly ensure `entity_id` is included in the objects returned by [computeDynamicBalances](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/debug-zero.js#13-28).
- Use an alias `e.entity_id AS entity_id` in the SQL query to avoid any potential ambiguity.

### [Frontend] Leave Dashboard
#### [MODIFY] [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/Leave.jsx)
- Update the frontend filter to be more resilient (e.g., using `parseFloat` or `Number` comparison).
- Add a fallback to show records if `entity_id` is missing (as a temporary measure while verifying the fix).

## Verification Plan
### Browser Testing
- Re-run the browser subagent to verify that `Fetched emps`, `bals`, and `After local filter` counts are consistent and non-zero.
- Verify that only records for the active entity are shown.
