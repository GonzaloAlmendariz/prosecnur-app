import type { EstudioBase } from "../../api/estudio";

/**
 * Formularios que pueden guiar una integración o unas hermanas: el de la sesión
 * y el de cada base, sin repetir archivo. Lo usan los asistentes de varias
 * fuentes y varias encuestas, en BasesPanel y en "Agregar base" (Carga › Bases).
 */
export function opcionesCanonicas(
  bases: readonly Pick<EstudioBase, "nombre" | "xlsform_file_id">[],
  hayFormularioDeSesion: boolean,
): Array<{ fileId: string; label: string }> {
  const crudas = [
    ...(hayFormularioDeSesion ? [{ fileId: "", label: "Formulario cargado en Carga/Editor" }] : []),
    ...bases.map((base) => ({ fileId: base.xlsform_file_id, label: `${base.nombre}, formulario` })),
  ];
  const vistas = new Set<string>();
  return crudas.filter((option) => {
    const key = option.fileId || "session-xlsform";
    if (vistas.has(key)) return false;
    vistas.add(key);
    return true;
  });
}
