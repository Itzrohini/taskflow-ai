export type DueStatus = "overdue" | "today" | "upcoming" | "none";

export function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dueStatus(
  dueDate: string | null,
  today: string,
  completed = false,
): DueStatus {
  if (!dueDate) {
    return "none";
  }
  if (dueDate < today) {
    return completed ? "none" : "overdue";
  }
  if (dueDate === today) {
    return "today";
  }
  return "upcoming";
}

export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return dueDate;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: year === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}
