const formatter = new Intl.DateTimeFormat('es', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Todavía no se ha publicado';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}
