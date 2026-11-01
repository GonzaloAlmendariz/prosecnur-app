import { memo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import type { MonitoreoAulasConfig, MonitoreoAulasDashboard, MonitoreoAulasSincronizacion } from "../../../../../api/monitoreo";
import { PulsoSwitch } from "../../../../../components/PulsoSwitch";
import { ChipLugar } from "../AulasSistemaPabellon";
import { fmt } from "../kpisDeAulas";
import {
  construirDistribucion,
  HORA_FIN,
  HORA_INICIO,
  readinessDeDistribucion,
} from "./distribucionModelo";
import "../insumos/insumos.css";
import "./distribucion.css";

/** Lo que Distribución toma de la página: la config y las acciones del reparto. */
export type ContextoDeDistribucion = {
  config: MonitoreoAulasConfig | null | undefined;
  ocupado: boolean;
  onConcentrar?: ((valor: boolean) => void) | null;
  onResortear?: ((semillaSiguiente: number) => void) | null;
  onPublicarDistribucion?: (() => void) | null;
  /** `false` ensaya y dice qué haría; `true` agrega lo nuevo a la hoja. */
  onSincronizarDistribucion?: ((aplicar: boolean) => void) | null;
  sincronizacion?: MonitoreoAulasSincronizacion | null;
};

const HORAS = Array.from({ length: (HORA_FIN - HORA_INICIO) / 2 + 1 }, (_, i) => HORA_INICIO + 2 * i).filter((h) => h < HORA_FIN);

/**
 * Control › Distribución (ficha Ctl3). El reparto del día por aplicador sobre
 * la escala de 7:00 a 22:00; a la derecha, la hoja de los aplicadores con su
 * mecanismo, el cruce con la agenda y las citas por aplicador.
 */
function DistribucionAulasImpl({ dashboard, cargando, vacioSinTablero, contexto }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  contexto: ContextoDeDistribucion;
}) {
  const [dia, setDia] = useState("");
  const modelo = cargando ? null : construirDistribucion(dashboard, contexto.config, dia);
  const readiness = readinessDeDistribucion(cargando, modelo);
  if (!modelo) return <section className="aulas-ins aulas-ins--silueta" aria-label="Distribución" aria-busy="true" data-audit-ready={readiness} />;
  if (modelo.estado === "sin-tablero") return <section className="aulas-ins" aria-label="Distribución" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  if (modelo.estado === "sin-reparto") {
    return (
      <section className="aulas-ins aulas-ins--una" aria-label="Distribución" data-audit-ready={readiness}>
        <section className="aulas-ins-panel"><p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">{modelo.causa}</p></section>
      </section>
    );
  }
  const lugarDe = new Map<string, string>(
    ((dashboard?.agenda ?? []) as Array<Record<string, unknown>>).map((f) => [
      String(f.operational_code ?? ""), String(f.scheduled_venue ?? f.venue ?? ""),
    ]),
  );
  const semilla = Number(contexto.config?.reparto_semilla ?? 0) || 0;
  const sinc = contexto.sincronizacion;

  return (
    <section
      className="aulas-ins aulas-ins--dist"
      aria-label="Distribución"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-distribucion"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="aulas-ins-panel" aria-labelledby="aulas-dist-titulo" data-qa-geometry-member="reparto">
        <header className="aulas-ins-cabecera">
          <h3 id="aulas-dist-titulo">Reparto del {modelo.rango}</h3>
          <span className="aulas-ins-sub">{fmt(modelo.fijadas)} fijadas desde la hoja</span>
          <span className="aulas-ins-acciones">
            {contexto.onConcentrar ? (
              <PulsoSwitch
                size="sm"
                checked={modelo.concentrado}
                disabled={contexto.ocupado}
                onCheckedChange={(valor) => contexto.onConcentrar?.(valor)}
                label="Concentrar el día de cada aplicador"
              />
            ) : null}
            {contexto.onResortear ? (
              <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" disabled={contexto.ocupado} onClick={() => contexto.onResortear?.(semilla + 1)}>
                <RefreshCw size={14} aria-hidden="true" /> Resortear
              </button>
            ) : null}
          </span>
        </header>
        <div className="aulas-ins-tramos-selector" role="group" aria-label="Día">
          {modelo.dias.map((d) => (
            <button key={d.fecha} type="button" className={d.fecha === modelo.elegido ? "is-activo" : undefined} aria-pressed={d.fecha === modelo.elegido} onClick={() => setDia(d.fecha)}>
              {d.rotulo} · {d.citas}
            </button>
          ))}
        </div>
        <div className="aulas-dist-marco" data-qa-geometry-capacity="owned" data-qa-geometry-group="aulas-dist-marco" data-qa-geometry-contract="equal" tabIndex={0} aria-label="Reparto del día, con desplazamiento">
          <div className="aulas-dist-escala" aria-hidden="true">
            <span />
            <span className="aulas-dist-horas">
              {HORAS.map((h) => <i key={h} style={{ left: `${(100 * (h - HORA_INICIO)) / (HORA_FIN - HORA_INICIO)}%` }}>{h}:00</i>)}
            </span>
          </div>
          {modelo.filas.map((f) => (
            <div key={f.aplicador} className="aulas-dist-fila" data-qa-geometry-member={f.aplicador}>
              <span className="aulas-dist-nombre">
                <b>{f.aplicador}</b>
                <small>{fmt(f.semana)} en el rango</small>
              </span>
              <span className="aulas-dist-linea" data-qa-geometry-capacity="owned">
                {f.disponible.map((b, i) => <i key={`d${i}`} className="is-disponible" style={{ left: `${b.izquierda}%`, width: `${b.ancho}%` }} />)}
                {f.citas.map((c) => (
                  <span key={c.codigo}>
                    {c.recojo ? <i className="is-recojo" style={{ left: `${c.recojo.izquierda}%`, width: `${c.recojo.ancho}%` }} /> : null}
                    <span
                      className={`aulas-dist-cita${c.fijada ? " is-fijada" : ""}`}
                      style={{ left: `${c.izquierda}%` }}
                      title={[c.fijada ? "Fijada desde la hoja" : "", c.advertencia].filter(Boolean).join(" · ") || undefined}
                    >
                      <b>{c.codigo}</b> {c.inicio}
                      {lugarDe.get(c.codigo) ? <ChipLugar lugar={lugarDe.get(c.codigo)!} /> : null}
                    </span>
                  </span>
                ))}
                {!f.citas.length ? <small className="aulas-dist-sin">sin citas este día</small> : null}
              </span>
            </div>
          ))}
        </div>
        <p className="aulas-ins-pie aulas-dist-leyenda">
          <i className="is-cita" /> Cita <i className="is-fijada" /> Fijada desde la hoja <i className="is-recojo" /> Recojo y traslado <i className="is-disponible" /> Disponible según su declaración
        </p>
      </section>

      <div className="aulas-ins-derecha" data-qa-geometry-member="derecha" data-qa-geometry-group="aulas-control-distribucion-derecha" data-qa-geometry-contract="intrinsic">
        <section className="aulas-ins-panel" aria-labelledby="aulas-dist-hoja" data-qa-geometry-member="hoja">
          <header className="aulas-ins-cabecera">
            <h3 id="aulas-dist-hoja">Hoja de los aplicadores</h3>
            <span className="aulas-ins-chip" data-tono={!modelo.hoja.conectada ? "neutro" : modelo.hoja.desactualizada ? "aviso" : "ok"}>
              {!modelo.hoja.conectada ? "Sin hoja" : modelo.hoja.desactualizada ? "Por actualizar" : "Al día"}
            </span>
          </header>
          <p className="aulas-ins-texto">{modelo.hoja.texto}</p>
          <ol className="aulas-ins-mecanismo">
            <li>Cada semana se siembra una sola vez con este reparto.</li>
            <li>Después sólo se agrega lo nuevo y se retiran las cerradas.</li>
            <li>Lo que el equipo ajusta a mano en la hoja manda.</li>
          </ol>
          <div className="aulas-ins-acciones aulas-dist-hoja-acciones">
            {!modelo.hoja.conectada && contexto.onPublicarDistribucion ? (
              <button type="button" className="pulso-button is-primary pulso-button--sm" disabled={contexto.ocupado} onClick={() => contexto.onPublicarDistribucion?.()}>
                Crear la hoja de los aplicadores
              </button>
            ) : null}
            {modelo.hoja.conectada && contexto.onSincronizarDistribucion ? (
              <>
                <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" disabled={contexto.ocupado} onClick={() => contexto.onSincronizarDistribucion?.(false)}>
                  Revisar cambios
                </button>
                <button type="button" className="pulso-button is-primary pulso-button--sm" disabled={contexto.ocupado} onClick={() => contexto.onSincronizarDistribucion?.(true)}>
                  Agregar lo nuevo a la hoja
                </button>
              </>
            ) : null}
          </div>
          {sinc ? (
            <p className="aulas-ins-pie" role="status">
              {sinc.aplicado ? "Aplicado" : "Ensayo"}: {fmt(sinc.anadidas.length)} filas nuevas, {fmt(sinc.descartadas.length)} descartadas, {fmt(sinc.estado.conflictos.length)} conflictos con lo tecleado.
            </p>
          ) : null}
        </section>

        <section className="aulas-ins-panel" aria-labelledby="aulas-dist-cruce" data-qa-geometry-member="cruce">
          <header className="aulas-ins-cabecera"><h3 id="aulas-dist-cruce">Cruce con la agenda</h3></header>
          <dl className="aulas-ins-union" data-qa-geometry-group="aulas-control-distribucion-cruce" data-qa-geometry-contract="equal">
            {modelo.cruce.map((c) => (
              <div key={c.clave} data-qa-geometry-member={c.clave} title={c.detalle || undefined}>
                <dt>{c.rotulo}</dt>
                <dd data-tono={c.valor ? "aviso" : "ok"}>{fmt(c.valor)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="aulas-ins-panel" aria-labelledby="aulas-dist-equidad" data-qa-geometry-member="equidad">
          <header className="aulas-ins-cabecera"><h3 id="aulas-dist-equidad">Citas por aplicador</h3></header>
          <ul className="aulas-dist-equidad">
            {modelo.equidad.map((e) => (
              <li key={e.aplicador}>
                <span>{e.aplicador}</span>
                <i style={{ width: `${e.ancho}%` }} />
                <b>{fmt(e.citas)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

export const DistribucionAulas = memo(DistribucionAulasImpl);
