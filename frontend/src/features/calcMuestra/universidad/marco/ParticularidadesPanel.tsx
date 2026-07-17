/**
 * Panel de particularidades del marco (pestaña Cursos-horario de Marco).
 * Muestra las señales DETECTADAS por el motor (contrato congelado
 * calc_muestra_aulas_particularidades_v1) en tres secciones colapsables y deja
 * la decisión al usuario: incluir / excluir / revisado + nota opcional, todo
 * documentado en `aulas_config.particularidades_decisiones`. Nada se
 * auto-decide; las exclusiones recién operan al RECONSTRUIR el marco. La
 * lógica reductora vive en particularidadesModel (puro, con test).
 */
import type { ReactNode } from "react";
import { GraduationCap, Layers, MapPin, Radar, Split } from "lucide-react";
import type {
  CalcMuestraAulasParticularidades,
  CalcMuestraParticularidadDecision,
} from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import {
  PARTICULARIDAD_DECISIONES,
  resumenDecisiones,
  setDecisionParticularidad,
  setNotaParticularidad,
  type ParticularidadDecisionValor,
} from "./particularidadesModel";

type Decisiones = Record<string, CalcMuestraParticularidadDecision>;

/** Fila decidible: título + meta + segmentado incluir/excluir/revisado + nota. */
function ParticularidadFila({
  id,
  titulo,
  meta,
  decisiones,
  onDecisiones,
}: {
  id: string;
  titulo: string;
  meta: string;
  decisiones: Decisiones;
  onDecisiones: (next: Decisiones) => void;
}) {
  const actual = decisiones[id];
  function decidir(valor: ParticularidadDecisionValor) {
    // Repetir la decisión activa la limpia (vuelve a "pendiente"): permite
    // deshacer sin acción extra, manteniendo el registro solo con decisiones reales.
    onDecisiones(setDecisionParticularidad(decisiones, id, actual?.decision === valor ? null : valor));
  }
  return (
    <li className="cmv2-partic-row" data-decision={actual?.decision ?? "pendiente"}>
      <div className="cmv2-partic-row-copy">
        <strong>{titulo || id}</strong>
        {meta ? <span className="cmv2-partic-row-meta">{meta}</span> : null}
      </div>
      <div className="cmv2-partic-row-actions" role="group" aria-label={`Decisión para ${titulo || id}`}>
        {PARTICULARIDAD_DECISIONES.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            className="cmv2-partic-decision-btn"
            data-decision={opcion.id}
            aria-pressed={actual?.decision === opcion.id}
            onClick={() => decidir(opcion.id)}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      {actual ? (
        <input
          className="cmv2-partic-nota"
          type="text"
          value={actual.nota ?? ""}
          placeholder="Nota opcional: por qué (queda documentada en el diseño)"
          aria-label={`Nota de la decisión sobre ${titulo || id}`}
          onChange={(e) => onDecisiones(setNotaParticularidad(decisiones, id, e.currentTarget.value))}
        />
      ) : null}
    </li>
  );
}

/** Cabecera de sección colapsable: ícono + título + contadores de decisión. */
function SeccionHead({
  icon,
  titulo,
  ids,
  decisiones,
  countTotal,
}: {
  icon: ReactNode;
  titulo: string;
  ids: string[];
  decisiones: Decisiones;
  /** Total real detectado (puede superar las filas mostradas por el cap). */
  countTotal: number;
}) {
  const resumen = resumenDecisiones(ids, decisiones);
  return (
    <summary className="cmv2-partic-summary">
      <span className="cmv2-partic-summary-icon" aria-hidden="true">{icon}</span>
      <strong>{titulo}</strong>
      <span className="cmv2-partic-summary-counts">
        {fmtInt(countTotal)} {countTotal === 1 ? "detectado" : "detectados"}
        {resumen.excluir > 0 ? ` · ${fmtInt(resumen.excluir)} a excluir` : ""}
        {resumen.pendientes > 0 && resumen.pendientes < resumen.total
          ? ` · ${fmtInt(resumen.pendientes)} sin decidir`
          : ""}
      </span>
    </summary>
  );
}

export function ParticularidadesPanel({
  particularidades,
  decisiones,
  onDecisiones,
}: {
  /** Señales normalizadas del frame (null = marco sin el análisis). */
  particularidades: CalcMuestraAulasParticularidades | null;
  decisiones: Decisiones;
  onDecisiones: (next: Decisiones) => void;
}) {
  const dominante = particularidades?.session_type_dominante ?? null;
  const multi = particularidades?.multi_facultad ?? [];
  const codigoZ = particularidades?.codigo_z ?? [];
  const tesis = particularidades?.nombre_tesis ?? [];
  const counts = particularidades?.counts ?? { multi_facultad: 0, codigo_z: 0, nombre_tesis: 0 };
  const haySenales = Boolean(
    dominante || counts.multi_facultad > 0 || counts.codigo_z > 0 || counts.nombre_tesis > 0,
  );

  return (
    <section className="cmv2-panel cmv2-partic" aria-label="Particularidades del marco">
      <header className="cmv2-partic-head">
        <div className="cmv2-marco-subhead">
          <span className="cmv2-eyebrow">Particularidades del marco</span>
          <strong>Casos detectados para tu revisión manual</strong>
        </div>
        <p className="cmv2-partic-lead">
          La app solo detecta y muestra estas señales (reunión del diseño muestral): la decisión es
          tuya y queda documentada. <strong>Las exclusiones se aplican al reconstruir el marco</strong>;
          incluir o marcar como revisado solo documenta.
        </p>
      </header>

      {!particularidades ? (
        <div className="cmv2-partic-empty">
          <Radar size={18} aria-hidden="true" />
          <p>
            El marco vigente no trae el análisis de particularidades (se construyó con una versión
            anterior del motor). Reconstruye el marco para detectarlas.
          </p>
        </div>
      ) : !haySenales ? (
        <div className="cmv2-partic-empty">
          <Radar size={18} aria-hidden="true" />
          <p>
            Sin señales detectadas en este marco: ningún curso multi-facultad, código Z ni nombre de
            tesis, y el tipo de curso no muestra agrupamiento.
          </p>
        </div>
      ) : (
        <div className="cmv2-partic-sections">
          {dominante ? (
            <details className="cmv2-partic-section" data-tone="warn">
              <summary className="cmv2-partic-summary">
                <span className="cmv2-partic-summary-icon" aria-hidden="true"><Layers size={15} /></span>
                <strong>Posible agrupamiento del tipo de curso</strong>
                <span className="cmv2-partic-summary-counts">
                  {Math.round(dominante.share * 100)}% en una sola categoría
                </span>
              </summary>
              <p className="cmv2-partic-note">
                El {Math.round(dominante.share * 100)}% de los cursos-horario cae en una sola categoría
                {" "}<strong>“{dominante.categoria}”</strong>
                {dominante.total_categorias > 0 ? ` (de ${fmtInt(dominante.total_categorias)} observadas)` : ""} —
                señal de que DTI entregó el tipo de curso agrupado. Pide el dato desagregado (teórico,
                laboratorio, taller, seminario…) antes de usar este criterio como corte.
              </p>
            </details>
          ) : null}

          {counts.multi_facultad > 0 ? (
            <details className="cmv2-partic-section">
              <SeccionHead
                icon={<Split size={15} />}
                titulo="Cursos que sirven a ≥2 facultades"
                ids={multi.map((row) => row.id)}
                decisiones={decisiones}
                countTotal={counts.multi_facultad}
              />
              <p className="cmv2-partic-note">
                Señal de estudios generales o de un electivo compartido: el aula cubre la cuota de la
                facultad de sus alumnos, no de la carrera destino.
              </p>
              {counts.multi_facultad > multi.length ? (
                <p className="cmv2-partic-cap">
                  Mostrando los primeros {fmtInt(multi.length)} de {fmtInt(counts.multi_facultad)}.
                </p>
              ) : null}
              <ul className="cmv2-partic-list">
                {multi.map((row) => (
                  <ParticularidadFila
                    key={row.id}
                    id={row.id}
                    titulo={row.curso}
                    meta={
                      row.facultades.length
                        ? `${fmtInt(row.n_facultades)} facultades · ${row.facultades.join(" · ")}`
                        : `${fmtInt(row.n_facultades)} facultades`
                    }
                    decisiones={decisiones}
                    onDecisiones={onDecisiones}
                  />
                ))}
              </ul>
            </details>
          ) : null}

          {counts.codigo_z > 0 || counts.nombre_tesis > 0 ? (
            <details className="cmv2-partic-section">
              <SeccionHead
                icon={<MapPin size={15} />}
                titulo="Local externo y nombres de tesis"
                ids={[...codigoZ.map((row) => row.id), ...tesis.map((row) => row.id)]}
                decisiones={decisiones}
                countTotal={counts.codigo_z + counts.nombre_tesis}
              />
              {counts.codigo_z > 0 ? (
                <div className="cmv2-partic-subblock">
                  <h4 className="cmv2-partic-subtitle">
                    <MapPin size={13} aria-hidden="true" /> Cursos con código Z (local externo)
                  </h4>
                  <p className="cmv2-partic-note">
                    Nota de campo: el aula se dicta fuera del campus e implica desplazamiento del
                    encuestador.
                  </p>
                  <ul className="cmv2-partic-list">
                    {codigoZ.map((row) => (
                      <ParticularidadFila
                        key={row.id}
                        id={row.id}
                        titulo={row.curso}
                        meta={row.codigo ? `código ${row.codigo}` : ""}
                        decisiones={decisiones}
                        onDecisiones={onDecisiones}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
              {counts.nombre_tesis > 0 ? (
                <div className="cmv2-partic-subblock">
                  <h4 className="cmv2-partic-subtitle">
                    <GraduationCap size={13} aria-hidden="true" /> Cursos con nombre de tesis
                  </h4>
                  <p className="cmv2-partic-note">
                    Nota de campo: suelen tener baja asistencia presencial, salvo en 9.º–10.º ciclo.
                  </p>
                  <ul className="cmv2-partic-list">
                    {tesis.map((row) => (
                      <ParticularidadFila
                        key={row.id}
                        id={row.id}
                        titulo={row.curso}
                        meta={row.nivel ? `nivel ${row.nivel}` : ""}
                        decisiones={decisiones}
                        onDecisiones={onDecisiones}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}
