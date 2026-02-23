const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'mathi', 'Desktop', 'AntiGravity Demos', 'HRMS Singapore', 'Time Attendance Sheet (benoi) 08-02-2025_sample.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('Sheet Names:', workbook.SheetNames);
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log(`--- Sheet: ${sheetName} ---`);
        console.log(JSON.stringify(rows.slice(0, 15), null, 2));
    });
} catch (error) {
    console.error('Error reading Excel file:', error.message);
}
