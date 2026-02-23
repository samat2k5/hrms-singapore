# Settings Configuration (Entities, Departments, Employee Groups) CRUD

The user has requested the addition of Create, Read, Update, and Delete (CRUD) functionality for:
1. **Entities**
2. **Departments**
3. **Employee Groups**
4. **Holidays (Holiday Master)**

## User Review Required

- **Roles & Permissions:** 
  - Admin users will have the ability to CRUD all of these configuration items.
  - Entities govern the data boundaries. Departments and Employee Groups should be tied to a specific Entity so they don't bleed across different organizations.
  - *Please confirm if HR users should be allowed to manage Departments and Employee Groups within their assigned Entities, or if this should be strictly an Admin feature.* I will proceed assuming Admin-only for Entity creation, and Admin/HR for Department/Group creation.

## Proposed Changes

### Database & Backend
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Create a `departments` table ([id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/context/AuthContext.jsx#5-62), `entity_id`, [name](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/documents.js#74-79), `description`).
- Create an `employee_groups` table ([id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/context/AuthContext.jsx#5-62), `entity_id`, [name](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/documents.js#74-79), `description`).
- Create a `holidays` table ([id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/context/AuthContext.jsx#5-62), `entity_id`, [name](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/documents.js#74-79), [date](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#102-103), `description`).
- Update the seed data to pre-populate these tables if applicable based on the existing dummy data.

#### [MODIFY] [entities.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/entities.js)
- Expand the current GET-only router to include `POST`, `PUT`, and `DELETE` endpoints for Entity management. Restricted to Admin users.
- *Note:* When an Admin creates a new Entity, we automatically assign their user ID to the new Entity in `user_entity_roles` with the 'Admin' role, so they have access to their creation.

#### [NEW] [departments.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/departments.js)
- Implement full REST API endpoints (`GET`, `POST`, `PUT`, `DELETE`) for querying and managing departments specific to the active `Entity-Id` header.

#### [NEW] [employee_groups.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employee_groups.js)
- Implement full REST API endpoints (`GET`, `POST`, `PUT`, `DELETE`) for managing employee groups specific to the active `Entity-Id` header.

#### [NEW] [holidays.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/holidays.js)
- Implement full REST API endpoints (`GET`, `POST`, `PUT`, `DELETE`) for managing company holidays specific to the active `Entity-Id` header.

#### [MODIFY] [index.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/index.js)
- Mount the new `/api/departments`, `/api/employee-groups`, and `/api/holidays` route handlers.

### Frontend
#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Add appropriate request helper functions (`createEntity`, `updateEntity`, `deleteEntity`, `getDepartments`, etc.) to wrap the new endpoints.

#### [NEW] [Settings.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Settings.jsx)
- Create a centralized Settings/Configuration view.
- This page will contain tabs/sections for managing Entities, Departments, Employee Groups, and Holidays depending on the user's role.
- Include tables to list existing items, and modal forms to Add/Edit items securely.

#### [MODIFY] [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx)
- Add a "Settings" link in the sidebar navigation (e.g., ⚙️ Settings) for authorized users to access the new CRUD interfaces.

#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)
- Rather than rendering a free-text input for Department and a hardcoded dropdown for Employee Group, update the form to dynamically fetch and display options from the newly created endpoints based directly on the currently active Entity.

## Verification Plan
### Automated & Manual Testing
1. Navigate to the new Settings page and successfully create a new Entity.
2. Verify it appears in the Layout's Entity Switcher header hook.
3. Switch Context to the specific Entity and add a new Department ("Marketing") and Employee Group ("Part-Timers").
4. Open the Add Employee form and confirm that "Marketing" and "Part-Timers" appear in their respective dropdown lists instead of the global defaults.
5. Test deleting the configurations to ensure constraints hold.
