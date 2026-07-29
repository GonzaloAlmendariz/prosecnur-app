import type { DisenoEstudioBitacoraEntry } from "../../../api/disenoEstudio";
import { etiquetaTono } from "./gramatica";

/**
 * Qué decía antes (ADR 0047).
 *
 * La bitácora es un registro: editar conserva la versión anterior y esto la
 * muestra. Sin esta vista el historial existiría en el `.pulso` pero nadie
 * podría consultarlo, que es lo mismo que no tenerlo.
 */
export function HistorialEntrada({ entrada }: { entrada: DisenoEstudioBitacoraEntry }) {
  const revisiones = entrada.revisions ?? [];
  if (revisiones.length === 0) return null;

  return (
    <div className="bit-historial">
      <h4>Qué decía antes</h4>
      <ol>
        {revisiones.map((r) => {
          const cambioTitulo = r.title !== entrada.title;
          const cambioCuerpo = r.body !== entrada.body;
          const cambioTono = r.tone !== entrada.tone;
          return (
            <li key={r.revised_at}>
              <div className="bit-historial-meta">
                <span>{fecha(r.revised_at)}</span>
                {cambioTono && <span>era {etiquetaTono(r.tone)}</span>}
              </div>
              {cambioTitulo && <p className="bit-historial-titulo">{r.title}</p>}
              {/* Un cuerpo que ANTES estaba vacío se dice con palabras: una
                  revisión que abre y no muestra nada parece un render roto,
                  aunque el dato sea correcto. */}
              {cambioCuerpo &&
                (r.body ? <p>{r.body}</p> : <p className="bit-historial-vacio">Sin detalle</p>)}
              {!cambioTitulo && !cambioCuerpo && !cambioTono && (
                <p className="bit-historial-vacio">Se reordenaron sus etiquetas</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const FORMATO = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : FORMATO.format(d).replace(".", "");
}
