/**
 * Tarjeta ancha de radiografía de UNA facultad: distribución por tipo de sesión
 * con el mini-boxplot de elegibles por aula, mediana, badges (multi-facultad,
 * local externo, sin condición) y el desplegable por nivel. Extraída de
 * ExploradorAulasTab para consumirse también en la vista integrada
 * facultad-primaria de «Cursos-horario» sin duplicar. Presentación pura: la
 * lógica calculable vive en exploradorModel.ts.
 *
 * Dos modos:
 *  - `onSelect` presente ⇒ la cabecera es un botón que selecciona la facultad
 *    (drill-down del Explorador), con highlight `data-active`.
 *  - `onSelect` ausente ⇒ sin cabecera (la superficie que la embebe —el acordeón
 *    de la vista integrada— ya muestra nombre/elegibles). Solo badges + cuerpo.
 */
import { Layers3, MapPin } from "lucide-react";
import type {
  CalcMuestraAulasCriteriosRadiografia,
  CalcMuestraAulasExploracionFacultad,
} from "../../../../api/client";
import { fmtDec, fmtInt, fmtPct } from "../../sharedCore";
import {
  condicionResumen,
  nivelDistribucion,
  shareSinCondicion,
} from "./exploradorModel";
import {
  TipoSesionRadiografia,
  type TipoSesionRadiografiaContexto,
} from "./TipoSesionRadiografia";

/** Color del segmento de condición por bucket (tokens del módulo). */
function condicionKind(condicion: string): "obligatorio" | "electivo" | "sindato" | "otro" {
  if (condicion === "Obligatorio") return "obligatorio";
  if (condicion === "Electivo") return "electivo";
  if (condicion === "Sin dato") return "sindato";
  return "otro";
}

export function FacultadRadiografiaCard({
  fac,
  active,
  onSelect,
  modo = "completo",
  criteriosRadiografia = null,
  facultadKey,
  contextoRadiografia = "ejecutado",
}: {
  fac: CalcMuestraAulasExploracionFacultad;
  /** Standalone (Explorador): resalta la tarjeta seleccionada. */
  active?: boolean;
  /** Standalone (Explorador): la cabecera selecciona la facultad. Sin callback
   *  no se renderiza cabecera (la embebe una superficie con su propio header). */
  onSelect?: () => void;
  /** Qué partes mostrar, cada una JUNTO al criterio donde se decide: «resumen»
   *  (elegibles + condición + badges, arriba), «tipos» (distribución por tipo con
   *  boxplot), «condicion» (barra obligatorio/electivo), «niveles» (tabla por
   *  nivel) o «completo» (todo, Explorador). */
  modo?: "completo" | "resumen" | "tipos" | "condicion" | "niveles";
  /** Contrato F1 opcional. `null` conserva el resumen/boxplot legacy. */
  criteriosRadiografia?: CalcMuestraAulasCriteriosRadiografia | null;
  /** Clave autoritativa para unir la colección F1 en contextos editables. */
  facultadKey?: string;
  contextoRadiografia?: TipoSesionRadiografiaContexto;
}) {
  // Guard defensivo: en dev, un render concurrente/StrictMode transitorio puede
  // montar la tarjeta con `fac` aún sin resolver. El componente no usa hooks, así
  // que el early-return es seguro y evita que sus modelos puros reciban
  // `undefined` (el retry ya renderiza con el `fac` real).
  if (!fac) return null;
  const niveles = nivelDistribucion(fac);
  const sinCondicion = shareSinCondicion(fac);
  const hayBadges = fac.n_multi_facultad > 0 || fac.n_local_externo > 0 || (sinCondicion != null && sinCondicion > 0);
  // Condición del curso (obligatorio/electivo) por facultad: junto al tipo,
  // define cuántas aulas sobreviven a todos los criterios (Ramiro §8.2).
  const cond = condicionResumen(fac);
  const verResumen = modo === "resumen" || modo === "completo";
  const verCond = verResumen || modo === "condicion";
  const verTipos = modo === "tipos" || modo === "completo";
  const verNiveles = modo === "niveles" || modo === "completo";

  return (
    <article className="cmv2-explorador-card" data-modo={modo} data-active={active || undefined}>
      {onSelect ? (
        <button type="button" className="cmv2-explorador-card-head" aria-pressed={active} onClick={onSelect}>
          <span className="cmv2-explorador-card-title">
            <span className="cmv2-explorador-card-nombre">{fac.facultad}</span>
            <span className="cmv2-explorador-card-meta">
              {fmtInt(fac.ch_elegibles)} de {fmtInt(fac.ch_total)} CH elegibles
              {fac.est_aula_mediana != null ? ` · mediana ${fmtDec(fac.est_aula_mediana, 0)} por aula` : ""}
            </span>
          </span>
          <span className="cmv2-explorador-card-hero">
            {fmtInt(fac.elegibles_total)}
            <em>matrículas elegibles</em>
          </span>
        </button>
      ) : null}
      {verResumen && hayBadges && (
        <div className="cmv2-explorador-card-badges">
          {fac.n_multi_facultad > 0 && (
            <span className="cmv2-explorador-badge" data-kind="multi">
              <Layers3 size={11} aria-hidden="true" />
              {fmtInt(fac.n_multi_facultad)} multi-facultad
            </span>
          )}
          {fac.n_local_externo > 0 && (
            <span className="cmv2-explorador-badge" data-kind="externo">
              <MapPin size={11} aria-hidden="true" />
              {fmtInt(fac.n_local_externo)} local externo
            </span>
          )}
          {sinCondicion != null && sinCondicion > 0 && (
            <span className="cmv2-explorador-badge" data-kind="sin-condicion">
              {fmtPct(sinCondicion)} sin condición
            </span>
          )}
        </div>
      )}
      {(verResumen || verCond) && (
      <div className="cmv2-radiografia-facts">
        {verResumen && (
        <p className="cmv2-radiografia-sobreviven">
          <strong>{fmtInt(fac.ch_elegibles)}</strong> de {fmtInt(fac.ch_total)} cursos-horario
          siguen siendo candidatos con los criterios vigentes
          {fac.est_aula_mediana != null ? ` · mediana ${fmtDec(fac.est_aula_mediana, 0)} elegibles/aula` : ""}
        </p>
        )}
        {verCond && cond.segmentos.length > 0 && (
          <div className="cmv2-radiografia-condicion">
            <div
              className="cmv2-radiografia-condicion-bar"
              role="img"
              aria-label={`Condición del curso en ${fac.facultad}: ${cond.segmentos
                .map((s) => `${s.condicion} ${Math.round(s.share * 100)}%`)
                .join(", ")}`}
            >
              {cond.segmentos.map((s) => (
                <i
                  key={s.condicion}
                  data-kind={condicionKind(s.condicion)}
                  style={{ width: `${Math.max(1, s.share * 100)}%` }}
                  title={`${s.condicion}: ${fmtInt(s.ch)} CH (${fmtPct(s.share)})`}
                />
              ))}
            </div>
            <div className="cmv2-radiografia-condicion-leg">
              {cond.segmentos.map((s) => (
                <span key={s.condicion} className="cmv2-radiografia-condicion-item">
                  <i data-kind={condicionKind(s.condicion)} aria-hidden="true" />
                  {s.condicion} {fmtPct(s.share)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
      {verTipos ? (
        <TipoSesionRadiografia
          facultad={fac}
          facultadKey={facultadKey}
          radiografia={criteriosRadiografia}
          contexto={contextoRadiografia}
        />
      ) : null}
      {verNiveles && niveles.length > 0 && (
        <table className="cmv2-table cmv2-table--university cmv2-explorador-dist cmv2-radiografia-niveles">
          <thead>
            <tr>
              <th>Nivel del curso</th>
              <th data-numeric="true">CH</th>
              <th data-numeric="true">Elegibles</th>
              <th data-numeric="true">Mediana por CH</th>
            </tr>
          </thead>
          <tbody>
            {niveles.map((nivel) => (
              <tr key={nivel.nivel}>
                <td>
                  <div className="cmv2-explorador-dist-cell">
                    <span className="cmv2-explorador-dist-label">{nivel.nivel}</span>
                    <span className="cmv2-explorador-dist-track" aria-hidden="true">
                      <i style={{ width: `${Math.max(2, Math.round(nivel.share * 100))}%` }} />
                    </span>
                    <span className="cmv2-explorador-dist-pct">{fmtPct(nivel.share)}</span>
                  </div>
                </td>
                <td data-numeric="true">{fmtInt(nivel.ch)}</td>
                <td data-numeric="true">{fmtInt(nivel.elegibles)}</td>
                <td
                  data-numeric="true"
                  title={nivel.medianaElegibles != null
                    ? `Mediana de elegibles por aula: ${fmtDec(nivel.medianaElegibles, 0)}.`
                    : "Sin CH incluidos con dato."}
                >
                  {nivel.medianaElegibles != null ? fmtDec(nivel.medianaElegibles, 0) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
