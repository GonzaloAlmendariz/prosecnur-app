import type { MonitoreoAulasConfig } from "../../../../api/monitoreo";

/**
 * **Los dos Sheets del operativo, dichos juntos.**
 *
 * Dictado de Gonzalo (2026-09-09): «haz la UI más intuitiva para a partir de
 * ahora yo actualizar el sheets de distribución y el sheets operativo».
 *
 * Son dos documentos distintos con dueños distintos y sus acciones vivían en
 * dos pantallas: el libro en este panel, la distribución dentro de Asignación.
 * Para saber si los dos estaban al día había que ir a mirarlos. Este bloque no
 * añade botones —los que hay ya funcionan— sino la única cosa que faltaba:
 * **cuál es cuál, cuándo se escribió cada uno por última vez, y qué toca**.
 *
 * No inventa estados: si un destino no está recordado, lo dice, porque un
 * hueco silencioso se lee como «al día».
 */
export type AulasDosSheetsProps = {
  config: MonitoreoAulasConfig | null;
};

function cuando(iso?: string | null): string {
  const v = (iso ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function AulasDosSheets({ config }: AulasDosSheetsProps) {
  const libro = config?.libro_sheets ?? null;
  const dist = config?.distribucion_sheets ?? null;
  const fijadas = Object.keys(config?.reparto_fijado ?? {}).length;

  const filas = [
    {
      clave: "libro",
      titulo: "Sheets del operativo",
      que: "Las hojas del equipo y las que produce la app",
      url: libro?.url ?? "",
      escrito: cuando(libro?.updated_at),
      // Publicar lee el libro y, desde el 2026-09-09, también la hoja de la
      // distribución antes de rehacer «Asignación de aplicadores».
      siguiente: libro?.spreadsheet_id
        ? "Publicar al Sheets escribe aquí, y antes lee lo que el equipo tecleó"
        : "Pega su enlace abajo una vez y queda recordado",
    },
    {
      clave: "distribucion",
      titulo: "Sheets de los aplicadores",
      que: "A quién le toca cada curso-horario, la hoja que ellos leen",
      url: dist?.url ?? "",
      escrito: cuando(dist?.updated_at),
      siguiente: dist?.spreadsheet_id
        ? (fijadas > 0
          // Con fijaciones guardadas, el reparto ya no se resortea por debajo.
          ? `Adoptado: ${fijadas} asignaciones fijadas, el sorteo ya no las mueve`
          : "Sin adoptar: en Asignación, «Revisar cambios» fija lo que ya se comunicó")
        : "Se recuerda al publicar la distribución o al sincronizarla una vez",
    },
  ];

  return (
    <div className="aulas-dos-sheets" data-qa-geometry-contract="intrinsic">
      <p className="aulas-dos-sheets-rotulo">Los dos Sheets del operativo</p>
      <ul>
        {filas.map((f) => (
          <li key={f.clave} className={f.url ? "is-conectado" : "is-pendiente"}>
            <span className="aulas-dos-sheets-titulo">
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer">{f.titulo}</a>
              ) : f.titulo}
            </span>
            <span className="aulas-dos-sheets-que">{f.que}</span>
            <span className="aulas-dos-sheets-cuando">
              {f.escrito ? `escrito ${f.escrito}` : "sin escribir todavía"}
            </span>
            <span className="aulas-dos-sheets-siguiente">{f.siguiente}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
