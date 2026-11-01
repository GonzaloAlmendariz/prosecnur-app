import { memo, useRef, useState, type ReactNode } from "react";
import { Download, Upload } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import type { ContextoDeInsumos } from "./contextoDeInsumos";
import {
  construirAplicadores,
  readinessDeAplicadores,
  ROTULO_DIA,
  TOPE_POR_VIAJE,
  type FilaDeAplicador,
} from "./aplicadoresModelo";
import "./insumos.css";

const DIAS = Object.keys(ROTULO_DIA) as Array<keyof typeof ROTULO_DIA>;

function Semana({ semana }: { semana: FilaDeAplicador["semana"] }) {
  return (
    <span className="aulas-ins-semana" aria-hidden="true">
      {DIAS.map((d) => (
        <span key={d} className="aulas-ins-dia" title={ROTULO_DIA[d]}>
          {semana[d].map((s, i) => <i key={i} style={{ left: `${s.izquierda}%`, width: `${s.ancho}%` }} />)}
        </span>
      ))}
    </span>
  );
}

/**
 * Insumos › Aplicadores (ficha I3), por tramo. Izquierda: cada aplicador con su
 * semana declarada y lo que le tocó en el tramo (citas, fijadas por el equipo,
 * días de viaje y el máximo por viaje contra el tope de cuatro). Derecha: los
 * tramos del operativo y si la distribución que ven los aplicadores está al día.
 */
function AplicadoresAulasImpl({ dashboard, cargando, vacioSinTablero, contexto }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  contexto: ContextoDeInsumos;
}) {
  const [tramo, setTramo] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  const modelo = cargando ? null : construirAplicadores(dashboard, contexto.config, tramo);
  const readiness = readinessDeAplicadores(cargando, modelo);

  if (!modelo) return <section className="aulas-ins aulas-ins--silueta" aria-label="Aplicadores" aria-busy="true" data-audit-ready={readiness} />;
  if (!dashboard) return <section className="aulas-ins" aria-label="Aplicadores" data-audit-ready={readiness}>{vacioSinTablero}</section>;

  const acciones = (
    <span className="aulas-ins-acciones">
      {contexto.plantillaDisponibilidad ? (
        <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" onClick={contexto.plantillaDisponibilidad} disabled={contexto.ocupado}>
          <Download size={14} aria-hidden="true" /> Plantilla
        </button>
      ) : null}
      {contexto.importarDisponibilidad ? (
        <>
          <input
            ref={archivo}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && window.confirm("Importar reemplaza la disponibilidad entera de todos los aplicadores. ¿Continuar?")) {
                contexto.importarDisponibilidad?.(f);
              }
            }}
          />
          <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" onClick={() => archivo.current?.click()} disabled={contexto.ocupado}>
            <Upload size={14} aria-hidden="true" /> Importar disponibilidad
          </button>
        </>
      ) : null}
    </span>
  );

  if (modelo.estado === "sin-datos") {
    return (
      <section className="aulas-ins aulas-ins--una" aria-label="Aplicadores" data-audit-ready={readiness}>
        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-apl-titulo">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-apl-titulo">Aplicadores</h3>
            {acciones}
          </header>
          <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">{modelo.causa}</p>
        </section>
      </section>
    );
  }

  return (
    <section
      className="aulas-ins aulas-ins--apl"
      aria-label="Aplicadores"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-insumos-aplicadores"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-ins-izquierda" data-qa-geometry-member="izquierda" data-qa-geometry-group="aulas-insumos-apl-izquierda" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-apl-titulo" data-qa-geometry-member="aplicadores">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-apl-titulo">Aplicadores del tramo</h3>
            {modelo.elegido ? <span className="aulas-ins-sub">{modelo.elegido.nombre} · {modelo.elegido.rango}</span> : null}
            {acciones}
          </header>
          {modelo.tramos.length > 1 ? (
            <div className="aulas-ins-tramos-selector" role="group" aria-label="Tramo">
              {modelo.tramos.map((t) => (
                <button
                  key={t.nombre}
                  type="button"
                  className={t.elegido ? "is-activo" : undefined}
                  aria-pressed={t.elegido}
                  onClick={() => setTramo(t.nombre)}
                >
                  {t.nombre}{t.vigente ? " · vigente" : ""}
                </button>
              ))}
            </div>
          ) : null}
          <div className="aulas-ins-tabla-marco aulas-ins-apl-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Aplicadores, con desplazamiento">
            <table className="aulas-ins-tabla" aria-labelledby="aulas-ins-apl-titulo">
              <thead>
                <tr>
                  <th scope="col">Aplicador</th>
                  <th scope="col" title="Disponibilidad declarada de lunes a sábado, de 7:00 a 22:00">Disponible</th>
                  <th scope="col" className="is-num">Horas</th>
                  <th scope="col" className="is-num" title="Citas que le asignó el reparto en este tramo">Citas</th>
                  <th scope="col" className="is-num" title="Fijadas a mano por el equipo: mandan sobre el reparto">Fijadas</th>
                  <th scope="col" className="is-num" title="Días distintos con citas: cada uno es un viaje">Viajes</th>
                  <th scope="col" className="is-num" title={`Máximo de cursos-horario en un mismo viaje; el tope blando es ${TOPE_POR_VIAJE}`}>Máx. por viaje</th>
                  <th scope="col" className="is-num">Aplicadas</th>
                </tr>
              </thead>
              <tbody>
                {modelo.filas.map((f) => (
                  <tr key={f.nombre}>
                    <th scope="row">{f.nombre}</th>
                    <td>{f.sinDisponibilidad ? <span className="aulas-ins-chip" data-tono="aviso">Sin disponibilidad declarada</span> : <Semana semana={f.semana} />}</td>
                    <td className="is-num">{f.horas ? fmt(Math.round(f.horas)) : "—"}</td>
                    <td className="is-num">{modelo.fueraDelReparto ? "—" : fmt(f.citas)}</td>
                    <td className="is-num">{f.fijadas ? fmt(f.fijadas) : "—"}</td>
                    <td className="is-num">{f.dias ? fmt(f.dias) : "—"}</td>
                    <td className="is-num">
                      {f.maxPorDia ? (f.sobreTope ? <span className="aulas-ins-chip" data-tono="aviso">{f.maxPorDia}</span> : fmt(f.maxPorDia)) : "—"}
                    </td>
                    <td className="is-num">{f.aplicadas ? fmt(f.aplicadas) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aulas-ins-pie">{modelo.pie}</p>
        </section>
      </div>

      <div className="aulas-ins-derecha" data-qa-geometry-member="derecha" data-qa-geometry-group="aulas-insumos-apl-derecha" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-dist-titulo" data-qa-geometry-member="distribucion">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-dist-titulo">Distribución que ven los aplicadores</h3>
            <span className="aulas-ins-chip" data-tono={modelo.distribucion.estado === "al-dia" ? "ok" : modelo.distribucion.estado === "desactualizada" ? "aviso" : "neutro"}>
              {modelo.distribucion.estado === "al-dia" ? "Al día" : modelo.distribucion.estado === "desactualizada" ? "Por actualizar" : "Sin Sheets"}
            </span>
          </header>
          <p className="aulas-ins-texto">{modelo.distribucion.texto}</p>
          <ol className="aulas-ins-mecanismo">
            <li>La app siembra la pestaña de cada semana una sola vez, con el reparto equitativo.</li>
            <li>Después sólo agrega filas por lo nuevo agendado y retira las cerradas al traer respuestas.</li>
            <li>Lo que el equipo fija o ajusta a mano manda: no se reescribe.</li>
          </ol>
        </section>

        <section className="aulas-ins-panel" aria-labelledby="aulas-ins-tramos-titulo" data-qa-geometry-member="tramos">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-ins-tramos-titulo">Tramos del operativo</h3>
          </header>
          {modelo.tramos.length ? (
            <ul className="aulas-ins-tramos" data-qa-geometry-group="aulas-insumos-tramos" data-qa-geometry-contract="equal">
              {modelo.tramos.map((t) => (
                <li key={t.nombre} data-qa-geometry-member={t.nombre} className={t.elegido ? "is-elegido" : undefined}>
                  <b>{t.nombre}</b>
                  <span className="aulas-ins-sub">{t.rango}{t.vigente ? " · vigente" : ""}</span>
                  <span className="is-num">{fmt(t.aplicadas)} de {fmt(t.citas)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">Sin tramos: el plan todavía no trae fechas agendadas.</p>
          )}
        </section>
      </div>
    </section>
  );
}

export const AplicadoresAulas = memo(AplicadoresAulasImpl);
