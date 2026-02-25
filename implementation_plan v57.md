# Implement Restricted Admin Role (Operations Admin)

The goal is to create a role that has administrative powers over operations (Payroll, Attendance, Employees, Reports) but is strictly restricted from sensitive "Master Data" such as Entities, Users, and Roles.

## Proposed Changes

### Database Initialization
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add `Operations Admin` to the default `user_roles` seeding logic.
- Ensure the `permissions` array for this role is correctly initialized (though current logic relies mostly on role name strings).

### Frontend Navigation
#### [MODIFY] [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx)
- Update the "Master Data" menu visibility check to include `Operations Admin`.
- The `adminOnly` flag in `masterItems` will already handle hiding sensitive masters if the role is not `Admin`.

### Verification Plan
#### Automated Verification
- Verify that a user with `Operations Admin` role:
    - CAN access Dashboard, Employees, Leave, Attendance, Payroll, Reports.
    - CAN access non-sensitive Master Data (Sites, Customers, Departments, Groups, etc.).
    - CANNOT access sensitive Master Data (Entities, Users, Roles, Leave Policies).
    - CANNOT access backend routes for sensitive data (simulated via API calls).

#### Manual Verification
- Create a test user `ops_manager` with role `Operations Admin`.
- Login as `ops_manager` and verify character count/existence of restricted menu items.
