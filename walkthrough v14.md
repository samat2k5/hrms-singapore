# Walkthrough - IRAS & MOM Compliance 2026

I have implementation comprehensive IRAS Compliance for the 2026 Year of Assessment (Income 2025) and refined MOM-compliant payroll calculations.

---

## IRAS Compliance 2026 (Income 2025)

The HRMS is now fully prepared for **YA 2026** submissions, adhering to the latest IRAS statutory requirements and the mandatory REST JSON API format.

### Key Features:
- **Statutory Forms**: Simplified management for **IR8A**, **Appendix 8A** (Benefits-in-Kind), and **Appendix 8B** (Stock Options).
- **AIS Electronic Submission**: One-click generation of the **AIS-API 2.0 (REST JSON)** payload, required for electronic filing.
- **Itemized PDF Exports**: Professional, IRAS-formatted PDF generation for individual employee records, including all relevant appendices.
- **Amendment Tracking**: Automated version control for IR8A amendments, including guidance for back-year FormSG requirements.

![IRAS Dashboard](C:/Users/mathi/.gemini/antigravity/brain/4affa4e7-fee0-419d-a165-0fdeabf1fbbe/iras_dashboard_2026_1771933253604.png)
*The updated IRAS Compliance Dashboard showing IR8A batch management and AIS-API 2.0 export.*

---

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

### MOM Public Holiday Compliance
Ensured full adherence to MOM Section 42 for Public Holiday compensation.

- **Automatic OT Detection**: The system now automatically detects work performed on Public Holidays via timesheets and applies a **1.0x Basic Rate extra pay** (in addition to normal gross pay).
- **Public Holiday on Off-Day**: 
    - If a PH falls on an employee's rest day (e.g., Sunday), the system now **automatically credits 1 day of Annual Leave** to the employee.
    - Integrated logic into the payroll engine to optionally "Pay in Lieu" (1.0x Gross Rate) if configured.
- **Payslip Transparency**: New fields for `Worked on Public Holiday` and `PH Pay in Lieu` are now visible on digital and PDF payslips.

### MOM Rates & Automatic Calculations
Updated the employee profile to automatically calculate and display statutory MOM rates based on Basic Salary and work-week configuration.

- **Normal Hours Per Week**: Added a configurable field (defaulting to 44 hours) to drive hourly rate precision.
- **Dynamic Rates Panel**:
    - **Daily Basic Rate**: Correctly prorated based on working days/week.
    - **Hourly Basic Rate**: Derived from weekly hours.
    - **OT Rates (1.5x / 2.0x)**: Auto-calculated to show exact pay per OT hour.

![MOM Rate Calculations](C:/Users/mathi/.gemini/antigravity/brain/4affa4e7-fee0-419d-a165-0fdeabf1fbbe/employee_rates_verification_1771931821477.png)
*Auto-calculating rates panel in the Employee Profile ensures transparency and MOM compliance.*

### MOM & Employment Act Compliance (2026)
The payroll system has been strictly aligned with Singapore MOM regulations and the Employment Act for 2026.

- **Gross Rate of Pay (Section 28)**: Deductions for unpaid leave now use the **Gross Rate of Pay** (Basic Salary + Fixed Allowances) as required by MOM.
- **Statutory Deduction Cap (Section 32)**: Implemented a **50% cap** on total deductions per month (excluding absence and loans) to protect employee wages.
- **OT Controls**: Added a system alert for employees exceeding the **72-hour monthly OT limit**.
- **2026 Leave Types**:
    - **Paternity Leave**: Increased to **4 weeks** (24 calendar days).
    - **Shared Parental Leave**: Added new **10-week** entitlement (60 calendar days) effective 2026.
- **Refined Selection**: Standardized 'Working Days Per Week' dropdown and added 'Work Hours Per Day' for accurate hourly rate calculations.

![MOM Compliance UI Update](C:/Users/mathi/.gemini/antigravity/brain/4affa4e7-fee0-419d-a165-0fdeabf1fbbe/.system_generated/click_feedback/click_feedback_1771930886728.png)
*Revised Employment Details section with MOM-standard work-week and hour configurations.*

### 7. MOM-Compliant Payroll Deductions
Transitioned from a 22-day average to exact MOM formulations for salary deductions.

- **Dynamic Working Days**: Calculations now consider the actual number of days in a month, subtracting Sundays (Rest Days) and Public Holidays. (e.g., May 2026 has 25 working days).
- **MOM Formula**: [(Basic Salary / Working Days in Month) * Absence Days](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/test-logins.js#28-37).
- **UI Management**: Updated 'Working Days Per Week' with a standard dropdown (3, 3.5, 4, 4.5, 5, 5.25, 5.5, 6) and set the default to **5.5**.

![MOM Work-Week Settings](C:/Users/mathi/.gemini/antigravity/brain/4affa4e7-fee0-419d-a165-0fdeabf1fbbe/employment_details_fields_1771929065909.png)
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
