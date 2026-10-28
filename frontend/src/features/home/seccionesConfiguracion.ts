// Secciones de la configuración global y su lectura desde `?panel=configuracion&foco=…`.
// Archivo liviano: <ConfiguracionHost/> vive en el Layout (bundle principal) y no
// puede importar el diálogo, que se carga diferido.

export type SettingsTab = "appearance" | "connections" | "notes" | "credits";

/** `foco` → sección. Acepta «conexiones», el nombre con que enlaza Carga. */
export function seccionDeConfiguracion(foco: string | null | undefined): SettingsTab | null {
  const valor = (foco ?? "").trim().toLowerCase();
  if (valor === "conexiones") return "connections";
  if (valor === "appearance" || valor === "connections" || valor === "notes" || valor === "credits") return valor;
  return null;
}
