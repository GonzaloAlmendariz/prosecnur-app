/**
 * ¿El estudio de acreditación tiene canal telefónico? La misma regla que el
 * backend (`api/R/monitoreo_estudio_telefono.R`): un público con teléfono, o una
 * fuente con canal telefónico o de barrido. Sin públicos ni fuentes no se sabe
 * y se responde que sí, como antes. Con «no», el prefetch de fondo no pide el
 * tablero telefónico: el warm start ya lo saltaba y pedirlo después sólo movía
 * los ~6 s al Plumber mono-hilo (verificador, 30/10).
 */

type FuenteSuelta = { role?: unknown; dimensions?: unknown; channel?: unknown };
type EstadoConTelefono = {
  sources?: readonly FuenteSuelta[] | null;
  config?: { monitoreo_profile?: { units?: ReadonlyArray<Record<string, unknown>> } | null; profile?: { units?: ReadonlyArray<Record<string, unknown>> } | null } | null;
  monitoreo_profile?: { units?: ReadonlyArray<Record<string, unknown>> } | null;
} | null | undefined;

const esTelefono = (valor: unknown) => /telef|phone|llamad/.test(String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());

export function estudioUsaTelefono(estado: EstadoConTelefono): boolean {
  const units = estado?.config?.monitoreo_profile?.units ?? estado?.config?.profile?.units ?? estado?.monitoreo_profile?.units ?? [];
  const fuentes = estado?.sources ?? [];
  if (!units.length && !fuentes.length) return true;
  for (const unit of units) {
    const phone = (unit?.phone ?? unit?.telefono) as { enabled?: unknown; activo?: unknown } | undefined;
    if (phone && (phone.enabled === true || phone.activo === true)) return true;
  }
  for (const fuente of fuentes) {
    const dims = (fuente?.dimensions ?? {}) as Record<string, unknown>;
    if (esTelefono(dims.canal ?? dims.channel ?? fuente?.channel) || esTelefono(fuente?.role) || String(fuente?.role ?? "").toLowerCase() === "barrido") return true;
  }
  return false;
}
