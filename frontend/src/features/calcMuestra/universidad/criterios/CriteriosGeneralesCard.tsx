/**
 * Los criterios y parámetros que rigen para TODAS las facultades, con lo que el
 * estudio anterior hizo al lado.
 *
 * Gonzalo separó las dos cosas: «hay que separar criterios generales y luego el
 * card de cada facultad con sus criterios específicos». Los generales son los
 * que él llamó fundamentales —la presencialidad, el tipo de docente— más los
 * parámetros del diseño: n, sobremuestra, estadístico y método de selección.
 *
 * Y pidió que el comparativo fuera «no sólo de números sino de método». Por eso
 * cada fila dice si coincide con el estudio anterior o no: una diferencia de
 * aulas parece un error del motor hasta que se ve que la regla era otra.
 *
 * Cuando no hay histórico, la columna dice **«sin referencia»** en vez de
 * quedarse en blanco: un hueco se lee como «igual».
 */
import type { CalcMuestraReferenciaCriterios } from "../../../../api/calcMuestra";

export type CriterioGeneralFila = {
  /** Qué decide esta fila, en palabras del analista. */
  concepto: string;
  /** Valor vigente en el estudio actual. */
  hoy: string;
  /** Clave del bloque `general` del histórico que le corresponde, si la hay. */
  claveHistorica?: string;
  /** Valor del estudio anterior cuando no sale de una clave directa. */
  antesFijo?: string;
};

/** Compara dos valores ya normalizados a texto comparable. */
function coinciden(hoy: string, antes: string): boolean | null {
  if (!antes) return null;
  const norm = (v: string) =>
    v.toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "").trim();
  const a = norm(hoy);
  const b = norm(antes);
  if (!a || !b) return null;
  return a === b || a.includes(b) || b.includes(a);
}

export function CriteriosGeneralesCard({
  filas,
  referencia,
}: {
  filas: CriterioGeneralFila[];
  referencia: CalcMuestraReferenciaCriterios | null;
}) {
  if (!filas.length) return null;
  const resueltas = filas.map((f) => {
    const antes = f.antesFijo ?? (f.claveHistorica ? referencia?.general?.[f.claveHistorica] ?? "" : "");
    return { ...f, antes, igual: coinciden(f.hoy, antes) };
  });
  const distintas = resueltas.filter((f) => f.igual === false).length;
  const comparables = resueltas.filter((f) => f.igual !== null).length;

  return (
    <section className="cmv2-generales-card" aria-label="Criterios generales del estudio">
      <header>
        <strong>Lo que rige para todas las facultades</strong>
        <span>
          {referencia ? (
            comparables > 0 ? (
              <>
                Comparado con {referencia.periodo || "el estudio anterior"}:{" "}
                <strong>{distintas}</strong> de {comparables} decisiones cambiaron.
              </>
            ) : (
              <>El histórico no trae ninguna de estas decisiones.</>
            )
          ) : (
            <>Sin histórico cargado: no hay con qué comparar.</>
          )}
        </span>
      </header>
      <div className="cmv2-generales-wrap">
        <table className="cmv2-generales-tabla">
          <thead>
            <tr>
              <th scope="col">Decisión</th>
              <th scope="col">Este estudio</th>
              <th scope="col">{referencia?.periodo || "Estudio anterior"}</th>
              <th scope="col">¿Igual?</th>
            </tr>
          </thead>
          <tbody>
            {resueltas.map((f) => (
              <tr key={f.concepto} data-igual={f.igual === null ? "sin-dato" : String(f.igual)}>
                <th scope="row">{f.concepto}</th>
                <td>{f.hoy || "—"}</td>
                <td>{f.antes || <span className="cmv2-generales-vacio">sin referencia</span>}</td>
                <td>{f.igual === null ? "—" : f.igual ? "sí" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
