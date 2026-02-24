# Walkthrough - Branding with ezyHR Logo

I have branded the application using the local [ezyhr-logo.png](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/ezyhr-logo.png) file across all appropriate locations.

## Changes Made

### 1. Favicon Update
Updated [index.html](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/index.html) to use the [ezyhr-logo.png](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/ezyhr-logo.png) as the browser favicon, replacing the placeholder emoji.

### 2. Payslip Branding
Enhanced the payslip experience in [Payslip.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx):
- **UI**: Added the ezyHR logo to the header of the itemized payslip view (`h-24`).
- **PDF**: Integrated the logo into the generated PDF header using `jspdf` (`65, 32`).

### 3. Sidebar & Mobile Header (Refined Final)
Balanced brand presence in [Layout.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/components/Layout.jsx):
- **Sidebar Logo Area**: Reduced to `h-32` with a `h-24` logo (-40% reduction).
- **Tagline**: Integrated look with zero gap.

### 4. Login Page (Refined Final)
Clean entry in [Login.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Login.jsx):
- **Logo Size**: Reduced to `h-48` (-40% reduction).
- **Tagline**: Integrated look with zero gap.

### 6. SPR Graduated CPF Rates
Implemented full compliance for Singapore Permanent Residents:
- **Graduated Rates**: Automatically detects if a PR is in their 1st or 2nd year and applies reduced rates.
- **Full Rate Override**: Added a "Full Rate Agreed" option in the employee profile for voluntary full contribution.
- **UI Integration**: New fields in [EmployeeForm.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeForm.jsx) for PR Status Start Date and Agreement.
- **Engine Logic**: Updated [cpf-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/cpf-engine.js) with 2026 graduated rate tables.

![SPR Fields in UI](C:\Users\mathi\.gemini\antigravity\brain\4affa4e7-fee0-419d-a165-0fdeabf1fbbe\pr_cpf_fields_context_1771927373646.png)

### 7. MOM-Compliant Payroll Deductions
Transitioned from a 22-day average to exact MOM formulations for salary deductions.

- **Dynamic Working Days**: Calculations now consider the actual number of days in a month, subtracting Sundays (Rest Days) and Public Holidays. (e.g., May 2026 has 25 working days).
- **MOM Formula**: [(Basic Salary / Working Days in Month) * Absence Days](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx#394-404).
- **UI Management**: Updated 'Working Days Per Week' with a standard dropdown (3, 3.5, 4, 4.5, 5, 5.25, 5.5, 6) and set the default to **5.5**.

![MOM Work-Week Settings](/C:/Users/mathi/.gemini/antigravity/brain/4affa4e7-fee0-419d-a165-0fdeabf1fbbe/employment_details_fields_1771929065909.png)
*Employment Details section now features the refined work-week settings.*

---

## Localization
- Added support for **Bengali**, **Telugu**, and **Hindi** language options in employee profiles.
- Standardized terminology across the system (e.g., "Singapore Citizen", "SPR").

### UI Components
- [x] **Favicon**: Verified link in [index.html](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/index.html).
- [x] **Login**: Logo correctly sized and centered.
- [x] **Sidebar**: Logo fits perfectly in the side navigation.
- [x] **Payslip**: Logo adds a professional touch to the itemized view.

### Document Generation
- [x] **PDF Export**: Verified the logic for embedding the image in `jspdf`.

> [!NOTE]
> The logo uses `object-contain` to ensure it maintains its aspect ratio regardless of the container size.
