// Territorial › Entrega, vista faro (2 nov 2026): cifras de la entrega, el reparto
// por distrito con cada UMP teñida del encuestador que la lleva, y el equipo con
// su carga. Modelo puro en `modeloTablero.ts`. Cada bloque es un `Panel` del kit y las
// cifras y barras son `CifrasEnTarjeta` y `BarraDeAvance` (components/).
//
// Contrato de Superficie: C1 `material-campo/territorial/entrega/tablero`; cada
// bloque es una tarjeta con cabecera propia (C3) y las listas van completas, sin
// «…y N más» (Sistema Pabellón).

import { MapPinned, UsersRound } from "../../../vendor/lucide-react";
import { BarraDeAvance } from "../../../components/BarraDeAvance";
import { CifrasEnTarjeta } from "../../../components/CifrasEnTarjeta";
import { Panel } from "../../../components/Panel";
import type { DistritoDelTablero, PersonaDelEquipo, TableroDeEntrega as Tablero } from "./modeloTablero";
import "./tableroEntrega.css";

const miles = (n: number) => n.toLocaleString("es-PE");

function Distrito({ d }: { d: DistritoDelTablero }) {
  return (
    <article className="rec-tab-distrito">
      <header>
        <h4>{d.distrito}</h4>
        <span className="rec-tab-distrito-cuenta">
          {miles(d.asignadas)} de {miles(d.total)}
        </span>
      </header>
      <BarraDeAvance valor={d.asignadas} total={d.total} etiqueta={`UMP con encuestador en ${d.distrito}`} />
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
        <BarraDeAvance valor={p.asignadas} total={Math.max(maximo, 1)} etiqueta={`UMP de ${p.nombre}`} />
      </span>
    </li>
  );
}

export function TableroDeEntrega({ tablero }: { tablero: Tablero }) {
  const maximo = tablero.equipo.reduce((m, p) => Math.max(m, p.asignadas), 0);
  const distritos = tablero.distritos.length;
  const sinAsignar = tablero.total - tablero.asignadas;
  return (
    <div className="rec-tab" data-qa-geometry-group="material-campo/territorial/entrega/tablero" data-qa-geometry-contract="intrinsic">
      <CifrasEnTarjeta
        cifras={[
          { id: "umps", rotulo: "UMP titulares", valor: miles(tablero.total), nota: `en ${miles(distritos)} ${distritos === 1 ? "distrito" : "distritos"}` },
          { id: "equipo", rotulo: "Equipo", valor: miles(tablero.equipo.length), nota: "en la lista de Monitoreo" },
          {
            id: "asignadas", rotulo: "Asignadas", valor: miles(tablero.asignadas), de: tablero.total,
            avance: { valor: tablero.asignadas, total: tablero.total, etiqueta: "UMP con encuestador" },
          },
          {
            id: "sin", rotulo: "Sin encuestador", valor: miles(sinAsignar),
            nota: sinAsignar > 0 ? "por asignar antes de salir" : "todas tienen quien las haga",
            tono: sinAsignar > 0 ? "aviso" : "listo",
          },
        ]}
      />
      <div className="rec-tab-cuerpo">
        <Panel
          data-qa-geometry-member
          title={<><MapPinned size={16} aria-hidden /> Reparto por distrito</>}
          hint="Cada UMP lleva el color de su encuestador; en gris, las que aún no tienen."
        >
          <div className="rec-tab-distritos">
            {tablero.distritos.map((d) => <Distrito key={d.distrito} d={d} />)}
          </div>
        </Panel>
        <Panel
          data-qa-geometry-member
          title={<><UsersRound size={16} aria-hidden /> Equipo</>}
          hint="UMP asignadas a cada persona."
        >
          {tablero.equipo.length ? (
            <ul className="rec-tab-equipo">
              {tablero.equipo.map((p) => <Persona key={p.codigo} p={p} maximo={maximo} />)}
            </ul>
          ) : (
            <p className="rec-terr-nota">Monitoreo todavía no publica la lista de encuestadores.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
