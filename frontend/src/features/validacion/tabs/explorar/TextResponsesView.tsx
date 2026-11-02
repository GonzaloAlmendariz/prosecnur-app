import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import type { ExplorarTextResponseRow } from "../../../../api/validacion";
import type { ViewDescriptor } from "../../types";

const COLUMNAS: readonly PulsoTableColumna<ExplorarTextResponseRow>[] = [
  { id: "row", encabezado: "Caso", ancho: 72, tipo: "cifra", celda: (f) => f.row, valor: (f) => f.row },
  { id: "respondent_id", encabezado: "Respondente", ancho: 170, celda: (f) => f.respondent_id, valor: (f) => f.respondent_id },
  { id: "response", encabezado: "Respuesta", ancho: 520, celda: (f) => f.response, valor: (f) => f.response },
];

/**
 * Respuestas abiertas una por una, como las manda el motor anterior
 * (`chart.text_rows`). Con `dist.texto` se dibuja agrupado en su lugar.
 */
export default function TextResponsesView({ view, rows }: { view: ViewDescriptor; rows: ExplorarTextResponseRow[] }) {
  const nota = typeof view.meta?.note === "string" ? view.meta.note.trim() : "";
  return (
    <>
      <PulsoTable
        columnas={COLUMNAS}
        filas={rows}
        idDeFila={(f) => `${f.row}-${f.respondent_id}`}
        ariaLabel={view.title || "Respuestas abiertas"}
        densidad="compacta"
        altoMaximo={360}
        vacio="No hay respuestas abiertas no vacías para esta variable."
      />
      {nota && <p className="vx-pie">{nota}</p>}
    </>
  );
}
