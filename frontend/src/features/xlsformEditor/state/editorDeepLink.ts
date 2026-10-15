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

/** Devuelve `search` con `form_id` fijado (o quitado con `null`), sin tocar
 *  el resto de la dirección. Un formulario abierto se escribe en la URL para
 *  que recargar o compartir `?pestana=…` vuelva al mismo formulario. */
export function searchConFormId(search: string, formId: string | null): string {
  const params = new URLSearchParams(search);
  if (formId) params.set("form_id", formId);
  else params.delete("form_id");
  const out = params.toString();
  return out ? `?${out}` : "";
}
