export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  if (currency === 'INR') {
    // Format as Lakhs Per Annum (LPA)
    if (amount >= 100) {
      return `${(amount / 100).toFixed(1)} Cr`;
    }
    return `${amount} LPA`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function noticePeriodToText(period: string): string {
  const map: Record<string, string> = {
    immediate: 'Immediate',
    '15_days': '15 Days',
    '30_days': '30 Days (1 Month)',
    '60_days': '60 Days (2 Months)',
    '90_days': '90 Days (3 Months)',
    more_than_90_days: 'More than 90 Days',
  };
  return map[period] || period;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
