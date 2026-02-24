# Revise KET Based on MOM Template

Align the Key Employment Terms (KET) implementation with the official MOM template requirements as specified in [wr-kets-with-description-english.pdf](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/wr-kets-with-description-english.pdf).

## Proposed Changes

### Database Schema
We need to add several fields to the `employee_kets` table to capture all mandatory MOM details.

#### [NEW] [migrate-ket-mom-alignment.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/db/migrate-ket-mom-alignment.js)
Create a migration script to add the following columns to `employee_kets`:
- `main_duties` (TEXT)
- `employment_end_date` (DATE)
- `working_hours_start_end` (TEXT) - e.g. "9am to 6pm"
- `break_hours` (TEXT) - e.g. "1 hour lunch break"
- `salary_payment_date` (TEXT) - e.g. "2nd of every month"
- `overtime_payment_date` (TEXT)
- `gross_rate_of_pay` (REAL)
- `other_salary_components` (TEXT) - For items like "Productivity incentive"
- `cpf_payable` (BOOLEAN)
- `probation_start_date` (DATE)
- `probation_end_date` (DATE)

### Backend API

#### [MODIFY] [kets.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/kets.js)
- Update PUT route to synchronize shared fields back to the `employees` table:
    - `job_title` -> `designation`
    - `basic_salary` -> `basic_salary`
    - `employment_start_date` -> `date_joined`
    - `employee_grade` -> `employee_grade`
    - `cpf_payable` -> `cpf_applicable`
    - `custom_allowances` -> `custom_allowances`
    - `custom_deductions` -> `custom_deductions`
- Implement robust parameter validation and return the updated data directly in the response to prevent race conditions.
- Add explicit boolean conversion for `cpf_payable` (1/0).

# UI Redesign: "Dleohr" Theme (Light & Dark)

Transition the application to a modern, professional purple-themed UI as shown in the Dleohr mockup images.

## User Review Required

> [!IMPORTANT]
> This change will significantly alter the application's appearance, moving away from the cyan glassmorphism theme to a more standard enterprise Dashboard aesthetic (Purple-primary).

## Proposed Changes

### [Component Name] Theme & Global Styles

#### [MODIFY] [index.css](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/index.css)
- Implement CSS variables for `--brand-primary`, `--bg-main`, `--bg-sidebar`, `--text-main`, etc.
- Define `.light` and `.dark` variable overrides.
- Update global component classes (`.glass-card`, `.input-glass`, etc.) to match the new design.
- Use Inter font and professional shadows.

#### [NEW] [ThemeContext.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/context/ThemeContext.jsx)
- Create a context to manage `theme` (light/dark) state and persist it to `localStorage`.
- Provide a `toggleTheme` function.

### [Component Name] Application Shell

#### [MODIFY] [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/components/Layout.jsx)
- Update Sidebar to match the white/purple (light) or dark/purple (dark) design.
- Add a **Top Bar** component (or integrate into Layout) containing:
    - Search Keyword input.
    - Theme Toggle (Sun/Moon).
    - User Profile dropdown.
    - Breadcrumbs (Home / Page).

#### [MODIFY] [App.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/App.jsx)
- Wrap the application in the `ThemeProvider`.

### [Component Name] Pages & Components

#### [MODIFY] [Dashboard.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/Dashboard.jsx)
- Update stat cards to match the new circular progress and iconography.
- Refine chart colors to align with the purple theme.

#### [MODIFY] [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/EmployeeForm.jsx)
- Update form sections and card heights to match the clean mockup.
- Ensure input focus states use the brand purple.

## Verification Plan

### Automated Tests
- N/A (Visual changes)

### Manual Verification
1.  Verify the application starts in the default theme (matching mockups).
2.  Toggle between Light and Dark modes and ensure all elements (text, buttons, cards, tables) are legible and aesthetically pleasing.
3.  Check responsiveness of the new Sidebar and Top Bar.
- Generate KET PDF and verify it matches the "Annex B" layout from the PDF provided by the user.
- Verify status banners still work (overdue checks).
