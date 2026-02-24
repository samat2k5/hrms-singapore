/**
 * GIRO Engine — Generates bank-compliant GIRO files for Singapore banks
 */

/**
 * Generate DBS UFF (Universal File Format) CSV
 * Based on DBS IDEAL specifications
 */
function generateDBS(run, slips) {
    let csv = 'H,DBS,UFF,1.0,' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '\n';

    slips.forEach(s => {
        const amount = parseFloat(s.net_pay).toFixed(2);
        // Header Field Identifier (D), Product (GIRO), Originating Account, Payee Name, Amount, Reference
        csv += `D,GIRO,${run.entity_account || ''},${s.employee_name},${amount},Salary ${run.period_month}/${run.period_year}\n`;
    });

    csv += `T,${slips.length}`;
    return csv;
}

/**
 * Generate OCBC Velocity GIRO-FAST (Fixed-Width TXT)
 * Simplified structure based on OBGDATA format
 */
function generateOCBC(run, slips) {
    const valueDate = new Date();
    valueDate.setDate(valueDate.getDate() + 1); // +1 Business Day
    const dateStr = valueDate.toISOString().split('T')[0].replace(/-/g, '');

    let txt = `00${'OCBC'.padEnd(10)}PAYROLL   ${dateStr}${String(slips.length).padStart(6, '0')}\n`;

    slips.forEach(s => {
        const amount = Math.round(parseFloat(s.net_pay) * 100);
        const name = s.employee_name.substring(0, 20).padEnd(20);
        const acct = (s.bank_account || '').replace(/-/g, '').padEnd(15);
        txt += `10${acct}${name}${String(amount).padStart(12, '0')}000\n`;
    });

    return txt;
}

/**
 * Generate UOB Infinity GIRO-FAST (Fixed-Width TXT)
 */
function generateUOB(run, slips) {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    let txt = `HEADER${dateStr}${String(slips.length).padStart(5, '0')}UOB\n`;

    slips.forEach(s => {
        const amount = Math.round(parseFloat(s.net_pay) * 100);
        const name = s.employee_name.substring(0, 30).padEnd(30);
        const acct = (s.bank_account || '').padEnd(20);
        txt += `DETAIL${acct}${name}${String(amount).padStart(15, '0')}\n`;
    });

    return txt;
}

/**
 * Generate Standard Interbank GIRO (APS) 140-char Fixed-Width
 */
function generateAPS(run, slips) {
    let txt = '';
    slips.forEach(s => {
        const amount = Math.round(parseFloat(s.net_pay) * 100);
        const name = s.employee_name.substring(0, 30).padEnd(30);
        const acct = (s.bank_account || '').padEnd(20);
        const ref = `SALARY ${run.period_month}/${run.period_year}`.padEnd(20);

        // Record Type (1), Name (30), Account (20), Amount (12), Ref (20), Padding to 140
        txt += `1${name}${acct}${String(amount).padStart(12, '0')}${ref}${''.padEnd(57)}\n`;
    });
    return txt;
}

function generateGIROFile(format, run, slips) {
    switch (format.toUpperCase()) {
        case 'DBS':
            return { content: generateDBS(run, slips), extension: 'csv', type: 'text/csv' };
        case 'OCBC':
            return { content: generateOCBC(run, slips), extension: 'txt', type: 'text/plain' };
        case 'UOB':
            return { content: generateUOB(run, slips), extension: 'txt', type: 'text/plain' };
        case 'APS':
            return { content: generateAPS(run, slips), extension: 'txt', type: 'text/plain' };
        default:
            // Fallback to simplified CSV if format unknown
            return { content: generateDBS(run, slips), extension: 'csv', type: 'text/csv' };
    }
}

module.exports = { generateGIROFile };
