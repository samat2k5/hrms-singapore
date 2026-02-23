# Enhancing the Employee & User Data Models

The user has requested two major enhancements to the system:
1. **User Module Enhancement:** A user needs to be assigned to multiple related/non-related entities with appropriate employee group(s).
2. **Employee Form Enhancement:** Collect comprehensive ID document details (NRIC, FIN, Passport, Driving License, Work Pass, Skill Passes, including issue/expiry dates) directly on the Employee forms instead of strictly relying on the separate documents page.

## User Review Required

- **Multi-Entity Architecture:** 
  - Currently, the application is strictly a single-tenant system. To implement "multiple entities," we need to determine if we are introducing a new `Entity` or `Company` table, or if "entities" just mean multiple arrays of `employee_group` mapped to some identifier.
  - ***Assumption:*** I will introduce an `Entity` concept to the database. The `users` table will be updated to establish a many-to-many relationship with `Entities`, where a user can have specific `roles` and `managed_groups` per entity.
  - Please confirm if this approach is correct or if "entities" simply refers to different company branches within the same database file!
  
- **Employee Documents in Form:**
  - I will add new fields to the `employees` table (or handle them dynamically) for the primary ID types (NRIC/FIN/etc.) and their issue/expiry dates, so they are part of the core employee creation/edit flow. We will keep the `employee_documents` table to store multiple passes simultaneously, but the frontend form will collect the primary ones directly.
  - Could you confirm if saving them during the `POST /api/employees` route by chaining into the `employee_documents` table is what you had in mind?

## Proposed Changes

### Database & Backend
#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Create an `entities` table ([id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/context/AuthContext.jsx#5-40), `name`, `uen`).
- Create a `user_entity_roles` table to map users to entities with specific roles and managed groups.
- Alter `employees` table to include an `entity_id` foreign key.
- Alter `employee_documents` table to include a `file_path` column to store the path to the scanned document/image.

#### [MODIFY] [auth.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/middleware/auth.js)
- Update middleware to expect and validate an active `entity_id` context in the headers.

#### [MODIFY] [employees.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/employees.js)
- Update GET, POST, PUT routes to handle the `entity_id` and accept a `documents` array payload to seamlessly create primary documents during employee creation.

#### [MODIFY] [documents.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/documents.js)
- Add `multer` to handle file uploads for document images/scans.
- Update POST route to accept `multipart/form-data` and save the uploaded file to a local `uploads/` directory, saving the path in the database.

#### [MODIFY] [users.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/users.js)
- Create or update the users route to manage assigning users to multiple entities and employee groups.

### Frontend
#### [MODIFY] [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)
- Expand the add/edit employee modal to include a comprehensive "Documents & Passes" section.
- Allow selection of NRIC, FIN, Passport, Work Passes, etc., with Issue and Expiry Dates.
- Add file upload inputs (`type="file"`) for each document to attach scanned copies/images.
- Refactor the form submission to use `FormData` instead of JSON when documents are included.

#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Update the API wrapper to send the `Entity-Id` header (or similar mechanism) based on the user's currently selected entity context.
- Ensure [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js) can handle `FormData` correctly without explicitly forcing `Content-Type: application/json` headers when uploading files.

#### [NEW] [UsersController.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Users.jsx)
- Build a new view for the Admin to create users and assign them to specific entities and employee groups. Ensure there's an entity switcher context if the user belongs to multiple.

## Verification Plan
### Manual Verification
- Log in as admin, create a new user, and assign them to two different entities with different employee groups.
- Log in as the new user, verify that a context switcher is available and properly filters dashboard and employees to the active entity.
- Open the Add Employee form, fill out the primary details along with Passport and Work Pass issue/expiry dates.
- Save the employee and verify that the data correctly populates the database and is visible when editing the employee.
