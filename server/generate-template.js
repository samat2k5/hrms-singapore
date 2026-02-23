const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

const data = [
    ["TIME ATTENDANCE SHEET"],
    [""],
    ["INSTRUCTIONS:"],
    ["- Ensure the date format in B4 is exactly DD-MM-YYYY(DAY)"],
    ["- Ensure times are in 24-hour format (e.g., 0800, 1830)"],
    ["- Shift should be 'D' or 'N'"],
    ["- Remarks can include 'LEAVE' or 'M/C' to trigger unpaid leave deductions"],
    [""],
    ["Day & Date : ", "01-02-2025(SATURDAY)"],
    [""],
    ["Emp.No", "Name", "In", "Out", "Shift (D/N)", "Remarks (Piping)"],
    ["EMP001", "Tan Wei Ming", "0800", "1830", "D", ""],
    ["EMP002", "Priya Sharma", "0800", "1730", "D", "HOME LEAVE"],
    ["EMP003", "Ahmad bin Hassan", "2000", "0530", "N", "M/C"]
];

const ws = XLSX.utils.aoa_to_sheet(data);

ws['!cols'] = [
    { wch: 15 }, // Emp.No
    { wch: 25 }, // Name
    { wch: 10 }, // In
    { wch: 10 }, // Out
    { wch: 15 }, // Shift (D/N)
    { wch: 35 }  // Remarks
];

XLSX.utils.book_append_sheet(wb, ws, "M-OFFICE"); // The parser checks all sheets, but 'M-OFFICE' matches a sample name

const outputPath = path.join(__dirname, '../client/public/Attendance_Template.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('Template created at', outputPath);
