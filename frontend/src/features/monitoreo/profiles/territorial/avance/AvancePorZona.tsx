import { useMemo } from "react";

import { fmt, nombreDeDistrito } from "../rotulos";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { LIMA_DISTRICT_FEATURES } from "../TerritorialRouteCoverageAtlas";
import { construirMapaDeZonas } from "./mapaDeZonasModelo";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import { tonoDeCalor } from "./tonoDeCalor";
import {
  celdaMasAtrasada,
  ejesDeLaMatriz,
  faltaDeZona,
  faltantePorCelda,
  type AvancePorZona as Modelo,
  type Zona,
} from "./porZonaModelo";
import "./faltante.css";
import "./porZona.css";

const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0);
const rotuloRango = (r: string) => r.replace(/\s*-\s*/, " a ");

/** La fila de indicadores: el rótulo y las cuatro lecturas de la cuota. */
function Banda({ modelo }: { modelo: Modelo }) {
  const falta = modelo.zonas.reduce((s, z) => s + faltaDeZona(z), 0);
  const celdasPendientes = modelo.celdas - modelo.celdasCompletas;
  const atrasada = celdaMasAtrasada(modelo);
  const enObservacion = modelo.zonas.reduce((s, z) => s + z.enObservacion, 0);
  const sinCelda = modelo.sinCelda + modelo.sinZona;
  const bloques = Array.from({ length: modelo.celdas }, (_, i) => i < modelo.celdasCompletas);
  return (
    <div className="mon-pz-banda" data-qa-geometry-group="territorial-zonas-banda" data-qa-geometry-contract="intrinsic">
      <div className="mon-pz-tile is-rotulo"><RotuloDePestana /><span className="mon-pz-nota">Qué celdas faltan y dónde</span></div>
      <div className="mon-pz-tile">
        <small>Celdas completas</small>
        <strong>{fmt(modelo.celdasCompletas)}<span> de {fmt(modelo.celdas)}</span></strong>
        <span className="mon-pz-bloques" aria-hidden="true" data-qa-geometry-group="territorial-zonas-bloques" data-qa-geometry-contract="equal">
          {bloques.map((ok, i) => <i key={i} className={ok ? "is-ok" : ""} />)}
        </span>
      </div>
      <div className={`mon-pz-tile${falta ? " is-aviso" : " is-ok"}`}>
        <small>Faltan para cerrar cuotas</small>
        <strong>{fmt(falta)}<span> en {fmt(celdasPendientes)} {celdasPendientes === 1 ? "celda" : "celdas"}</span></strong>
        <span className="mon-pz-nota">{falta ? "El exceso en una celda no cubre otra" : "Todas las celdas tienen su cuota"}</span>
      </div>
      <div className="mon-pz-tile">
        <small>Celda más atrasada</small>
        {atrasada ? (
          <>
            <strong className="is-texto">{atrasada.sexo} de {rotuloRango(atrasada.rangoEdad)}</strong>
            <span className="mon-pz-linea">
              <span className="mon-pz-barra is-aviso" aria-hidden="true"><i style={{ width: `${pct(atrasada.efectivas, atrasada.meta)}%` }} /></span>
              <span>{fmt(atrasada.efectivas)} de {fmt(atrasada.meta)} ({pct(atrasada.efectivas, atrasada.meta)} %)</span>
            </span>
          </>
        ) : <strong className="is-texto">Ninguna</strong>}
      </div>
      <div className="mon-pz-tile">
        <small>En observación</small>
        <strong>{fmt(enObservacion)}<span> incluidas en el avance</span></strong>
        <span className="mon-pz-nota">{sinCelda ? `${fmt(sinCelda)} sin celda por sexo o edad ilegible` : "Todas caen en una celda"}</span>
      </div>
    </div>
  );
}

/** Logrado frente a la cuota: zona por celda (sexo y rango de edad), con su total. */
function Matriz({ modelo }: { modelo: Modelo }) {
  const ejes = modelo.zonas[0] ? ejesDeLaMatriz(modelo.zonas[0]) : { sexos: [], rangos: [] };
  const columnas = ejes.sexos.flatMap((s) => ejes.rangos.map((r) => ({ s, r })));
  const totales = columnas.map(({ s, r }) => {
    let meta = 0;
    let efectivas = 0;
    for (const z of modelo.zonas) {
      const c = z.celdas.find((x) => x.sexo === s && x.rangoEdad === r);
      if (c) { meta += c.meta; efectivas += c.efectivas; }
    }
    return { s, r, meta, efectivas };
  });
  return (
    <section className="mon-falt-panel mon-pz-matriz" aria-labelledby="mon-pz-matriz-titulo" data-qa-geometry-member="matriz">
      <header className="mon-pz-cabecera">
        <span>
          <h3 id="mon-pz-matriz-titulo">Logrado frente a la cuota</h3>
          <span className="mon-falt-base">Efectivas sobre la meta de cada celda, por zona</span>
        </span>
        <span className="mon-pz-leyenda" aria-hidden="true">
          <span><i className="is-falta" />bajo la cuota</span>
          <span><i style={{ background: tonoDeCalor(1, 1).fondo }} />100 %</span>
          <span><i style={{ background: tonoDeCalor(5, 4).fondo }} />125 % o más</span>
        </span>
      </header>
      <div className="mon-pz-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Matriz de cuotas, con desplazamiento">
      <table className="mon-pz-tabla">
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="mon-pz-zona-col">Zona</th>
            {ejes.sexos.map((s, i) => <th key={s} scope="colgroup" colSpan={ejes.rangos.length} className={`mon-pz-grupo is-${i}`}>{s}</th>)}
            <th scope="col" rowSpan={2} className="mon-pz-avance-col">Avance</th>
          </tr>
          <tr>{columnas.map(({ s, r }) => <th key={`${s}-${r}`} scope="col">{rotuloRango(r)}</th>)}</tr>
        </thead>
        <tbody>
          {modelo.zonas.map((zona) => {
            const falta = faltaDeZona(zona);
            const pendientes = zona.celdas.filter((c) => c.falta > 0).length;
            const avance = pct(zona.efectivas, zona.meta);
            return (
              <tr key={zona.idZona}>
                <th scope="row">
                  <span className="mon-pz-zona">
                    <SiluetaDeDistrito distrito={zona.nombre} lado={30} />
                    <span>
                      <b>{zona.nombre}</b>
                      <small className={falta ? "is-falta" : "is-ok"}>
                        {falta ? `faltan ${fmt(falta)} en ${fmt(pendientes)} ${pendientes === 1 ? "celda" : "celdas"}` : "cuotas cerradas"}
                      </small>
                    </span>
                  </span>
                </th>
                {columnas.map(({ s, r }) => {
                  const c = zona.celdas.find((x) => x.sexo === s && x.rangoEdad === r);
                  if (!c) return <td key={`${s}-${r}`} className="mon-pz-vacia">Sin cuota</td>;
                  const tono = tonoDeCalor(c.efectivas, c.meta);
                  const nota = c.falta > 0 ? `faltan ${fmt(c.falta)}` : c.efectivas === c.meta ? "completa" : `+${fmt(c.efectivas - c.meta)}`;
                  return (
                    <td key={`${s}-${r}`}>
                      <span
                        className={`mon-pz-celda is-${tono.tinta}${c.falta > 0 ? " is-falta" : ""}`}
                        style={c.falta > 0 ? undefined : { background: tono.fondo }}
                        title={`${zona.nombre}, ${s.toLowerCase()} de ${rotuloRango(r)}: ${fmt(c.efectivas)} de ${fmt(c.meta)}${c.enObservacion ? ` (${fmt(c.enObservacion)} en observación)` : ""}`}
                      >
                        <b>{fmt(c.efectivas)}</b>
                        <small>de {fmt(c.meta)}</small>
                        <em>{nota}</em>
                      </span>
                    </td>
                  );
                })}
                <td className="mon-pz-avance">
                  <b>{avance} %</b>
                  <span className="mon-pz-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, avance)}%` }} /></span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">
              <span className="mon-pz-total-zona">
                <b>Todas las zonas</b>
                <small>Meta {fmt(modelo.meta)}, con {fmt(modelo.celdasCompletas)} de {fmt(modelo.celdas)} celdas</small>
              </span>
            </th>
            {totales.map((t) => {
              const p = pct(t.efectivas, t.meta);
              const bajo = t.efectivas < t.meta;
              return (
                <td key={`${t.s}-${t.r}`}>
                  <span className={`mon-pz-total${bajo ? " is-falta" : ""}`} title={`${fmt(t.efectivas)} de ${fmt(t.meta)}`}>
                    <b>{p} %</b>
                    <small>{fmt(t.efectivas)}/{fmt(t.meta)}</small>
                    <span className={`mon-pz-barra${bajo ? " is-aviso" : ""}`} aria-hidden="true"><i style={{ width: `${Math.min(100, p)}%` }} /></span>
                  </span>
                </td>
              );
            })}
            <td className="mon-pz-avance">
              <b>{pct(modelo.efectivas, modelo.meta)} %</b>
              <small>{fmt(modelo.efectivas)}</small>
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </section>
  );
}

const tonoFalta = (falta: number, max: number) => {
  if (falta <= 0) return "var(--pulso-surface)";
  const k = Math.round(18 + (falta / Math.max(1, max)) * 52);
  return `color-mix(in srgb, var(--pulso-module-monitoring) ${k}%, var(--pulso-surface))`;
};

/** Faltante por zona: las zonas con su contorno real, en ámbar según lo que les falta. */
function MapaFaltante({ modelo }: { modelo: Modelo }) {
  const mapa = useMemo(() => construirMapaDeZonas(LIMA_DISTRICT_FEATURES, modelo.zonas.map((z) => z.idZona), 600, 560), [modelo.zonas]);
  const faltas = new Map(modelo.zonas.map((z) => [z.idZona, faltaDeZona(z)]));
  const max = Math.max(1, ...faltas.values());
  const orden = [...modelo.zonas].sort((a, b) => (faltas.get(b.idZona) ?? 0) - (faltas.get(a.idZona) ?? 0));
  return (
    <section className="mon-falt-panel mon-pz-mapa" aria-labelledby="mon-pz-mapa-titulo" data-qa-geometry-member="mapa">
      <header className="mon-pz-cabecera">
        <h3 id="mon-pz-mapa-titulo">Faltante por zona</h3>
        <span className="mon-falt-base">entrevistas que faltan en cada zona</span>
      </header>
      <div className="mon-pz-mapa-cuerpo">
        {mapa ? (
          <svg viewBox={`0 0 ${mapa.ancho} ${mapa.alto}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de las zonas con las entrevistas que faltan en cada una">
            <path className="mon-pz-vecinos" d={mapa.vecinos} />
            {mapa.zonas.map((z) => <path key={z.clave} className="mon-pz-distrito" d={z.trazo} style={{ fill: tonoFalta(faltas.get(z.clave) ?? 0, max) }} />)}
            {mapa.zonas.map((z) => (
              <text key={`r-${z.clave}`} className="mon-pz-rotulo-mapa" x={z.rotulo.x} y={z.rotulo.y + 6}>{fmt(faltas.get(z.clave) ?? 0)}</text>
            ))}
          </svg>
        ) : <p className="mon-falt-base">Las zonas no están en la cartografía de distritos.</p>}
        <ul className="mon-pz-mapa-lista">
          {orden.map((z) => (
            <li key={z.idZona}>
              <i style={{ background: tonoFalta(faltas.get(z.idZona) ?? 0, max) }} aria-hidden="true" />
              <span>{z.nombre}</span>
              <b>{fmt(faltas.get(z.idZona) ?? 0)}</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Faltante por celda: lo que falta sumando zonas, de más a menos. */
function FaltantePorCelda({ modelo }: { modelo: Modelo }) {
  const filas = faltantePorCelda(modelo);
  const total = filas.reduce((s, f) => s + f.falta, 0);
  const max = Math.max(1, ...filas.map((f) => f.falta));
  return (
    <section className="mon-falt-panel mon-pz-celdas" aria-labelledby="mon-pz-celdas-titulo" data-qa-geometry-member="celdas">
      <header className="mon-pz-cabecera">
        <h3 id="mon-pz-celdas-titulo">Faltante por celda</h3>
        <span className="mon-falt-base">las {fmt(total)} entrevistas por celda, sumadas entre zonas</span>
      </header>
      {filas.length ? (
        <ul className="mon-pz-celdas-lista">
          {filas.map((f) => (
            <li key={`${f.sexo}-${f.rangoEdad}`}>
              <span className="mon-pz-linea is-entre">
                <span><b>{f.sexo} de {rotuloRango(f.rangoEdad)}</b>, en {fmt(f.zonas)} de {fmt(modelo.zonas.length)} zonas</span>
                <b className="is-falta">{fmt(f.falta)}</b>
              </span>
              <span className="mon-pz-barra is-aviso is-gruesa" aria-hidden="true"><i style={{ width: `${(100 * f.falta) / max}%` }} /></span>
            </li>
          ))}
        </ul>
      ) : <p className="mon-falt-base">Todas las celdas tienen su cuota.</p>}
    </section>
  );
}

/** Sólo si Material repartió zonas: quién levanta cada una y su parte. */
function Reparto({ zonas }: { zonas: Zona[] }) {
  const conPersonas = zonas.filter((z) => z.personas.length);
  if (!conPersonas.length) return null;
  return (
    <section className="mon-falt-panel mon-pz-reparto" aria-labelledby="mon-pz-reparto-titulo">
      <header className="mon-pz-cabecera">
        <h3 id="mon-pz-reparto-titulo">Quién levanta cada zona</h3>
        <span className="mon-falt-base">la parte que le asignó Material</span>
      </header>
      <ul className="mon-pz-personas">
        {conPersonas.flatMap((z) => z.personas.map((p) => (
          <li key={`${z.idZona}-${p.codigo}`}>
            <span className="mon-ter-con-silueta"><SiluetaDeDistrito distrito={z.nombre} lado={18} />{z.nombre}</span>
            <b>{p.codigo}</b>
            <span className={`mon-falt-chip ${p.falta ? "is-falta" : ""}`}>
              {fmt(p.efectivas)}{p.parte != null ? ` de ${fmt(p.parte)}` : ""}
            </span>
          </li>
        )))}
      </ul>
    </section>
  );
}

/**
 * Avance › Faltante con un envío por cuotas (ADR 0125 A1). No hay UMP: Hojas de
 * ruta envía zonas con su N y su cuota por celda (sexo y rango de edad). La
 * vista lee la cuota por zona con las mismas efectivas del resto del avance
 * (las en observación incluidas): indicadores arriba, la matriz a la izquierda
 * y, a la derecha, dónde y en qué celdas falta.
 */
export function AvancePorZona({ modelo: crudo, nombres }: { modelo: Modelo; nombres?: ReadonlyMap<string, string> }) {
  // El nombre del distrito, el mismo de Resumen y Distritos (con su tilde), y no
  // el rótulo en mayúsculas de la zona.
  const modelo = { ...crudo, zonas: crudo.zonas.map((z) => ({ ...z, nombre: nombreDeDistrito(nombres?.get(z.idZona) ?? z.nombre) })) };
  return (
    <section
      className="mon-pz"
      aria-label="Faltante por zona y celda"
      data-audit-ready="monitoreo-territorial-avance-cuotas"
      data-qa-geometry-group="territorial-avance-zonas"
      data-qa-geometry-contract="intrinsic"
    >
      <Banda modelo={modelo} />
      <div className="mon-pz-cuerpo">
        <Matriz modelo={modelo} />
        <div className="mon-pz-lateral">
          <MapaFaltante modelo={modelo} />
          <FaltantePorCelda modelo={modelo} />
        </div>
      </div>
      <Reparto zonas={modelo.zonas} />
    </section>
  );
}
