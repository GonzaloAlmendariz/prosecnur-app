// Territorial › Entrega, vista faro (2 nov 2026): cifras de la entrega, el reparto
// por distrito con cada UMP teñida del encuestador que la lleva, y el equipo con
// su carga. Modelo puro en `modeloTablero.ts`.
//
// Contrato de Superficie: C1 `material-campo/territorial/entrega/tablero`; cada
// bloque es una tarjeta con cabecera propia (C3) y las listas van completas, sin
// «…y N más» (Sistema Pabellón).

import type { CSSProperties } from "react";

import { MapPinned, UsersRound } from "../../../vendor/lucide-react";
import type { DistritoDelTablero, PersonaDelEquipo, TableroDeEntrega as Tablero } from "./modeloTablero";
import "./tableroEntrega.css";

const miles = (n: number) => n.toLocaleString("es-PE");

function Barra({ valor, total, etiqueta }: { valor: number; total: number; etiqueta: string }) {
  return (
    <div
      className="rec-tab-barra"
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={valor}
      style={{ "--rec-tab-avance": String(total > 0 ? Math.min(valor / total, 1) : 0) } as CSSProperties}
    >
      <span />
    </div>
  );
}

function Cifras({ t, distritos }: { t: Tablero; distritos: number }) {
  const sinAsignar = t.total - t.asignadas;
  return (
    <dl className="rec-tab-cifras">
      <div className="rec-tab-cifra">
        <dt>UMP titulares</dt>
        <dd>{miles(t.total)}</dd>
        <span>en {miles(distritos)} {distritos === 1 ? "distrito" : "distritos"}</span>
      </div>
      <div className="rec-tab-cifra">
        <dt>Equipo</dt>
        <dd>{miles(t.equipo.length)}</dd>
        <span>en la lista de Monitoreo</span>
      </div>
      <div className="rec-tab-cifra rec-tab-cifra--avance">
        <dt>Asignadas</dt>
        <dd>
          {miles(t.asignadas)}<small> de {miles(t.total)}</small>
        </dd>
        <Barra valor={t.asignadas} total={t.total} etiqueta="UMP con encuestador" />
      </div>
      <div className="rec-tab-cifra" data-tono={sinAsignar > 0 ? "aviso" : "listo"}>
        <dt>Sin encuestador</dt>
        <dd>{miles(sinAsignar)}</dd>
        <span>{sinAsignar > 0 ? "por asignar antes de salir" : "todas tienen quien las haga"}</span>
      </div>
    </dl>
  );
}

function Distrito({ d }: { d: DistritoDelTablero }) {
  return (
    <article className="rec-tab-distrito">
      <header>
        <h4>{d.distrito}</h4>
        <span className="rec-tab-distrito-cuenta">
          {miles(d.asignadas)} de {miles(d.total)}
        </span>
      </header>
      <Barra valor={d.asignadas} total={d.total} etiqueta={`UMP con encuestador en ${d.distrito}`} />
      <ul className="rec-tab-umps">
        {d.umps.map((u) => (
          <li
            key={u.unitId}
            className={u.tono === null ? "rec-tab-ump" : `rec-tab-ump es-tono-${u.tono}`}
            title={u.encuestador ? `${u.label}: ${u.encuestador}` : `${u.label}: sin encuestador`}
          >
            {u.label.replace(/^UMP\s+/i, "")}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Persona({ p, maximo }: { p: PersonaDelEquipo; maximo: number }) {
  return (
    <li className="rec-tab-persona">
      <span className={`rec-tab-avatar es-tono-${p.tono}`} aria-hidden>{p.iniciales}</span>
      <span className="rec-tab-persona-texto">
        <strong>{p.nombre}</strong>
        <small>{p.codigo}</small>
      </span>
      <span className="rec-tab-persona-carga">
        <b>{miles(p.asignadas)}</b>
        <Barra valor={p.asignadas} total={Math.max(maximo, 1)} etiqueta={`UMP de ${p.nombre}`} />
      </span>
    </li>
  );
}

export function TableroDeEntrega({ tablero }: { tablero: Tablero }) {
  const maximo = tablero.equipo.reduce((m, p) => Math.max(m, p.asignadas), 0);
  return (
    <div className="rec-tab" data-qa-geometry-group="material-campo/territorial/entrega/tablero" data-qa-geometry-contract="intrinsic">
      <Cifras t={tablero} distritos={tablero.distritos.length} />
      <div className="rec-tab-cuerpo">
        <section className="rec-tab-bloque" aria-labelledby="rec-tab-reparto" data-qa-geometry-member>
          <header className="rec-tab-bloque-cabeza">
            <h3 id="rec-tab-reparto"><MapPinned size={16} aria-hidden /> Reparto por distrito</h3>
            <p>Cada UMP lleva el color de su encuestador; en gris, las que aún no tienen.</p>
          </header>
          <div className="rec-tab-distritos">
            {tablero.distritos.map((d) => <Distrito key={d.distrito} d={d} />)}
          </div>
        </section>
        <section className="rec-tab-bloque rec-tab-bloque--equipo" aria-labelledby="rec-tab-equipo" data-qa-geometry-member>
          <header className="rec-tab-bloque-cabeza">
            <h3 id="rec-tab-equipo"><UsersRound size={16} aria-hidden /> Equipo</h3>
            <p>UMP asignadas a cada persona.</p>
          </header>
          {tablero.equipo.length ? (
            <ul className="rec-tab-equipo">
              {tablero.equipo.map((p) => <Persona key={p.codigo} p={p} maximo={maximo} />)}
            </ul>
          ) : (
            <p className="rec-tab-nota">Monitoreo todavía no publica la lista de encuestadores.</p>
          )}
        </section>
      </div>
    </div>
  );
}
