export type DateRange = {
  from: string;
  to: string;
};

export function parseDateRange(searchParams: URLSearchParams): DateRange & { error?: string } {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam && !toParam) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  if (fromParam && isNaN(from!.getTime())) {
    return { from: "", to: "", error: "Invalid from date" };
  }
  if (toParam && isNaN(to!.getTime())) {
    return { from: "", to: "", error: "Invalid to date" };
  }

  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);

  return {
    from: from?.toISOString() ?? "",
    to: to?.toISOString() ?? "",
  };
}

export function getPreviousPeriod(from: string, to: string): DateRange {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const durationMs = toDate.getTime() - fromDate.getTime();

  const prevTo = new Date(fromDate.getTime() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  prevFrom.setHours(0, 0, 0, 0);

  return {
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
