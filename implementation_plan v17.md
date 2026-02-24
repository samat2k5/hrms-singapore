# Making the HRMS Responsive

The current HRMS application is functional but needs to be optimized for viewing on all devices (mobile, tablet, and desktop). We will use Tailwind CSS's built-in responsive modifier classes to achieve a mobile-first design.

## Proposed Changes

### 1. Navigation & Layout ([client/src/components/Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx))
- Convert the sidebar to a collapsible off-canvas menu or bottom navigation bar for mobile screens (`< md` breakpoints).
- Ensure the main content area adjusts its margin/padding when the sidebar is hidden or collapsed.
- Make the top app bar responsive.

### 2. General Page Layouts (`client/src/pages/*`)
- **Grids & Columns**: Change grid layouts to single-column (`grid-cols-1`) on mobile, and multi-column (`md:grid-cols-2`, `lg:grid-cols-3`, or `lg:grid-cols-4`) on larger screens.
- **Padding & Margins**: Reduce padding and margins on mobile devices to maximize screen real estate (`p-4` on mobile vs `md:p-8`).
- **Typography**: Adjust font sizes slightly for mobile if necessary.

### 3. Data Tables & Lists
- Wrap data tables (`<table>`) in a container with `overflow-x-auto` so they can scroll horizontally on small screens without breaking the page layout.
- Alternatively, for key pages, we can transform tables into stacked card views on mobile. For simplicity and maintaining data density, horizontal scroll is the first step.

### 4. Forms & Modals
- Make form grids single-column on mobile.
- Ensure modal dialogs (`fixed inset-0 z-50 flex items-center justify-center`) have proper padding (e.g., `p-4`) so they don't touch the screen edges on mobile, and let their inner containers be `w-full max-w-md` (or larger depending on the form).

## Verification Plan
After updating the components:
1. Start the client application (`npm run dev:client`).
2. Use browser developer tools to toggle device emulation (Mobile, Tablet, Desktop).
3. Verify that the navigation, tables, and forms render correctly without horizontal scrolling of the main window or overflowing elements.

# Adding Contact Info to Employee Profile

The user requested that "Mobile Number", "WhatsApp Number", and "Email" be added to the employee's basic information.

## Proposed Changes

### [Component Name] Database Schema
#### [NEW] server/db/migrate-contact-info.js
- Create a one-off script to add the new columns (`mobile_number`, `whatsapp_number`, `email`) to the existing `employees` table via `ALTER TABLE`.
- We will also need to update [server/db/init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js) to ensure fresh initializations also include these fields in the `CREATE TABLE` statement.

### [Component Name] Backend API
#### [MODIFY] server/routes/employees.js
- **POST /api/employees**: Add the three new fields to the `INSERT` query.
- **PUT /api/employees/:id**: Add the three new fields to the `UPDATE` query.
- Update the clone functionality (`POST /:id/transfer`) to also copy the contact fields to the new entity.

### [Component Name] Frontend
#### [MODIFY] client/src/pages/EmployeeForm.jsx
- Add `mobile_number: ''`, `whatsapp_number: ''`, and `email: ''` to the `emptyEmployee` state.
- Create 3 new `<Field />` inputs under the "Basic Information" section of the form.

# Refactoring Employee Form

The user requested that the Employee creation/editing process be moved from a popup modal into a dedicated "page style" component.

## Proposed Changes
### [Component Name] EmployeeForm (New)
#### [NEW] EmployeeForm.jsx (client/src/pages/EmployeeForm.jsx)
- Will contain the form currently living inside [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx)'s modal.
- Will handle data fetching for a specific employee if editing, utilizing React Router's `useParams`.
- Will also need all the config data fetches currently in [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx) (Departments, Groups, Grades, Sites) to populate the dropdowns.

### [Component Name] App.jsx
#### [MODIFY] App.jsx (client/src/App.jsx)
- Add routes for `/employees/add` and `/employees/edit/:id`.

### [Component Name] Employees.jsx
#### [MODIFY] Employees.jsx (client/src/pages/Employees.jsx)
- Remove the Add/Edit logic, state, and modal UI from the component.
- Update the "+ Add Employee" and "Edit" action buttons to navigate to the new page routes.
