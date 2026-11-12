/**
 * Respuestas casi iguales (prototipo `validacion-hallazgos-duplicados`,
 * `vistas.js:198`): la cabecera de columnas "Caso, Fecha, Duración,
 * Respondidas" y un bloque por par, con sus dos respuestas, cuál se conserva y
 * cuántas preguntas coinciden. Nunca "duplicado" (REVISION 4).
 *
 * Elegir la respuesta que se conserva en un par lo marca: "Sobre qué pares"
 * con "Los marcados" decide solo esos. Fecha, duración y respondidas son las
 * del contexto de cada caso (M4); la que el estudio no declara se lee "Sin
 * dato". "Comparar respuestas" abre la primera respuesta del par, y las
 * flechas del caso pasan a la otra.
 */
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import type { ContextoDeCaso } from "../../../../api/validacionAuditoria";
import { fechaCorta, type ParCasiIgual } from "../modeloHallazgos";

function fecha(c: ContextoDeCaso | null): string {
  return fechaCorta(c?.fecha_envio ?? c?.fecha_respuesta, true) ?? "Sin dato";
}

function duracion(c: ContextoDeCaso | null): string {
  if (c?.duracion_min === null || c?.duracion_min === undefined) return "Sin dato";
  return `${formatoDecimal(c.duracion_min, c.duracion_min % 1 === 0 ? 0 : 1)} min`;
}

function respondidas(c: ContextoDeCaso | null): string {
  if (c?.n_respondidas === null || c?.n_respondidas === undefined) return "Sin dato";
  return c.n_preguntas !== null ? `${formatoConteo(c.n_respondidas)} de ${formatoConteo(c.n_preguntas)}` : formatoConteo(c.n_respondidas);
}

export function HallazgoCasiIguales({
  pares,
  conservados,
  onConservar,
  onAbrirCaso,
  editable,
}: {
  pares: readonly ParCasiIgual[];
  /** El id que se conserva en cada par (por su clave); `null` si el par no se resuelve. */
  conservados: Readonly<Record<string, string | null>>;
  onConservar: (par: ParCasiIgual, id: string) => void;
  onAbrirCaso: (id: string, lista: string[]) => void;
  /** Con "Todas" no sale ninguna: no se elige. */
  editable: boolean;
}) {
  if (!pares.length) {
    return <p className="pulso-hz-nota pulso-hz-nota--centro">El motor no publicó las parejas de esta regla.</p>;
  }
  return (
    <div className="pulso-hz-pares">
      <div className="pulso-hz-par-cabecera" aria-hidden="true">
        <span />
        <span>Caso</span>
        <span>Fecha</span>
        <span>Duración</span>
        <span>Respondidas</span>
        <span />
      </div>
      <div className="pulso-hz-pares-lista" data-qa-geometry-group="validacion/hallazgos-pares" data-qa-geometry-contract="equal">
        {pares.map((par, i) => {
          const queda = conservados[par.clave] ?? null;
          const pc = par.similitud !== null ? ` (${formatoDecimal(par.similitud * 100, 1)} %)` : "";
          return (
            <Panel
              key={par.clave}
              noPadding
              variant="subtle"
              className="pulso-hz-par"
              data-qa-geometry-member=""
              title={(
                <>
                  <span className="pulso-hz-par-titulo">Par {formatoConteo(i + 1)}</span>
                  <span className="pulso-hz-par-n">{formatoConteo(par.miembros.length)} respuestas</span>
                </>
              )}
              actions={(
                <PulsoButton variant="link" size="sm" onClick={() => onAbrirCaso(par.miembros[0].id, par.miembros.map((m) => m.id))}>
                  Comparar respuestas
                </PulsoButton>
              )}
            >
              <div role="radiogroup" aria-label={`Respuesta que se conserva en el par ${i + 1}`}>
                {par.miembros.map((m) => {
                  const seConserva = queda === m.id;
                  return (
                    <div key={m.id} className="pulso-hz-par-fila" data-queda={seConserva ? "" : undefined}>
                      <button
                        type="button"
                        role="radio"
                        className="pulso-hz-radio"
                        aria-checked={seConserva}
                        aria-label={`Conservar ${m.id}`}
                        disabled={!editable}
                        onClick={() => onConservar(par, m.id)}
                      />
                      <button type="button" className="pulso-hz-casoid" title="Ver el caso completo" onClick={() => onAbrirCaso(m.id, par.miembros.map((x) => x.id))}>
                        {m.id}
                      </button>
                      <span>{fecha(m.contexto)}</span>
                      <span>{duracion(m.contexto)}</span>
                      <span>{respondidas(m.contexto)}</span>
                      <em>{!editable ? "Se conserva" : queda === null ? "Por elegir" : seConserva ? "Se conserva" : "Sale de la base"}</em>
                    </div>
                  );
                })}
              </div>
              <p className="pulso-hz-par-pie">
                {par.n_coincidencias !== null && par.n_comparables !== null
                  ? `Coinciden en ${formatoConteo(par.n_coincidencias)} de las ${formatoConteo(par.n_comparables)} preguntas comparadas${pc}`
                  : "El motor no publicó cuántas preguntas coinciden."}
              </p>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
