export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(
      /^Error invoking remote method '[^']+': (?:Error: )?/,
      '',
    );
  }

  return 'Algo salió mal. Inténtalo de nuevo.';
}

export function hostLabel(origin: string): string {
  try {
    return new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return origin;
  }
}
