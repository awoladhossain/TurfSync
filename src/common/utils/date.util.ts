export function startOfUTCDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function startOfUTCWeek(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  const day = result.getUTCDay();
  // Adjust to Monday: getUTCDay() returns 0 for Sunday, 1 for Monday...
  const diff = result.getUTCDate() - day + (day === 0 ? -6 : 1);
  result.setUTCDate(diff);
  return result;
}

export function startOfUTCMonth(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(1);
  return result;
}

export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function addUTCMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  const targetMonth = result.getUTCMonth() + months;

  // Set day to 1st first to avoid rollover during month transition
  result.setUTCDate(1);
  result.setUTCMonth(targetMonth);

  // Restore the day of the month, capping it at the maximum days of the target month
  const maxDays = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, maxDays));

  return result;
}
