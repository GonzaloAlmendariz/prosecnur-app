import type { ReactNode } from "react";
import { EvidenciaRevision } from "./EvidenciaRevision";
import { AvisosDelMotor } from "../AvisosDelMotor";
import { cuotasDescuadradas } from "../filtroDeAvisos";
import { ChevronUp, ChevronDown, X, ListChecks, Inbox, Search } from "../../../../vendor/lucide-react";
import { InspectorCabecera } from "../InspectorCabecera";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import type { QuotaPlan, SelectedBlock } from "../../../../api/hojasRuta";
import { codigoDeUmp, type RevisionMarco } from "../../seleccion/revisionMarco";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { tonoCss } from "../lienzo/tonos";
import { useSeleccionDireccion, type CajonSeleccion } from "./useSeleccionDireccion";
import { Link } from "react-router-dom";
import { accionDeObservacion, type AccionObservacion } from "./accionesRevision";
import { HREF_CAMPANA_TERRITORIAL } from "./SalidasPanel";
import { porRevisar, reemplazosDe, type EstadoRuta, type GrupoRutas } from "./rutas";

import { EstadoVacio } from "../../../../components/EstadoVacio";
import { EstadoChip } from "../../../../components/EstadoChip";
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

type EstructuraProps = { grupos: readonly GrupoRutas[]; total: number; observadas: number   /** Orden de confirmación de los distritos: el punto de cada grupo lleva su tono del mapa (B57). */
  confirmados?: readonly string[];
};

const FILTRO_RUTAS = [["todas", "Todas"], ["revisar", "Por revisar"]] as const;

export function SeleccionEstructura({ grupos, total, observadas, confirmados = [] }: EstructuraProps) {
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
        <input className="hr-mapa-buscar" type="search" aria-label="Buscar ruta" placeholder="UMP, zona o manzana" value={busquedaUmp} onChange={(e) => setBusquedaUmp(e.target.value)} />
        <GlidingRadioGroup value={soloPorRevisar ? "revisar" : "todas"} options={FILTRO_RUTAS} getOptionValue={(o) => o[0]} onValueChange={(v) => setSoloPorRevisar(v === "revisar")} className="hr-muestra-opciones" aria-label="Qué rutas ver">
          {(o) => <span>{o[0] === "revisar" ? `${o[1]}, ${fmt(observadas)}` : `${o[1]}, ${fmt(total)}`}</span>}
        </GlidingRadioGroup>
      </div>
      <div className="hr-mapa-catalogo">
        {grupos.map((g) => (
          <section key={g.ubigeo} aria-label={nombreDistrito(g.distrito)}>
            <h3>
              <span className="hr-sel-grupo-nombre">
                <i style={{ background: tonoCss(confirmados.indexOf(g.ubigeo)) }} aria-hidden="true" />
                {nombreDistrito(g.distrito)}
              </span>
              <span>{fmt(g.filas.length)}</span>
            </h3>
            <ul className="hr-sel-rutas">
              {g.filas.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={f.id === umpEnfocada}
                    data-estado={f.estado}
                    aria-label={`${f.codigo}, zona ${f.zona}, manzana ${f.id.slice(-4)}, ${fmt(f.viviendas)} viviendas${porRevisar(f.estado) ? `, ${ETIQUETA[f.estado]}` : ""}`}
                    title={porRevisar(f.estado) ? ETIQUETA[f.estado] : undefined}
                    onClick={() => setUmpEnfocada(f.id === umpEnfocada ? null : f.id)}
                  >
                    <span className="hr-sel-num" aria-hidden="true">{f.numero || "–"}</span>
                    <span className="hr-sel-copia">
                      <strong><span className="hr-sel-rotulo">Zona </span>{f.zona}, Mz {f.id.slice(-4)}</strong>
                      <small>
                        <span className="hr-sel-pips" aria-hidden="true">{Array.from({ length: Math.min(f.reemplazos, 6) }, (_, i) => <i key={i} />)}</span>
                        {f.reemplazos === 1 ? "1 reempl." : `${f.reemplazos} reempl.`}
                      </small>
                    </span>
                    <span className="hr-sel-cifra">{fmt(f.viviendas)} viv.</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!grupos.length ? (
          total ? (
            <EstadoVacio icono={<Search size={16} />} titulo={soloPorRevisar ? "Ninguna ruta por revisar" : `Ninguna ruta coincide con «${busquedaUmp}»`} />
          ) : (
            <EstadoVacio icono={<Inbox size={16} />} titulo="Todavía no hay sorteo" descripcion="Sortea las manzanas en la sección Manzanas." />
          )
        ) : null}
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
  /** El disparador de la entrega (sideover `?panel=salidas`); va en el pie de las dos vistas. */
  salidas?: ReactNode;
  /** P5: el plan de cuotas de la muestra, para sus avisos y si no cuadra con el N. */
  cuotas?: QuotaPlan | null;
  /** ¿La muestra ya se envió a Material? Entonces la ficha enlaza su hoja allá. */
  enviada?: boolean;
  /** Rutas por revisar: el número de la barra y de la lista (F15). */
  rutasPorRevisar?: number;
  /** Mínimo de viviendas del marco elegible declarado; null sin marco (decide la acción de cada observación, F23). */
  minimoMarco?: number | null;
};

export function SeleccionInspector({ titular, estado, reemplazos, revision, totales, onVecina, salidas, cuotas = null, enviada = false, rutasPorRevisar, minimoMarco = null }: InspectorProps) {
  const { setUmpEnfocada, setCajon } = useSeleccionDireccion();
  if (titular) {
    const suyos = reemplazosDe(titular.id_manzana, reemplazos);
    const observaciones = revision.grupos.filter((g) => g.umps.some((u) => u.idManzana === titular.id_manzana || suyos.some((r) => r.id_manzana === u.idManzana)));
    return (
      <>
        <InspectorCabecera
          marca={codigoDeUmp(titular).replace(/^UMP\s*/, "")}
          estado={estado === "error" ? "error" : estado === "aviso" ? "aviso" : "ok"}
          sobre={`UMP titular, ${nombreDistrito(titular.distrito)}`}
          titulo={`Zona ${titular.zona}, Manzana ${String(titular.id_manzana).slice(-4)}`}
          derecha={
            <>
              <span className="hr-ins-pasos">
                <button type="button" aria-label="Ruta anterior" onClick={() => onVecina(-1)}><ChevronUp size={14} /></button>
                <button type="button" aria-label="Ruta siguiente" onClick={() => onVecina(1)}><ChevronDown size={14} /></button>
              </span>
              <PulsoButton variant="icon" size="sm" aria-label="Cerrar la ficha" onClick={() => setUmpEnfocada(null)}><X size={14} /></PulsoButton>
            </>
          }
        />
        <div className="hr-mapa-ins-cuerpo">
          <EstadoChip label={ETIQUETA[estado]} tone={estado === "error" ? "danger" : estado === "aviso" ? "warn" : estado === "info" ? "info" : "success"} />
          <div className="hr-mapa-cifras">
            <div><small>Viviendas</small><strong data-tono={titular.viviendas === 0 ? "error" : titular.viviendas <= titular.entrevistas ? "aviso" : undefined}>{fmt(titular.viviendas)}</strong></div>
            <div><small>Entrevistas</small><strong>{fmt(titular.entrevistas)}</strong></div>
            {/* F30: con salto 1 la ficha impresa dice «deshabilitada» (se visita cada vivienda); el inspector habla igual. */}
            <div><small>Salto</small><strong>{Number(titular.salto_operativo ?? titular.constante_salto ?? 0) > 1 ? `1 de ${titular.salto_operativo ?? titular.constante_salto}` : "Sin salto"}</strong></div>
          </div>
          <OcupacionRuta viviendas={titular.viviendas} visitas={titular.visitas_esperadas ?? titular.entrevistas} />
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
          {/* ADR 0118 F3: la hoja grande y su impresión viven en Material de campo (módulo encargado). */}
          {enviada ? (
            <Link className="hr-entrega-enlace" to={`${HREF_CAMPANA_TERRITORIAL}&panel=hoja&foco=${encodeURIComponent(titular.id_manzana)}`}>
              Ver la hoja en Material de campo
            </Link>
          ) : (
            <p className="hr-mapa-nota">La hoja de esta ruta se ve e imprime en Material de campo, después de enviar la muestra desde «Entrega».</p>
          )}
          {/* Checklist I1: el avance de campo vive en Monitoreo (D2); la UMP es la misma llave en los dos módulos. */}
          {titular.hoja_num ? (
            <Link className="hr-entrega-enlace" to={`/monitoreo?modo=territorial&seccion=avance&pestana=mapa&panel=ump&foco=${titular.hoja_num}`}>
              Ver su avance en Monitoreo
            </Link>
          ) : null}
          <section className="hr-muestra-grupo" aria-label="Reemplazos en orden">
            <h3>Reemplazos en orden</h3>
            {suyos.length ? (
              <>
                <p className="hr-mapa-nota">Si la titular no completa su ruta, se pasa a la primera; si tampoco, a la siguiente, en este orden.</p>
                <ol className="hr-sel-reemplazos">
                  {suyos.map((r) => (
                    <li key={r.id_manzana}>
                      <strong>{codigoDeUmp(r)}, Mz {String(r.id_manzana).slice(-4)}</strong>
                      <span>Zona {r.zona}, {fmt(r.viviendas)} viv., NSE {nse(r)}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="hr-mapa-nota">Esta ruta no tiene reemplazos sorteados.</p>
            )}
          </section>
          {/* B45 + ADR 0118 F3: el reemplazo puntual se genera en Material › Paquetes, con esta titular marcada. */}
          {!enviada && estado !== "ok" ? <p className="hr-mapa-nota">Para pedirle reemplazos nuevos sin tocar el sorteo, envía la muestra: el reemplazo puntual se genera en Material de campo.</p> : null}
          <div className="hr-mapa-acciones">
            {enviada ? (
              <Link className="hr-entrega-enlace" title="Pedir reemplazos nuevos para esta titular sin tocar el sorteo" to={`${HREF_CAMPANA_TERRITORIAL.replace("seccion=unidades&pestana=lista", "seccion=paquetes&pestana=armado")}&foco=${encodeURIComponent(titular.id_manzana)}`}>
                Reemplazo puntual
              </Link>
            ) : null}
            <PulsoButton variant="secondary" size="sm" onClick={() => setCajon("titulares")}>
              Tablas
            </PulsoButton>
          </div>
        </div>
        {/* `salidas` va PRIMERO en el pie de las dos vistas: misma posición en el árbol, así React no
            lo vuelve a montar al abrir o cerrar la ficha y no se pierde un ZIP en curso. El CSS lo
            lleva a la derecha. */}
        <footer className="hr-mapa-pie hr-sel-pie">
          {salidas}
        </footer>
      </>
    );
  }
  return (
    <>
      <InspectorCabecera icono={ListChecks} sobre="Selección" titulo="Revisión contra el marco" />
      <div className="hr-mapa-ins-cuerpo">
        <div className="hr-mapa-cifras">
          <div><small>Titulares</small><strong>{fmt(totales.titulares)}</strong></div>
          <div><small>Reemplazos</small><strong>{fmt(totales.reemplazos)}</strong></div>
          {/* F14/F15: un solo número, el mismo de la barra y la lista (rutas); el de UMP va como desglose. */}
          <div><small>Por revisar</small><strong>{fmt(rutasPorRevisar ?? revision.porRevisar)}</strong></div>
        </div>
        {/* P5: los avisos de las cuotas y las que no cuadran con el N (eran chips de la clásica). */}
        <AvisosDelMotor avisos={cuotas?.alerts} extra={[cuotasDescuadradas(cuotas)].filter((t): t is string => Boolean(t))} />
        {rutasPorRevisar !== undefined && revision.porRevisar !== rutasPorRevisar ? (
          <p className="hr-mapa-nota">{fmt(rutasPorRevisar)} rutas con su titular o algún reemplazo observado: {fmt(revision.porRevisar)} UMP en total.</p>
        ) : null}
        {revision.grupos.length ? (
          revision.grupos.map((g) => (
            <article key={g.tipo} className="hr-sel-grupo" data-estado={g.tono}>
              <strong>{g.titulo}</strong>
              <small>{g.detalle}</small>
              <AccionDelGrupo accion={accionDeObservacion(g.tipo, minimoMarco)} />
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
        {/* P8: la tira de viviendas y la tabla por distrito, la evidencia de la lista de arriba. */}
        <EvidenciaRevision revision={revision} />
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

/** F23: dónde se arregla lo que la observación describe. */
function AccionDelGrupo({ accion }: { accion: AccionObservacion | null }) {
  if (!accion) return null;
  return (
    <p className="hr-sel-accion">
      {accion.texto}{" "}
      {accion.destino === "marco" ? <Link to="/hojas-ruta?seccion=manzanas#marco-elegible">Ir al marco elegible</Link> : <Link to="/hojas-ruta?seccion=manzanas">Ir a Manzanas</Link>}
    </p>
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
    <Panel
      className="hr-sel-cajon"
      aria-label="Tablas de la selección"
      title="Tablas de la selección"
      actions={
        <>
          <GlidingRadioGroup value={cajon} options={PESTANAS} getOptionValue={(o) => o[0]} onValueChange={setCajon} className="hr-muestra-opciones" aria-label="Tabla">
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
          <PulsoButton variant="icon" size="sm" aria-label="Cerrar las tablas" onClick={() => setCajon(null)}>
            <X size={14} aria-hidden />
          </PulsoButton>
        </>
      }
    >
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
    </Panel>
  );
}

/**
 * Cuánto de la manzana visita la ruta (brecha B44, artefacto .hm-ocupa): visitas
 * esperadas sobre viviendas. Sin viviendas, en rojo: no hay a quién visitar.
 */
function OcupacionRuta({ viviendas, visitas }: { viviendas: number; visitas: number }) {
  const ocupa = viviendas > 0 ? Math.min(1, visitas / viviendas) : 1;
  const tono = viviendas === 0 ? "error" : visitas >= viviendas ? "aviso" : undefined;
  return (
    <div className="hr-ocupa">
      <div className="hr-ocupa-barra"><i data-tono={tono} style={{ width: `${Math.max(2, ocupa * 100)}%` }} /></div>
      <small data-tono={tono}>
        {viviendas === 0 ? "Sin viviendas que visitar" : visitas >= viviendas ? `La ruta pide ${visitas} visitas y la manzana tiene ${viviendas} viviendas: se barre entera` : `La ruta visita ${Math.round(ocupa * 100)} % de las viviendas`}
      </small>
    </div>
  );
}
