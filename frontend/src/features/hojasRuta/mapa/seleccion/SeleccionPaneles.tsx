import type { ReactNode } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { QuotaPlan, SelectedBlock } from "../../../../api/hojasRuta";
import { codigoDeUmp, type RevisionMarco } from "../../seleccion/revisionMarco";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta, type CajonSeleccion } from "../store";
import { porRevisar, reemplazosDe, type EstadoRuta, type GrupoRutas } from "./rutas";

/**
 * Selección en la página del lienzo (U9). La estructura son las rutas por
 * distrito con «por revisar»; el inspector es la ficha de la UMP enfocada con
 * sus reemplazos en orden o, sin foco, la revisión contra el marco; las tablas
 * completas viven en un cajón bajo el mapa.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(Number(n) || 0));
const ETIQUETA: Record<EstadoRuta, string> = { error: "A corregir", aviso: "A revisar", info: "Para saber", ok: "Sin observaciones" };
const nse = (b: SelectedBlock) => {
  const n = String(b.nse_nivel ?? "").trim();
  return n && n !== "NA" ? n : "S/D";
};
const rango = (b: SelectedBlock) => (Number(b.rango_inicio) > 0 && Number(b.rango_fin) >= Number(b.rango_inicio) ? `${fmt(Number(b.rango_inicio))} a ${fmt(Number(b.rango_fin))}` : `${fmt(b.entrevistas)}`);

type EstructuraProps = { grupos: readonly GrupoRutas[]; total: number; observadas: number };

export function SeleccionEstructura({ grupos, total, observadas }: EstructuraProps) {
  const { umpEnfocada, setUmpEnfocada, soloPorRevisar, setSoloPorRevisar, busquedaUmp, setBusquedaUmp } = useLienzoHojasRuta();
  const visibles = grupos.reduce((a, g) => a + g.filas.length, 0);
  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Rutas</h2>
          <small>{visibles === total ? `${fmt(total)} titulares` : `${fmt(visibles)} de ${fmt(total)}`}</small>
        </div>
        <input className="hr-mapa-buscar" type="search" aria-label="Buscar ruta" placeholder="Buscar UMP, zona o manzana" value={busquedaUmp} onChange={(e) => setBusquedaUmp(e.target.value)} />
        <PulsoSwitch label="Solo por revisar" size="sm" checked={soloPorRevisar} onCheckedChange={setSoloPorRevisar} count={observadas} />
      </div>
      <div className="hr-mapa-catalogo">
        {grupos.map((g) => (
          <section key={g.ubigeo} aria-label={nombreDistrito(g.distrito)}>
            <h3>
              {nombreDistrito(g.distrito)}
              <span>{fmt(g.filas.length)}</span>
            </h3>
            <ul className="hr-sel-rutas">
              {g.filas.map((f) => (
                <li key={f.id}>
                  <button type="button" aria-pressed={f.id === umpEnfocada} data-estado={f.estado} onClick={() => setUmpEnfocada(f.id === umpEnfocada ? null : f.id)}>
                    <i aria-hidden="true" />
                    <strong>{f.codigo}</strong>
                    <small>
                      Zona {f.zona} · {fmt(f.viviendas)} viv.{f.reemplazos ? ` · ${f.reemplazos} R` : ""}
                    </small>
                    {porRevisar(f.estado) ? <em>{ETIQUETA[f.estado]}</em> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!grupos.length ? <p className="hr-mapa-vacio">{total ? (soloPorRevisar ? "Ninguna ruta por revisar." : `Ninguna ruta coincide con «${busquedaUmp}».`) : "Todavía no hay sorteo. Sortea las manzanas en la sección Manzanas."}</p> : null}
      </div>
    </>
  );
}

type InspectorProps = {
  titular: SelectedBlock | null;
  estado: EstadoRuta;
  reemplazos: readonly SelectedBlock[];
  revision: RevisionMarco;
  totales: { titulares: number; reemplazos: number; entrevistas: number };
  /** Ir a la ruta anterior (−1) o siguiente (1) de la lista visible. */
  onVecina: (paso: 1 | -1) => void;
  /** El disparador de las salidas (sideover `?panel=salidas`); va en el pie de las dos vistas. */
  salidas?: ReactNode;
};

export function SeleccionInspector({ titular, estado, reemplazos, revision, totales, onVecina, salidas }: InspectorProps) {
  const { setUmpEnfocada, setCajon } = useLienzoHojasRuta();
  if (titular) {
    const suyos = reemplazosDe(titular.id_manzana, reemplazos);
    const observaciones = revision.grupos.filter((g) => g.umps.some((u) => u.idManzana === titular.id_manzana || suyos.some((r) => r.id_manzana === u.idManzana)));
    return (
      <>
        <header className="hr-mapa-cab">
          <h2>
            {codigoDeUmp(titular)} · {nombreDistrito(titular.distrito)}
          </h2>
          <PulsoButton variant="icon" size="sm" aria-label="Cerrar la ficha" onClick={() => setUmpEnfocada(null)}>×</PulsoButton>
        </header>
        <div className="hr-mapa-ins-cuerpo">
          <span className="hr-sel-estado" data-estado={estado}>{ETIQUETA[estado]}</span>
          <div className="hr-mapa-cifras">
            <div><small>Viviendas</small><strong>{fmt(titular.viviendas)}</strong></div>
            <div><small>Entrevistas</small><strong>{fmt(titular.entrevistas)}</strong></div>
            <div><small>Salto</small><strong>{(titular.salto_operativo ?? titular.constante_salto) ? `1 de ${titular.salto_operativo ?? titular.constante_salto}` : "Sin salto"}</strong></div>
          </div>
          <dl className="hr-mapa-filas">
            <div><dt>Manzana</dt><dd>{titular.id_manzana}</dd></div>
            <div><dt>Zona</dt><dd>{titular.zona}</dd></div>
            <div><dt>NSE</dt><dd>{nse(titular)}</dd></div>
            <div><dt>Encuestas</dt><dd>{rango(titular)}</dd></div>
            {titular.esquina_inicio ? <div><dt>Esquina inicial</dt><dd>{titular.esquina_inicio}</dd></div> : null}
          </dl>
          {observaciones.map((g) => (
            <p key={g.tipo} className={g.tono === "info" ? "hr-mapa-nota" : "hr-mapa-aviso"}>
              <b>{g.titulo}.</b> {g.detalle}
            </p>
          ))}
          <section className="hr-muestra-grupo" aria-label="Reemplazos en orden">
            <h3>Reemplazos en orden</h3>
            {suyos.length ? (
              <ol className="hr-sel-reemplazos">
                {suyos.map((r) => (
                  <li key={r.id_manzana}>
                    <strong>{codigoDeUmp(r)}</strong>
                    <span>Zona {r.zona} · {fmt(r.viviendas)} viv. · NSE {nse(r)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="hr-mapa-nota">Esta ruta no tiene reemplazos sorteados.</p>
            )}
          </section>
        </div>
        <footer className="hr-mapa-pie">
          <PulsoButton variant="secondary" aria-label="Ruta anterior" onClick={() => onVecina(-1)}>‹</PulsoButton>
          <PulsoButton variant="secondary" aria-label="Ruta siguiente" onClick={() => onVecina(1)}>›</PulsoButton>
          {salidas}
        </footer>
      </>
    );
  }
  return (
    <>
      <header className="hr-mapa-cab">
        <h2>Revisión contra el marco</h2>
      </header>
      <div className="hr-mapa-ins-cuerpo">
        <div className="hr-mapa-cifras">
          <div><small>Titulares</small><strong>{fmt(totales.titulares)}</strong></div>
          <div><small>Reemplazos</small><strong>{fmt(totales.reemplazos)}</strong></div>
          <div><small>Por revisar</small><strong>{fmt(revision.porRevisar)}</strong></div>
        </div>
        {revision.grupos.length ? (
          revision.grupos.map((g) => (
            <article key={g.tipo} className="hr-sel-grupo" data-estado={g.tono}>
              <strong>{g.titulo}</strong>
              <small>{g.detalle}</small>
              <div className="hr-mapa-chips">
                {g.umps.slice(0, 12).map((u) => (
                  <button key={u.idManzana} type="button" className="hr-mapa-zona" onClick={() => setUmpEnfocada(reemplazos.find((r) => r.id_manzana === u.idManzana)?.titular_id_manzana ?? u.idManzana)} title={u.titular ? `Abre la ficha de ${u.titular}` : undefined}>
                    <span>{u.codigo}{u.titular ? ` de ${u.titular}` : ""}</span>
                  </button>
                ))}
                {g.umps.length > 12 ? <span className="hr-mapa-nota">y {g.umps.length - 12} más</span> : null}
              </div>
            </article>
          ))
        ) : totales.titulares ? (
          <p className="hr-mapa-nota">Ninguna observación: cada ruta tiene viviendas suficientes en el marco.</p>
        ) : null}
        <p className="hr-mapa-nota">Toca una ruta en el mapa o en la lista para ver su ficha.</p>
      </div>
      <footer className="hr-mapa-pie">
        <PulsoButton variant="secondary" disabled={!totales.titulares} onClick={() => setCajon("titulares")}>
          Ver las tablas
        </PulsoButton>
        {salidas}
      </footer>
    </>
  );
}

const PESTANAS: ReadonlyArray<readonly [CajonSeleccion, string]> = [["titulares", "Titulares"], ["reemplazos", "Reemplazos"], ["cuotas", "Cuotas"]];

type CajonProps = { titulares: readonly SelectedBlock[]; reemplazos: readonly SelectedBlock[]; cuotas: QuotaPlan | null };

export function SeleccionCajon({ titulares, reemplazos, cuotas }: CajonProps) {
  const { cajon, setCajon, setUmpEnfocada } = useLienzoHojasRuta();
  if (!cajon) return null;
  const celdas = cuotas?.cells ?? [];
  return (
    <section className="hr-sel-cajon" aria-label="Tablas de la selección">
      <header>
        <GlidingRadioGroup value={cajon} options={PESTANAS} getOptionValue={(o) => o[0]} onValueChange={setCajon} className="hr-muestra-opciones" aria-label="Tabla">
          {(o) => <span>{o[1]}</span>}
        </GlidingRadioGroup>
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar las tablas" onClick={() => setCajon(null)}>×</PulsoButton>
      </header>
      <div className="hr-mapa-tabla-caja" tabIndex={0} aria-label={`Tabla de ${cajon}`}>
        <table className="hr-mapa-tabla">
          {cajon === "cuotas" ? (
            <>
              <thead><tr><th>Distrito</th><th>Edad</th><th>Sexo</th><th>Cuota</th></tr></thead>
              <tbody>
                {celdas.map((c, i) => (
                  <tr key={i}>
                    <th>{nombreDistrito(String(c.territorio ?? ""))}</th>
                    <td>{String(c.rango_edad ?? "")}</td>
                    <td>{String(c.sexo ?? "Total")}</td>
                    <td><b>{fmt(Number(c.cuota ?? 0))}</b></td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Distrito</th><th>{cajon === "titulares" ? "UMP" : "R"}</th><th>Manzana</th>{cajon === "reemplazos" ? <th>Reemplaza a</th> : null}<th>Zona</th><th>NSE</th><th>Viviendas</th><th>Encuestas</th>
                </tr>
              </thead>
              <tbody>
                {(cajon === "titulares" ? titulares : reemplazos).map((b) => {
                  const idTitular = cajon === "titulares" ? b.id_manzana : b.titular_id_manzana ?? null;
                  return (
                    <tr key={b.id_manzana} onClick={() => idTitular && setUmpEnfocada(idTitular)}>
                      <th>{nombreDistrito(b.distrito)}</th>
                      <td>{codigoDeUmp(b)}</td>
                      <td>{b.id_manzana}</td>
                      {cajon === "reemplazos" ? <td>{b.titular_hoja_num ? `UMP ${b.titular_hoja_num}` : "—"}</td> : null}
                      <td>{b.zona}</td>
                      <td>{nse(b)}</td>
                      <td>{fmt(b.viviendas)}</td>
                      <td>{rango(b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          )}
        </table>
      </div>
    </section>
  );
}
