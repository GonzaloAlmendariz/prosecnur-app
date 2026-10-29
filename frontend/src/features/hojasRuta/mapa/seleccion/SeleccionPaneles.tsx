import type { ReactNode } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import type { QuotaPlan, SelectedBlock } from "../../../../api/hojasRuta";
import { codigoDeUmp, type RevisionMarco } from "../../seleccion/revisionMarco";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { useSeleccionDireccion, type CajonSeleccion } from "./useSeleccionDireccion";
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
  const { soloPorRevisar, setSoloPorRevisar, busquedaUmp, setBusquedaUmp } = useLienzoHojasRuta();
  const { umpEnfocada, setUmpEnfocada } = useSeleccionDireccion();
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
  const { setUmpEnfocada, setCajon } = useSeleccionDireccion();
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
        {/* `salidas` va PRIMERO en el pie de las dos vistas: misma posición en el árbol, así React no
            lo vuelve a montar al abrir o cerrar la ficha y no se pierde un ZIP en curso. El CSS lo
            lleva a la derecha. */}
        <footer className="hr-mapa-pie hr-sel-pie">
          {salidas}
          <PulsoButton variant="secondary" aria-label="Ruta anterior" onClick={() => onVecina(-1)}>‹</PulsoButton>
          <PulsoButton variant="secondary" aria-label="Ruta siguiente" onClick={() => onVecina(1)}>›</PulsoButton>
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
        {totales.titulares ? <p className="hr-mapa-nota">Toca una ruta en el mapa o en la lista para ver su ficha.</p> : <p className="hr-mapa-aviso">Sin sorteo: sortea las manzanas en la sección Manzanas para revisar las rutas.</p>}
      </div>
      <footer className="hr-mapa-pie hr-sel-pie">
        {salidas}
        <PulsoButton variant="secondary" disabled={!totales.titulares} onClick={() => setCajon("titulares")}>
          Ver las tablas
        </PulsoButton>
      </footer>
    </>
  );
}

const PESTANAS: ReadonlyArray<readonly [CajonSeleccion, string]> = [["titulares", "Titulares"], ["reemplazos", "Reemplazos"], ["cuotas", "Cuotas"]];

type Celda = Record<string, string | number | null>;
const COL_DISTRITO: PulsoTableColumna<SelectedBlock> = { id: "distrito", encabezado: "Distrito", ancho: 150, celda: (b) => nombreDistrito(b.distrito), valor: (b) => b.distrito };
const COLUMNAS_BLOQUE = (reemplazos: boolean): PulsoTableColumna<SelectedBlock>[] => [
  COL_DISTRITO,
  { id: "codigo", encabezado: reemplazos ? "R" : "UMP", ancho: 84, celda: (b) => codigoDeUmp(b), valor: (b) => Number(reemplazos ? b.titular_hoja_num ?? 0 : b.hoja_num ?? b.orden_seleccion ?? 0) },
  { id: "manzana", encabezado: "Manzana", ancho: 150, celda: (b) => b.id_manzana, valor: (b) => b.id_manzana },
  ...(reemplazos ? [{ id: "titular", encabezado: "Reemplaza a", ancho: 100, celda: (b: SelectedBlock) => (b.titular_hoja_num ? `UMP ${b.titular_hoja_num}` : "—"), valor: (b: SelectedBlock) => Number(b.titular_hoja_num ?? 0) }] : []),
  { id: "zona", encabezado: "Zona", ancho: 76, celda: (b) => b.zona, valor: (b) => b.zona },
  { id: "nse", encabezado: "NSE", ancho: 80, celda: (b) => nse(b), valor: (b) => nse(b) },
  { id: "viviendas", encabezado: "Viviendas", ancho: 90, tipo: "cifra", celda: (b) => fmt(b.viviendas), valor: (b) => Number(b.viviendas || 0) },
  { id: "encuestas", encabezado: "Encuestas", ancho: 96, tipo: "cifra", celda: (b) => rango(b), valor: (b) => Number(b.rango_inicio ?? 0) },
];
const COLUMNAS_CUOTA: PulsoTableColumna<Celda & { _i: number }>[] = [
  { id: "distrito", encabezado: "Distrito", ancho: 170, celda: (c) => nombreDistrito(String(c.territorio ?? "")), valor: (c) => String(c.territorio ?? "") },
  { id: "edad", encabezado: "Edad", ancho: 100, celda: (c) => String(c.rango_edad ?? ""), valor: (c) => String(c.rango_edad ?? "") },
  { id: "sexo", encabezado: "Sexo", ancho: 90, celda: (c) => String(c.sexo ?? "Total"), valor: (c) => String(c.sexo ?? "Total") },
  { id: "cuota", encabezado: "Cuota", ancho: 80, tipo: "cifra", celda: (c) => fmt(Number(c.cuota ?? 0)), valor: (c) => Number(c.cuota ?? 0) },
];

type CajonProps = { titulares: readonly SelectedBlock[]; reemplazos: readonly SelectedBlock[]; cuotas: QuotaPlan | null };

export function SeleccionCajon({ titulares, reemplazos, cuotas }: CajonProps) {
  const { cajon, setCajon, umpEnfocada, setUmpEnfocada } = useSeleccionDireccion();
  if (!cajon) return null;
  const titularDe = new Map(reemplazos.map((r) => [r.id_manzana, r.titular_id_manzana ?? null]));
  return (
    <section className="hr-sel-cajon" aria-label="Tablas de la selección">
      <header>
        <GlidingRadioGroup value={cajon} options={PESTANAS} getOptionValue={(o) => o[0]} onValueChange={setCajon} className="hr-muestra-opciones" aria-label="Tabla">
          {(o) => <span>{o[1]}</span>}
        </GlidingRadioGroup>
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar las tablas" onClick={() => setCajon(null)}>×</PulsoButton>
      </header>
      {cajon === "cuotas" ? (
        <PulsoTable ariaLabel="Cuotas" densidad="compacta" altoMaximo={280} columnas={COLUMNAS_CUOTA} filas={(cuotas?.cells ?? []).map((c, _i) => ({ ...c, _i }))} idDeFila={(c) => String(c._i)} vacio="Sin cuotas calculadas." />
      ) : (
        <PulsoTable
          ariaLabel={cajon === "titulares" ? "Titulares" : "Reemplazos"}
          densidad="compacta"
          altoMaximo={280}
          columnas={COLUMNAS_BLOQUE(cajon === "reemplazos")}
          filas={cajon === "titulares" ? titulares : reemplazos}
          idDeFila={(b) => b.id_manzana}
          seleccionada={cajon === "titulares" ? umpEnfocada : null}
          onSeleccionar={(id) => setUmpEnfocada(cajon === "titulares" ? id : titularDe.get(id) ?? null)}
          vacio={cajon === "reemplazos" && titulares.length ? "Este sorteo no tiene reemplazos: se sorteó con 0 por titular." : "Todavía no hay sorteo."}
        />
      )}
    </section>
  );
}
