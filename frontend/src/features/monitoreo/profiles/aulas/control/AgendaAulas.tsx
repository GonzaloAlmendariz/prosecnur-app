import { memo, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { Link } from "react-router-dom";

import { ChipHora, ChipLugar } from "../AulasSistemaPabellon";
import { hrefDeFichaDeAula } from "../navegacion/direccionAulas";
import type { Vacio } from "../avance/porFacultadModelo";
import {
  construirAgenda,
  HORA_FIN,
  HORA_INICIO,
  readinessDeAgenda,
  type Cita,
  type FilaPendiente,
} from "./agendaModelo";
import "./agenda.css";

/** La fecha local del usuario, `YYYY-MM-DD`. */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Control › Agenda (ficha Ctl1, `docs/qa/revamp-monitoreo/aulas.md`). ¿Qué
 * citas tiene la semana y qué falta agendar?
 *
 * Desplazamiento: en escritorio amplio la vista llena el alto; cada lista de la
 * izquierda y la semana desplazan dentro de su marco. En compacto mide por
 * contenido y desplaza `.mon-profile-content` (C4).
 */
function AgendaAulasImpl({ dashboard, cargando, vacioSinTablero, hoy = hoyLocal() }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  /** Se recibe para que los tests fijen el día. */
  hoy?: string;
}) {
  const [semana, setSemana] = useState("");
  const modelo = useMemo(() => (cargando ? null : construirAgenda(dashboard, hoy, semana)), [cargando, dashboard, hoy, semana]);
  const readiness = readinessDeAgenda(modelo, cargando);

  if (!modelo) {
    return <section className="aulas-ag aulas-ag--silueta" aria-label="Agenda" aria-busy="true" data-audit-ready={readiness} />;
  }
  if (modelo.estado === "sin-tablero") {
    return <section className="aulas-ag aulas-ag--vacio" aria-label="Agenda" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  }

  return (
    <section
      className="aulas-ag"
      aria-label="Agenda"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-agenda"
      data-qa-geometry-contract="intrinsic"
    >
      <dl className="aulas-ag-franja" data-qa-geometry-member="franja" data-qa-geometry-group="aulas-agenda-franja" data-qa-geometry-contract="equal">
        {modelo.franja.map((c) => (
          <div key={c.clave} data-tono={c.tono} data-qa-geometry-member={c.clave}>
            <dt>{c.rotulo}</dt>
            <dd>{c.valor}</dd>
            <span>{c.sub}</span>
          </div>
        ))}
      </dl>
      <div className="aulas-ag-cuerpo" data-qa-geometry-member="cuerpo">
        <div className="aulas-ag-izquierda" data-qa-geometry-group="aulas-agenda-listas" data-qa-geometry-contract="intrinsic">
          <ListaPendiente titulo="Sin cita" tono="aviso" filas={modelo.sinCita} vacio="Todos los titulares tienen cita." />
          <ListaPendiente titulo="Citas vencidas" tono="riesgo" filas={modelo.vencidas} vacio="Ninguna cita vencida sin aplicar." />
        </div>
        <Semana modelo={modelo.semana} sinHora={modelo.sinHora} onSemana={setSemana} />
      </div>
    </section>
  );
}

function Nota({ vacio }: { vacio: Vacio }) {
  return (
    <p className="aulas-ag-nota" data-qa-geometry-empty={vacio.clase}>
      <Info size={14} aria-hidden="true" />
      <span>{vacio.causa}</span>
    </p>
  );
}

function ListaPendiente({ titulo, tono, filas, vacio }: { titulo: string; tono: "aviso" | "riesgo"; filas: FilaPendiente[]; vacio: string }) {
  const id = `aulas-ag-${tono}`;
  return (
    <section className="aulas-ag-panel aulas-ag-lista" aria-labelledby={id} data-qa-geometry-member={tono}>
      <header className="aulas-ag-cabecera">
        <h3 id={id} className="aulas-ag-titulo">{titulo}</h3>
        <span className="aulas-ag-cuenta" data-tono={tono}>{filas.length}</span>
      </header>
      {filas.length ? (
        <ul className="aulas-ag-pendientes" data-qa-geometry-capacity="owned" tabIndex={0} aria-label={`${titulo}, con desplazamiento`}>
          {filas.map((f) => (
            <li key={f.codigo}>
              <span className="aulas-ag-linea">
                <Link className="aulas-ag-ficha" to={hrefDeFichaDeAula(f.codigo)} title={`Abrir la ficha de ${f.codigo}`}><b>{f.codigo}</b></Link>
                {f.lugar ? <ChipLugar lugar={f.lugar} /> : null}
                <span className="aulas-ag-tenue">{f.elegibles} elegibles</span>
              </span>
              <span className="aulas-ag-linea is-detalle">
                <span className="aulas-ag-tenue">{f.facultad}</span>
                <span>{f.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <Nota vacio={{ clase: "legitimo", causa: vacio }} />}
    </section>
  );
}

const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
/** Escala de la semana: píxeles por hora y alto de una tarjeta. */
const PX_HORA = 56;
const ALTO_TARJETA = 68;
const ALTO_DIA = (HORA_FIN - HORA_INICIO) * PX_HORA;

/**
 * La posición de cada tarjeta en su día: en su hora, y si choca con la anterior
 * se apila debajo en el orden del día (dos citas a la misma hora no se pisan).
 * Las que no tienen hora legible van al pie.
 */
function posiciones(citas: Cita[]): number[] {
  let fondo = -Infinity;
  return citas.map((c) => {
    const y = c.minuto == null ? ALTO_DIA : (c.minuto / 60 - HORA_INICIO) * PX_HORA;
    const top = Math.max(0, y, fondo + 4);
    fondo = top + ALTO_TARJETA;
    return top;
  });
}

function Semana({ modelo, sinHora, onSemana }: {
  modelo: Extract<ReturnType<typeof construirAgenda>, { estado: "listo" }>["semana"];
  sinHora: number;
  onSemana: (lunes: string) => void;
}) {
  const id = "aulas-ag-semana-titulo";
  if ("vacio" in modelo) {
    return (
      <section className="aulas-ag-panel aulas-ag-semana" aria-labelledby={id}>
        <header className="aulas-ag-cabecera"><h3 id={id} className="aulas-ag-titulo">Semana</h3></header>
        <Nota vacio={modelo.vacio} />
      </section>
    );
  }
  const tops = modelo.dias.map((d) => posiciones(d.citas));
  const alto = Math.max(ALTO_DIA, ...tops.flat().map((t) => t + ALTO_TARJETA)) + 8;
  return (
    <section className="aulas-ag-panel aulas-ag-semana" aria-labelledby={id}>
      <header className="aulas-ag-cabecera">
        <h3 id={id} className="aulas-ag-titulo">{modelo.titulo}</h3>
        {sinHora ? <span className="aulas-ag-tenue">{sinHora} sin hora legible, al pie de su día</span> : null}
        <span className="aulas-ag-navegar">
          <button type="button" disabled={!modelo.anterior} onClick={() => modelo.anterior && onSemana(modelo.anterior)} aria-label="Semana anterior">
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button type="button" disabled={!modelo.siguiente} onClick={() => modelo.siguiente && onSemana(modelo.siguiente)} aria-label="Semana siguiente">
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </span>
      </header>
      <div
        className="aulas-ag-reticula"
        style={{ ["--aulas-ag-dias" as string]: modelo.dias.length }}
        data-qa-geometry-capacity="owned"
        data-qa-geometry-group="aulas-agenda-semana"
        data-qa-geometry-contract="intrinsic"
        tabIndex={0}
        aria-label="Citas de la semana, con desplazamiento"
      >
        <div className="aulas-ag-esquina" />
        {modelo.dias.map((d) => (
          <div key={d.fecha} className={`aulas-ag-dia-cabeza${d.esHoy ? " is-hoy" : ""}`} data-qa-geometry-member={`cabeza-${d.fecha}`}>
            <b>{d.rotulo}</b>
            <span>{d.citas.length} {d.citas.length === 1 ? "cita" : "citas"}</span>
            {d.esHoy ? <span className="aulas-ag-hoy">Hoy</span> : null}
          </div>
        ))}
        <div className="aulas-ag-horas" aria-hidden="true" style={{ height: alto }}>
          {HORAS.map((h) => <span key={h} style={{ top: (h - HORA_INICIO) * PX_HORA }}>{h}:00</span>)}
        </div>
        {modelo.dias.map((d, k) => (
          // Las citas se ubican por su hora (posición absoluta): el contrato es
          // de posición, no de rejilla.
          <ol
            key={d.fecha}
            className={`aulas-ag-columna${d.esHoy ? " is-hoy" : ""}`}
            aria-label={`Citas del ${d.rotulo}`}
            style={{ height: alto }}
            data-qa-geometry-member={`dia-${d.fecha}`}
            // Un día sin citas no es un grupo vacío: es un vacío legítimo.
            {...(d.citas.length
              ? { "data-qa-geometry-group": `aulas-agenda-dia-${d.fecha}`, "data-qa-geometry-contract": "intrinsic" }
              : { "data-qa-geometry-empty": "legitimo", "data-qa-geometry-capacity": "owned" })}
          >
            {d.citas.map((c, i) => <TarjetaDeCita key={`${c.codigo}-${i}`} cita={c} top={tops[k][i]} />)}
          </ol>
        ))}
      </div>
    </section>
  );
}

function TarjetaDeCita({ cita, top }: { cita: Cita; top: number }) {
  return (
    <li className="aulas-ag-cita" data-estado={cita.estado} style={{ top, height: ALTO_TARJETA }} data-qa-geometry-member={cita.codigo}>
      <span className="aulas-ag-linea">
        <Link className="aulas-ag-ficha" to={hrefDeFichaDeAula(cita.codigo)} title={`Abrir la ficha de ${cita.codigo}`}><b>{cita.codigo}</b></Link>
        <span className="aulas-ag-tenue aulas-ag-papel">{cita.papel}</span>
      </span>
      {/* Hora y lugar en su propia línea: junto al código, a 1024 la hora se
          salía de la tarjeta («Por confirmar», 21 px). */}
      <span className="aulas-ag-linea aulas-ag-chips">
        {cita.hora ? <ChipHora>{cita.hora}</ChipHora> : null}
        {cita.lugar ? <ChipLugar lugar={cita.lugar} /> : null}
      </span>
      <span className="aulas-ag-estado">{cita.texto}</span>
    </li>
  );
}

export const AgendaAulas = memo(AgendaAulasImpl);
