export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD',
        minimumFractionDigits: 2,
    }).format(amount || 0);
}

export function formatDate(dateStr) {
    if (!dateStr || dateStr === '0000-00-00' || dateStr === '1970-01-01' || dateStr === '0') return '-';

    let d;
    // Check if it's an Excel serial date (numeric string or number between 10000 and 60000)
    const num = Number(dateStr);
    if (!isNaN(num) && num > 10000 && num < 60000) {
        d = new Date((num - 25569) * 86400 * 1000);
    } else {
        d = new Date(dateStr);
    }

    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return '-';
    return d.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatMonth(year, month) {
    return new Date(year, month - 1).toLocaleDateString('en-SG', {
        month: 'long',
        year: 'numeric',
    });
}

export function getMonthName(month) {
    return new Date(2000, month - 1).toLocaleDateString('en-SG', { month: 'long' });
}
