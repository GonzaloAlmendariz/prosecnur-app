import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Info } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { esFocoDelEje, focoDesdeTexto } from "../AulasCuotasResumen";
import { fmt } from "../kpisDeAulas";
import {
  construirResumenAulas,
  readinessDelResumen,
  type Invariante,
  type ModeloResumenAulas,
  type Protagonista,
  type Ritmo,
} from "./resumenAulasModelo";
import "./resumenAulas.css";

/**
 * Avance › Resumen de Cursos-horario (ficha A1, `docs/qa/revamp-monitoreo/aulas.md`).
 *
 * Izquierda, 400 px: la cifra protagonista con su anillo y «De las efectivas a
 * la cuota», las seis partes del invariante. Derecha: las efectivas acumuladas
 * por día con las metas en carmesí discontinuo. Abajo, una tarjeta por grupo
 * del eje (facultad o nivel), de menor a mayor avance y las que no tienen
 * cuota al final. Todo se lee del tablero que ya publica el motor.
 */
function ResumenAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  /** El vacío del perfil sin tablero (plan sin importar, fuentes, error de lectura). */
  vacioSinTablero: ReactNode;
}) {
  const modelo = useMemo(() => (cargando ? null : construirResumenAulas(dashboard)), [cargando, dashboard]);
  const readiness = readinessDelResumen(modelo, cargando);

  if (!modelo) return <Silueta readiness={readiness} />;

  if (modelo.estado === "sin-tablero") {
    return (
      <section className="aulas-res aulas-res--vacio" aria-label="Resumen del avance" data-audit-ready={readiness}>
        {vacioSinTablero}
      </section>
    );
  }

  return (
    <section
      className="aulas-res"
      aria-label="Resumen del avance"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-resumen"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-res-arriba" data-qa-geometry-member="arriba">
        <div className="aulas-res-izquierda">
          <Cifra protagonista={modelo.protagonista} />
          <DeLasEfectivasALaCuota invariante={modelo.invariante} />
        </div>
        <Acumuladas ritmo={modelo.ritmo} />
      </div>
      <PorGrupo modelo={modelo} />
    </section>
  );
}

/** S1: la misma silueta mientras se prepara el corte, con el tiempo que lleva. */
function Silueta({ readiness }: { readiness: string }) {
  const segundos = useTranscurrido();
  const reloj = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  return (
    <section className="aulas-res aulas-res--silueta" aria-label="Resumen del avance" aria-busy="true" data-audit-ready={readiness}>
      <div className="aulas-res-arriba">
        <div className="aulas-res-izquierda">
          <div className="aulas-res-panel aulas-res-silueta-bloque is-cifra">
            <p className="aulas-res-preparando" role="status">
              Preparando el corte <span className="aulas-res-num">{reloj}</span>
            </p>
          </div>
          <div className="aulas-res-panel aulas-res-silueta-bloque is-partes" />
        </div>
        <div className="aulas-res-panel aulas-res-silueta-bloque is-grafico" />
      </div>
      <div className="aulas-res-panel aulas-res-silueta-bloque is-grupos" />
    </section>
  );
}

function useTranscurrido() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const id = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return segundos;
}

function Cifra({ protagonista }: { protagonista: Protagonista }) {
  const radio = 50;
  const circunferencia = 2 * Math.PI * radio;
  const { cuentan, muestra, chip } = protagonista;
  return (
    <section className="aulas-res-panel aulas-res-cifra" aria-labelledby="aulas-res-cifra-titulo">
      <div className="aulas-res-cifra-fila">
        <svg className="aulas-res-anillo" viewBox="0 0 112 112" role="img" aria-label={`Avance a la muestra: ${protagonista.avanceTexto}`}>
          <circle cx="56" cy="56" r={radio} className="aulas-res-anillo-fondo" />
          {protagonista.proporcion > 0 ? (
            <circle
              cx="56"
              cy="56"
              r={radio}
              className="aulas-res-anillo-valor"
              strokeDasharray={`${circunferencia * protagonista.proporcion} ${circunferencia}`}
              transform="rotate(-90 56 56)"
            />
          ) : null}
          <text x="56" y="56" textAnchor="middle" dominantBaseline="central">{protagonista.avanceTexto}</text>
        </svg>
        <div className="aulas-res-cifra-texto">
          <h3 id="aulas-res-cifra-titulo" className="aulas-res-rotulo">Cuentan para la muestra</h3>
          <p className="aulas-res-cifra-numero">
            <b>{cuentan == null ? "—" : fmt(cuentan)}</b>
            <span>de {muestra == null ? "—" : fmt(muestra)}</span>
          </p>
          <span className="aulas-res-chip" data-tono={chip.tono}>
            {chip.tono === "ok" ? <Check size={13} aria-hidden="true" /> : null}
            {chip.texto}
          </span>
        </div>
      </div>
      {protagonista.causa ? (
        <p className="aulas-res-nota" data-qa-geometry-empty="desconexion">
          <Info size={14} aria-hidden="true" />
          <span>{protagonista.causa}</span>
        </p>
      ) : null}
      <dl className="aulas-res-secundarios">
        {protagonista.secundarios.map((dato) => (
          <div key={dato.rotulo} title={dato.titulo}>
            <dt>{dato.rotulo}</dt>
            <dd>{dato.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DeLasEfectivasALaCuota({ invariante }: { invariante: Invariante }) {
  return (
    <section className="aulas-res-panel aulas-res-partes" aria-labelledby="aulas-res-partes-titulo">
      <header className="aulas-res-cabecera">
        <h3 id="aulas-res-partes-titulo" className="aulas-res-titulo">De las efectivas a la cuota</h3>
        <span className="aulas-res-sub">
          {invariante.total == null ? "Sin total de efectivas en este corte" : `${fmt(invariante.total)}, cada una en un solo lugar`}
        </span>
      </header>
      <dl className="aulas-res-lista">
        {invariante.partes.map((parte) => (
          <div key={parte.clave} className={parte.principal ? "is-principal" : parte.valor ? "" : "is-cero"}>
            <dt>{parte.rotulo}</dt>
            <dd title={parte.valor == null ? "Este corte no trae esta parte" : undefined}>
              {parte.valor == null ? "—" : fmt(parte.valor)}
            </dd>
          </div>
        ))}
      </dl>
      {invariante.descuadre ? (
        <p className="aulas-res-nota is-aviso" role="note">
          <Info size={14} aria-hidden="true" />
          <span>{invariante.descuadre}</span>
        </p>
      ) : null}
    </section>
  );
}

function Acumuladas({ ritmo }: { ritmo: Ritmo }) {
  return (
    <section className="aulas-res-panel aulas-res-ritmo" aria-labelledby="aulas-res-ritmo-titulo" data-qa-geometry-member="ritmo">
      <header className="aulas-res-cabecera">
        <h3 id="aulas-res-ritmo-titulo" className="aulas-res-titulo">Efectivas acumuladas</h3>
        {ritmo.tipo === "serie" ? <span className="aulas-res-sub">{ritmo.resumen}</span> : null}
        <span className="aulas-res-leyenda" aria-hidden="true">
          <span className="is-acumulado">Acumulado</span>
          <span className="is-dia">Del día</span>
          <span className="is-meta">Meta</span>
        </span>
      </header>
      {ritmo.tipo === "serie" ? (
        <div className="aulas-res-grafico" data-qa-geometry-capacity="owned">
          <div className="aulas-res-lienzo">
            <div className="aulas-res-eje-y" aria-hidden="true">
              {ritmo.marcasY.map((m) => (
                <span key={m.valor} style={{ top: `${m.y}%` }}>{m.texto}</span>
              ))}
              <span className="aulas-res-eje-banda" style={{ top: `${(ritmo.bandaDia + 100) / 2}%` }}>Del día</span>
            </div>
            <div className="aulas-res-trazado">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={ritmo.aria}>
                {ritmo.marcasY.map((m) => (
                  <line key={m.valor} x1="0" x2="100" y1={m.y} y2={m.y} className="aulas-res-guia" />
                ))}
                <line x1="0" x2="100" y1="100" y2="100" className="aulas-res-guia" />
                {ritmo.dias.map((d) => (
                  <rect key={d.fecha} x={d.x - d.ancho / 2} y={d.yDia} width={d.ancho} height={100 - d.yDia} className="aulas-res-barra" />
                ))}
                <path d={ritmo.trazo} className="aulas-res-linea" />
                {ritmo.metas.map((m) => (
                  <line key={m.clave} x1="0" x2="100" y1={m.y} y2={m.y} className="aulas-res-meta" />
                ))}
              </svg>
              {ritmo.metas.map((m) => (
                <span key={m.clave} className="aulas-res-meta-rotulo" style={{ top: `${m.y}%` }}>
                  {m.rotulo}, {fmt(m.valor)}
                </span>
              ))}
              {ritmo.dias.filter((d) => d.rotuloDia).map((d) => (
                <span key={d.fecha} className="aulas-res-dia-cifra" style={{ left: `${d.x}%`, top: `${d.yDia}%` }}>
                  {d.rotuloDia}
                </span>
              ))}
            </div>
          </div>
          <div className="aulas-res-eje-x" aria-hidden="true">
            <div className="aulas-res-eje-x-pista">
              {ritmo.marcasX.map((m) => <span key={m.texto} style={{ left: `${m.x}%` }}>{m.texto}</span>)}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="aulas-res-grafico aulas-res-grafico--vacio"
          data-qa-geometry-capacity="owned"
          data-qa-geometry-empty={ritmo.tipo === "sin-dias" ? "legitimo" : "desconexion"}
        >
          <p className="aulas-res-nota">
            <Info size={14} aria-hidden="true" />
            <span>{ritmo.causa}</span>
          </p>
        </div>
      )}
    </section>
  );
}

function PorGrupo({ modelo }: { modelo: ModeloResumenAulas }) {
  const [focoTexto, escribirFoco] = useFocoMonitoreo();
  const foco = focoDesdeTexto(focoTexto);
  const enFoco = esFocoDelEje(foco, modelo.eje.clave) ? foco?.valor ?? "" : "";
  const tipo = modelo.eje.clave === "nivel" ? "nivel" : "facultad";
  const { titulo, tarjetas, vacio } = modelo.grupos;
  return (
    <section className="aulas-res-panel aulas-res-grupos" aria-labelledby="aulas-res-grupos-titulo" data-qa-geometry-member="grupos">
      <header className="aulas-res-cabecera">
        <h3 id="aulas-res-grupos-titulo" className="aulas-res-titulo">{titulo}</h3>
        {tarjetas.length ? <span className="aulas-res-sub">de menor a mayor avance</span> : null}
      </header>
      {vacio ? (
        <p className="aulas-res-nota" data-qa-geometry-empty="legitimo">
          <Info size={14} aria-hidden="true" />
          <span>{vacio}</span>
        </p>
      ) : (
        <ul className="aulas-res-tarjetas" data-qa-geometry-group="aulas-resumen-grupos" data-qa-geometry-contract="equal">
          {tarjetas.map((t) => {
            const activa = enFoco !== "" && enFoco === t.valor;
            return (
              <li key={t.clave}>
                <button
                  type="button"
                  className="aulas-res-tarjeta"
                  data-tono={t.tono}
                  aria-pressed={activa}
                  aria-label={t.aria}
                  title={activa ? "Quitar el foco" : `Poner el foco en ${t.nombre}`}
                  onClick={() => escribirFoco(activa ? null : `${tipo}:${t.valor}`)}
                >
                  <span className="aulas-res-tarjeta-cabeza">
                    <b>{t.nombre}</b>
                    <b className="aulas-res-num">{t.avanceTexto}</b>
                  </span>
                  <span className="aulas-res-tarjeta-lectura">{t.lectura}</span>
                  <span className="aulas-res-tarjeta-barra" aria-hidden="true">
                    <i style={{ width: `${t.relleno}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const ResumenAulas = memo(ResumenAulasImpl);
