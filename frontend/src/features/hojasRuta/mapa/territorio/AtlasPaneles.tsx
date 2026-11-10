import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPinned, Plus, Inbox, Trash2 } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { InspectorCabecera } from "../InspectorCabecera";
import { proyectarLonLat } from "../lienzo/camara";
import type { CiudadAtlas } from "./ciudades";
import { ciudadesDeDepartamento } from "./atlasFoco";
import "./atlas.css";
import { DistritoAtlasTarjeta, type DistritoAtlas } from "./DistritoAtlasTarjeta";

import { formatoDecimal } from "../../../../lib/formatoNumero";
import { EstadoVacio } from "../../../../components/EstadoVacio";
/**
 * Territorio, nivel atlas (dirección A del paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md).
 * Estructura: la columna del estudio (cifras y ciudades elegidas) y, debajo, el resto de ciudades con
 * cartografía para que todas se alcancen también sin el mapa (C4). Inspector: la tarjeta de la ciudad
 * enfocada. El mapa informa; agregar, quitar y abrir son botones explícitos.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const enMiles = (n: number) => (n >= 1e6 ? `${formatoDecimal(n / 1e6, 1)} M` : `${fmt(n / 1000)} mil`);

/** Silueta de la huella urbana de una ciudad, a su propia escala. */
export function Silueta({ ciudad, tam, enEstudio }: { ciudad: CiudadAtlas; tam: number; enEstudio: boolean }) {
  const anillos = ciudad.silueta.map((r) => r.map(([lon, lat]) => proyectarLonLat(lon, lat)));
  const [x0, y0, x1, y1] = ciudad.caja;
  const s = Math.min((tam - 6) / (x1 - x0 || 1), (tam - 6) / (y1 - y0 || 1));
  const ox = (tam - (x1 - x0) * s) / 2, oy = (tam - (y1 - y0) * s) / 2;
  const d = anillos.map((r) => "M" + r.map(([x, y]) => `${((x - x0) * s + ox).toFixed(1)},${((y - y0) * s + oy).toFixed(1)}`).join("L") + "Z").join("");
  return (
    <svg className="hr-atlas-silueta" data-en-estudio={enEstudio || undefined} width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true">
      <path d={d} fillRule="evenodd" />
    </svg>
  );
}

type EstructuraProps = {
  ciudades: readonly CiudadAtlas[];
  enEstudio: readonly string[];
  confirmados: readonly string[];
  enfocada: string | null;
  /** Departamento enfocado en el mapa: la lista de otras ciudades se limita a las suyas. */
  departamento?: string | null;
  onEnfocar: (codigo: string | null) => void;
  onAbrir: (codigo: string) => void;
  onTodoPeru?: () => void;
};

export function AtlasEstructura({ ciudades, enEstudio, confirmados, enfocada, departamento = null, onEnfocar, onAbrir, onTodoPeru }: EstructuraProps) {
  const delEstudio = ciudades.filter((c) => enEstudio.includes(c.codigo));
  const delDepartamento = departamento ? new Set(ciudadesDeDepartamento(ciudades, departamento).map((c) => c.codigo)) : null;
  const otras = ciudades.filter((c) => !enEstudio.includes(c.codigo) && (!delDepartamento || delDepartamento.has(c.codigo)));
  const elegidos = new Set(confirmados);
  return (
    <div className="hr-atlas-estructura">
      <header className="hr-atlas-cab">
        <small>Territorio del estudio</small>
        <h2>{delEstudio.length ? delEstudio.map((c) => c.nombre).join(", ") : "¿Dónde se hace?"}</h2>
        <p>{confirmados.length ? `${confirmados.length} distrito${confirmados.length === 1 ? "" : "s"} confirmado${confirmados.length === 1 ? "" : "s"}` : "Elige una o más ciudades con cartografía."}</p>
      </header>
      <div className="hr-atlas-lista">
        <h3>Ciudades del estudio</h3>
        {delEstudio.length ? (
          <ul>
            {delEstudio.map((c) => {
              const n = c.ubigeos.filter((u) => elegidos.has(u)).length;
              return (
                <li key={c.codigo}>
                  <button type="button" className="hr-atlas-ciudad" aria-current={enfocada === c.codigo || undefined} onClick={() => onAbrir(c.codigo)}>
                    <Silueta ciudad={c} tam={40} enEstudio />
                    <span>
                      <strong>{c.nombre}</strong>
                      {n ? <small>{n} de {c.distritos} distritos</small> : <em>Elige sus distritos</em>}
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EstadoVacio icono={<Inbox size={16} />} titulo="Todavía ninguna" descripcion="Haz clic en una ciudad del mapa o elígela abajo." />
        )}
        {departamento || enfocada ? (
          <button type="button" className="hr-atlas-volver" onClick={onTodoPeru}>
            <ChevronLeft size={14} aria-hidden="true" /> Todo el Perú
          </button>
        ) : null}
        <h3>{departamento ? `Ciudades de ${departamento}` : "Otras ciudades con cartografía"} <span>{otras.length}</span></h3>
        <ul>
          {otras.map((c) => (
            <li key={c.codigo}>
              <button type="button" className="hr-atlas-ciudad hr-atlas-ciudad--otra" aria-current={enfocada === c.codigo || undefined} onClick={() => onEnfocar(enfocada === c.codigo ? null : c.codigo)}>
                <Silueta ciudad={c} tam={28} enEstudio={false} />
                <span>
                  <strong>{c.nombre}</strong>
                  <small>{c.departamento}, {enMiles(c.poblacion)} hab.</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {departamento && !otras.length ? <EstadoVacio icono={<Inbox size={16} />} titulo={`${departamento} no tiene otras ciudades con cartografía de manzanas`} /> : null}
      </div>
    </div>
  );
}

type InspectorProps = {
  ciudad: CiudadAtlas | null;
  enEstudio: boolean;
  /** Distritos confirmados de esta ciudad. */
  elegidos: number;
  totalCiudades: number;
  bloqueado: boolean;
  guardando: boolean;
  onAgregar: (codigo: string) => void;
  onAbrir: (codigo: string) => void;
  onQuitar: (codigo: string) => void;
};

/** El distrito elegido en la ciudad abierta: su tarjeta reemplaza a la de la ciudad (H21). */
type DistritoProps = {
  distrito: DistritoAtlas | null;
  adentro: boolean;
  cargandoManzanas: boolean;
  errorManzanas: string | null;
  manzanas: number | null;
  /** Con qué se pintan sus manzanas («viviendas», «NSE»); null si van sin color. */
  pintadasPor?: string | null;
  onVerManzanas: () => void;
  onVolverCiudad: () => void;
};

export function AtlasInspector(props: InspectorProps & DistritoProps) {
  const { distrito, adentro, cargandoManzanas, errorManzanas, manzanas, pintadasPor = null, onVerManzanas, onVolverCiudad, ...ciudad } = props;
  if (distrito && ciudad.ciudad) {
    return <DistritoAtlasTarjeta ciudad={ciudad.ciudad.nombre} distrito={distrito} adentro={adentro} cargandoManzanas={cargandoManzanas} errorManzanas={errorManzanas} manzanas={manzanas} pintadasPor={pintadasPor} onVerManzanas={onVerManzanas} onVolver={onVolverCiudad} />;
  }
  // La confirmación de quitar es de UNA ciudad: al abrir otra, vuelve a pedirse.
  return <AtlasInspectorCiudad key={ciudad.ciudad?.codigo ?? ""} {...ciudad} />;
}

function AtlasInspectorCiudad({ ciudad, enEstudio, elegidos, totalCiudades, bloqueado, guardando, onAgregar, onAbrir, onQuitar }: InspectorProps) {
  const [confirmando, setConfirmando] = useState(false);
  if (!ciudad) {
    return (
      <>
        <InspectorCabecera icono={MapPinned} sobre="Territorio" titulo="¿Dónde se hace el estudio?" />
        <div className="hr-mapa-ins-cuerpo">
          <ol className="hr-atlas-pasos" aria-label="Cómo se elige el territorio">
            <li>Abre una de las {totalCiudades} ciudades</li>
            <li>Agrégala al estudio</li>
            <li>Elige sus distritos</li>
          </ol>
          <p className="hr-atlas-guia">El círculo crece con la población.</p>
        </div>
      </>
    );
  }
  const baja = ciudad.captacion !== null && ciudad.captacion < 55;
  return (
    <>
      <InspectorCabecera icono={MapPinned} sobre={ciudad.departamento} titulo={ciudad.nombre} />
      <div className="hr-mapa-ins-cuerpo">
        <div className="hr-atlas-tarjeta">
          <Silueta ciudad={ciudad} tam={120} enEstudio={enEstudio} />
          <dl className="hr-atlas-cifras">
            <div><dt>Habitantes</dt><dd>{enMiles(ciudad.poblacion)}</dd></div>
            <div><dt>Distritos</dt><dd>{ciudad.distritos}</dd></div>
            <div><dt>Manzanas</dt><dd>{fmt(ciudad.manzanas)}</dd></div>
          </dl>
          {ciudad.captacion !== null ? (
            <p className="hr-atlas-nota" data-baja={baja || undefined}>
              El marco capta el {Math.round(ciudad.captacion)} % de la población censada en 2025{baja ? ": menos de lo recomendable para un marco de manzanas" : ""}.
            </p>
          ) : null}
          {enEstudio && elegidos ? <p className="hr-atlas-nota">{elegidos} de {ciudad.distritos} distritos en el estudio.</p> : null}
        </div>
        <div className="hr-atlas-acciones">
          {enEstudio ? (
            <>
              <PulsoButton variant="primary" onClick={() => onAbrir(ciudad.codigo)}>
                Elegir distritos <ChevronRight size={14} aria-hidden="true" />
              </PulsoButton>
              {confirmando ? (
                // Quitar una ciudad con distritos elegidos rehace el estudio: se dice qué se pierde antes de hacerlo
                // («Quitar con sus 6 distritos» lo hacía de un clic y no se entendía; revisión del 7 nov 2026).
                <div className="hr-mapa-aviso hr-atlas-quitar" role="alert">
                  <p>
                    {ciudad.nombre} sale del estudio con {elegidos === 1 ? "su distrito elegido" : `sus ${elegidos} distritos elegidos`}. Se
                    recalculan la población, la muestra y las cuotas, y se descarta el sorteo actual.
                  </p>
                  <div className="hr-atlas-quitar-acciones">
                    <PulsoButton variant="danger" confirm disabled={bloqueado || guardando} onClick={() => onQuitar(ciudad.codigo)}>
                      <Trash2 size={14} aria-hidden="true" /> Quitar del estudio
                    </PulsoButton>
                    <PulsoButton variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
                  </div>
                </div>
              ) : (
                <PulsoButton variant="secondary" disabled={bloqueado || guardando} onClick={() => (elegidos ? setConfirmando(true) : onQuitar(ciudad.codigo))}>
                  Quitar del estudio
                </PulsoButton>
              )}
            </>
          ) : (
            <PulsoButton variant="primary" disabled={bloqueado || guardando} onClick={() => onAgregar(ciudad.codigo)}>
              <Plus size={14} aria-hidden="true" /> Agregar al estudio
            </PulsoButton>
          )}
        </div>
      </div>
    </>
  );
}

/** Cabecera de la ciudad abierta, encima de la lista de distritos. */
export function CiudadCabecera({ ciudad, onVolver }: { ciudad: CiudadAtlas; onVolver: () => void }) {
  return (
    <div className="hr-atlas-ciudad-cab">
      <button type="button" onClick={onVolver}>
        <ChevronLeft size={14} aria-hidden="true" /> Todas las ciudades
      </button>
      <div>
        <Silueta ciudad={ciudad} tam={36} enEstudio />
        <span>
          <small>{ciudad.departamento}</small>
          <strong>{ciudad.nombre}</strong>
        </span>
      </div>
    </div>
  );
}

/** Miga del atlas por niveles: Perú › departamento › ciudad, con cada nivel clicable para subir. */
export function MigaAtlas({ total, departamento, ciudad, distritos, cargando, fallo = false, onReintentar, distrito = null, adentro = false, cargandoManzanas = false, onCiudad, enEstudio = false, onPeru, onDepartamento }: {
  total: number;
  /** Si la ciudad ya está en el estudio: sólo entonces existe «Elegir distritos». */
  enEstudio?: boolean;
  departamento: string | null;
  ciudad: CiudadAtlas | null;
  distritos: number;
  cargando: boolean;
  /** Si el pedido de sus distritos falló: «0 distritos» se leía como una ciudad sin distritos (revisión del 7 nov 2026). */
  fallo?: boolean;
  onReintentar?: () => void;
  /** El distrito elegido (H21): la miga baja un nivel y la ciudad pasa a ser un enlace de vuelta. */
  distrito?: string | null;
  /** Si se ven sus manzanas. */
  adentro?: boolean;
  /** Mientras llegan sus manzanas (la primera lectura de un distrito tarda): el mapa se ve vacío y la miga dice por qué. */
  cargandoManzanas?: boolean;
  onCiudad?: () => void;
  onPeru: () => void;
  onDepartamento: (nombre: string) => void;
}) {
  const dep = ciudad ? (ciudad.codigo === "lima" ? null : ciudad.departamento) : departamento;
  if (!dep && !ciudad) return <><b>Perú</b><span className="hr-lienzo-miga-ayuda">({total} ciudades con cartografía)</span></>;
  return (
    <>
      <button type="button" className="hr-miga-nivel" onClick={onPeru}>Perú</button>
      {dep ? <> › {ciudad ? <button type="button" className="hr-miga-nivel" onClick={() => onDepartamento(dep)}>{dep}</button> : <b>{dep}</b>}</> : null}
      {ciudad && distrito ? (
        <>
          {" › "}
          <button type="button" className="hr-miga-nivel" onClick={onCiudad}>{ciudad.nombre}</button> › <b>{distrito}</b>
          {adentro ? <span className="hr-lienzo-miga-ayuda">{cargandoManzanas ? "(cargando manzanas…)" : "(sus manzanas)"}</span> : null}
        </>
      ) : null}
      {ciudad && !distrito ? <> › <b>{ciudad.nombre}</b></> : null}
      {ciudad && distrito ? null : <span className="hr-lienzo-miga-ayuda">
        {/* Nombra el botón que de verdad está en la ficha: fuera del estudio es «Agregar al estudio». */}
        {/* Entre paréntesis: con el hueco del contenedor flex, una coma inicial quedaba suelta («Perú , 26…»). */}
        {/* Sólo el dato: la acción («Elegir distritos» / «Agregar al estudio») ya está en la ficha y la frase truncaba la píldora. */}
        {ciudad ? (cargando ? "(cargando sus distritos…)" : fallo && !distritos ? "(no se pudieron cargar sus distritos)" : `(${distritos} distrito${distritos === 1 ? "" : "s"}${enEstudio ? ", en el estudio" : ""})`) : "(clic en una ciudad para ver su ficha)"}
      </span>}
      {ciudad && fallo && !distritos && onReintentar ? <button type="button" className="hr-miga-nivel" onClick={onReintentar}>Reintentar</button> : null}
    </>
  );
}
