import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, X } from "lucide-react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { focoDesdeTexto } from "../AulasCuotasResumen";
import { fmt } from "../kpisDeAulas";
import { hrefDeFichaDeAula } from "../navegacion/direccionAulas";
import {
  construirCursosHorario,
  readinessDeCursosHorario,
  type Cobertura,
  type FilaDeCursoHorario,
  type TablaDeCursos,
  type Titulares,
} from "./cursosHorarioModelo";
import type { Vacio } from "./porFacultadModelo";
import "./cursosHorario.css";

/**
 * Avance › Cursos-horario (ficha A3, `docs/qa/revamp-monitoreo/aulas.md`).
 * ¿Cómo rindió cada curso-horario aplicado?
 *
 * A la izquierda, cada curso-horario contra su tasa prevista, del que más se
 * aleja hacia abajo; a la derecha, los titulares del sorteo y la cobertura de
 * lo esperado.
 *
 * Desplazamiento: en escritorio amplio la tabla tiene marco propio con la
 * cabecera fija y la vista llena el alto; en compacto (≤ 1180 px de ancho o
 * ≤ 720 px de alto) la vista mide por contenido y desplaza
 * `.mon-profile-content`, el dueño de scroll del perfil (C4).
 */
function CursosHorarioAulasImpl({ dashboard, cargando, vacioSinTablero }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  /** El vacío del perfil sin tablero (plan sin importar, fuentes, error de lectura). */
  vacioSinTablero: ReactNode;
}) {
  const [focoTexto, escribirFoco] = useFocoMonitoreo();
  const foco = focoDesdeTexto(focoTexto);
  // Sólo el foco de facultad filtra cursos-horario: el de nivel o sexo no es
  // una propiedad del curso-horario.
  const facultad = foco?.tipo === "facultad" ? foco.valor : "";
  const modelo = useMemo(
    () => (cargando ? null : construirCursosHorario(dashboard, facultad)),
    [cargando, dashboard, facultad],
  );
  const readiness = readinessDeCursosHorario(modelo, cargando);

  if (!modelo) return <Silueta readiness={readiness} />;

  if (modelo.estado === "sin-tablero") {
    return (
      <section className="aulas-ch aulas-ch--vacio" aria-label="Cursos-horario" data-audit-ready={readiness}>
        {vacioSinTablero}
      </section>
    );
  }

  return (
    <section
      className="aulas-ch"
      aria-label="Cursos-horario"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-cursos"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-ch-izquierda" data-qa-geometry-member="tabla">
        <TablaDeLaPestana
          tabla={modelo.tabla}
          enFoco={modelo.enFoco}
          onQuitarFoco={() => escribirFoco(null)}
        />
      </div>
      <div className="aulas-ch-derecha" data-qa-geometry-member="lateral">
        <TitularesDelSorteo titulares={modelo.titulares} />
        <CoberturaDeLoEsperado cobertura={modelo.cobertura} />
      </div>
    </section>
  );
}

/** S1: la misma silueta mientras se prepara el corte, con el tiempo que lleva. */
function Silueta({ readiness }: { readiness: string }) {
  const segundos = useTranscurrido();
  const reloj = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  return (
    <section className="aulas-ch aulas-ch--silueta" aria-label="Cursos-horario" aria-busy="true" data-audit-ready={readiness}>
      <div className="aulas-ch-izquierda">
        <div className="aulas-ch-panel aulas-ch-silueta is-tabla">
          <p className="aulas-ch-preparando" role="status">
            Preparando el corte <span className="aulas-ch-num">{reloj}</span>
          </p>
        </div>
      </div>
      <div className="aulas-ch-derecha">
        <div className="aulas-ch-panel aulas-ch-silueta is-titulares" />
        <div className="aulas-ch-panel aulas-ch-silueta is-cobertura" />
      </div>
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

function Nota({ vacio }: { vacio: Vacio }) {
  return (
    <p className="aulas-ch-nota" data-qa-geometry-empty={vacio.clase}>
      <Info size={14} aria-hidden="true" />
      <span>{vacio.causa}</span>
    </p>
  );
}

function Cabecera({ id, titulo, sub, children }: { id: string; titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="aulas-ch-cabecera">
      <h3 id={id} className="aulas-ch-titulo">{titulo}</h3>
      {sub ? <span className="aulas-ch-sub">{sub}</span> : null}
      {children}
    </header>
  );
}

function TablaDeLaPestana({ tabla, enFoco, onQuitarFoco }: {
  tabla: TablaDeCursos;
  enFoco: string;
  onQuitarFoco: () => void;
}) {
  const id = "aulas-ch-tabla-titulo";
  const chipDeFoco = enFoco ? (
    <button type="button" className="aulas-ch-foco" onClick={onQuitarFoco} title="Quitar el foco y ver todas las facultades">
      <span>Sólo {enFoco}</span>
      <X size={12} aria-hidden="true" />
      <span className="aulas-ch-oculto">: quitar el foco</span>
    </button>
  ) : null;
  if (tabla.tipo === "vacio") {
    return (
      <section className="aulas-ch-panel aulas-ch-tabla-panel" aria-labelledby={id}>
        <Cabecera id={id} titulo="Cada curso-horario contra su tasa prevista">{chipDeFoco}</Cabecera>
        <Nota vacio={tabla.vacio} />
      </section>
    );
  }
  return (
    <section className="aulas-ch-panel aulas-ch-tabla-panel" aria-labelledby={id}>
      <Cabecera id={id} titulo="Cada curso-horario contra su tasa prevista" sub={tabla.sub}>
        {chipDeFoco}
        <span className="aulas-ch-leyenda" aria-hidden="true">
          <span className="is-observada">Observada</span>
          <span className="is-prevista">Prevista</span>
        </span>
      </Cabecera>
      <div
        className="aulas-ch-tabla-marco"
        data-qa-geometry-capacity="owned"
        tabIndex={0}
        aria-label="Cursos-horario contra su tasa prevista, con desplazamiento"
      >
        <table className="aulas-ch-tabla" aria-labelledby={id}>
          <colgroup>
            <col className="is-codigo" />
            <col className="is-facultad" />
            <col className="is-cifra" />
            <col className="is-cifra" />
            <col className="is-pct" />
            <col className="is-pct" />
            <col className="is-barra" />
            <col className="is-lectura" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Facultad</th>
              <th scope="col" className="is-num">Elegibles</th>
              <th scope="col" className="is-num">Efectivas</th>
              <th scope="col" className="is-num">Prevista</th>
              <th scope="col" className="is-num">Observada</th>
              <th scope="col">Tasa</th>
              <th scope="col">Lectura</th>
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((f) => <Fila key={f.clave} fila={f} />)}
          </tbody>
        </table>
      </div>
      {tabla.pie ? <p className="aulas-ch-pie">{tabla.pie}</p> : null}
    </section>
  );
}

function Fila({ fila }: { fila: FilaDeCursoHorario }) {
  return (
    <tr>
      <th scope="row" className="aulas-ch-codigo">
        <Link to={hrefDeFichaDeAula(fila.codigo)} title={`Abrir la ficha de ${fila.codigo}`}>{fila.codigo}</Link>
      </th>
      <td>{fila.facultad}</td>
      <td className="is-num">{fila.elegibles}</td>
      <td className="is-num">
        {fila.efectivas}
        {fila.delParte ? (
          <span className="aulas-ch-parte" title="La plataforma no trae efectivas de este curso-horario: la cifra sale del parte de campo.">
            parte
          </span>
        ) : null}
      </td>
      <td className="is-num">{fila.prevista}</td>
      <td className="is-num"><b>{fila.observada}</b></td>
      <td>
        <span className="aulas-ch-tasa" role="img" aria-label={fila.aria}>
          <i className="is-observada" style={{ width: `${fila.relleno}%` }} data-desborda={fila.desborda ? "" : undefined} />
          {fila.marca != null ? <i className="is-prevista" style={{ left: `${fila.marca}%` }} /> : null}
        </span>
      </td>
      <td>
        <span className="aulas-ch-lectura" data-tono={fila.tono} title={fila.porQue}>{fila.lectura}</span>
      </td>
    </tr>
  );
}

function TitularesDelSorteo({ titulares }: { titulares: Titulares }) {
  const id = "aulas-ch-titulares-titulo";
  if (titulares.tipo === "vacio") {
    return (
      <section className="aulas-ch-panel aulas-ch-titulares" aria-labelledby={id} data-qa-geometry-member="titulares">
        <Cabecera id={id} titulo="Titulares" />
        <Nota vacio={titulares.vacio} />
      </section>
    );
  }
  const { cifras, total } = titulares;
  const conAulas = cifras.filter((c) => c.aulas > 0);
  return (
    <section className="aulas-ch-panel aulas-ch-titulares" aria-labelledby={id} data-qa-geometry-member="titulares">
      <Cabecera id={id} titulo="Titulares" sub={titulares.sub} />
      {total > 0 ? (
        <span
          className="aulas-ch-apilada"
          role="img"
          aria-label={`Titulares: ${conAulas.map((c) => `${c.rotulo} ${fmt(c.aulas)}`).join(", ")}`}
        >
          {conAulas.map((c) => (
            <i key={c.clave} data-estado={c.clave} style={{ flexGrow: c.aulas }} title={`${c.rotulo}: ${fmt(c.aulas)}`} />
          ))}
        </span>
      ) : null}
      <dl className="aulas-ch-cifras" data-qa-geometry-group="aulas-cursos-titulares" data-qa-geometry-contract="equal">
        {cifras.map((c) => (
          <div key={c.clave} title={c.titulo} data-qa-geometry-member={c.clave}>
            <dt><i data-estado={c.clave} aria-hidden="true" />{c.rotulo}</dt>
            <dd className="aulas-ch-num">{c.valor}</dd>
          </div>
        ))}
      </dl>
      {titulares.sinClasificar > 0 ? (
        <p className="aulas-ch-nota is-aviso" role="status">
          <Info size={14} aria-hidden="true" />
          <span>
            {fmt(titulares.sinClasificar)} sin clasificar: el motor los cuenta en el total y no en ningún estado.
          </span>
        </p>
      ) : null}
      <dl className="aulas-ch-usados">
        {[titulares.reservas, titulares.extras].map((u) => (
          <div key={u.rotulo} title={u.titulo}>
            <dt>{u.rotulo}</dt>
            <dd className="aulas-ch-num">{u.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CoberturaDeLoEsperado({ cobertura }: { cobertura: Cobertura }) {
  const id = "aulas-ch-cobertura-titulo";
  if (cobertura.tipo === "vacio") {
    return (
      <section className="aulas-ch-panel aulas-ch-cobertura" aria-labelledby={id} data-qa-geometry-member="cobertura">
        <Cabecera id={id} titulo="Cobertura de lo esperado" />
        <Nota vacio={cobertura.vacio} />
      </section>
    );
  }
  return (
    <section className="aulas-ch-panel aulas-ch-cobertura" aria-labelledby={id} data-qa-geometry-member="cobertura">
      <Cabecera id={id} titulo="Cobertura de lo esperado" sub={cobertura.sub} />
      <ul className="aulas-ch-tramos" data-qa-geometry-capacity="owned">
        {cobertura.tramos.map((t) => (
          <li key={t.clave} className={t.aulas ? undefined : "is-cero"}>
            <span className="aulas-ch-tramo-rotulo">{t.etiqueta}</span>
            <span className="aulas-ch-tramo-barra" aria-hidden="true">
              <i data-tono={t.tono} style={{ width: `${t.relleno}%` }} />
            </span>
            <b className="aulas-ch-num">{fmt(t.aulas)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const CursosHorarioAulas = memo(CursosHorarioAulasImpl);
