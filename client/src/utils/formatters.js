export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD',
        minimumFractionDigits: 2,
    }).format(amount || 0);
}

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-SG', {
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
