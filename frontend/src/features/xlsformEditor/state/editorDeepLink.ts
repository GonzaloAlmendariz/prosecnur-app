/** Devuelve el ID estable solicitado por Carga; nunca usa nombre ni activo. */
export function editorFormIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("form_id")?.trim() ?? "";
  if (!value || value.length > 128 || /[\u0000-\u001F\u007F]/.test(value)) return null;
  return value;
}

export function editorRequestedFormExists(
  requestedFormId: string,
  localFormIds: Iterable<string>,
  backendFormIds: Iterable<string>,
): boolean {
  if (!requestedFormId) return false;
  return new Set([...localFormIds, ...backendFormIds]).has(requestedFormId);
}
