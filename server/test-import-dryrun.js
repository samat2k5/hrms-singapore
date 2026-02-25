const XLSX = require('xlsx');

const parseExcelDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
        return new Date((val - 25569) * 86400000).toISOString().split('T')[0];
    }
    return String(val);
};

const normalizeNationality = (val) => {
    if (!val) return 'Citizen';
    const upper = String(val).toUpperCase().trim();
    if (['SINGAPOREAN', 'SINGAPORE CITIZEN', 'SC', 'CITIZEN'].includes(upper)) return 'Citizen';
    if (['SPR', 'PR', 'SINGAPORE PR', 'PERMANENT RESIDENT'].includes(upper)) return 'PR';
    return 'Foreigner';
};

const normalizeGender = (val) => {
    if (!val) return '';
    const u = String(val).toUpperCase().trim();
    if (u === 'MALE' || u === 'M') return 'Male';
    if (u === 'FEMALE' || u === 'F') return 'Female';
    return val;
};

const files = ['HOM_employee_import_list.xlsx', 'HE_employee_import_list.xlsx'];

files.forEach(file => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FILE: ${file}`);
    console.log('='.repeat(60));

    const wb = XLSX.readFile('../' + file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    const nats = new Set();
    const groups = new Set();
    const depts = new Set();
    let dateOK = 0, dateFail = 0;

    data.forEach((row, i) => {
        const nat = normalizeNationality(row['Nationality']);
        const gender = normalizeGender(row['Gender']);
        const dob = parseExcelDate(row['Date of Birth']);
        const joined = parseExcelDate(row['Date Joined']);
        const dept = row['Department'] || row['DEPT'] || '';

        nats.add(`${row['Nationality']} -> ${nat}`);
        groups.add(row['Group'] || row['GROUP ID'] || 'General');
        if (dept) depts.add(dept);
        if (dob) dateOK++; else dateFail++;

        // Show first 3 and last 1 as samples
        if (i < 3 || i === data.length - 1) {
            console.log(`  [${i + 1}] ${row['Employee ID']} | ${row['Full Name']} | ${nat} | ${gender} | DOB:${dob} | Joined:${joined} | Grp:${row['Group']} | Dept:${dept}`);
        } else if (i === 3) {
            console.log(`  ... (${data.length - 4} more rows) ...`);
        }
    });

    console.log(`\n  SUMMARY: ${data.length} employees`);
    console.log(`  Nationalities: ${[...nats].join(', ')}`);
    console.log(`  Groups: ${[...groups].join(', ')}`);
    console.log(`  Departments: ${[...depts].join(', ')}`);
    console.log(`  Dates parsed OK: ${dateOK}, Failed: ${dateFail}`);
});
