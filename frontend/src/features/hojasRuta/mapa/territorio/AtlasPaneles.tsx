import { ChevronLeft, ChevronRight, MapPinned, Plus } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { InspectorCabecera } from "../InspectorCabecera";
import { proyectarLonLat } from "../lienzo/camara";
import type { CiudadAtlas } from "./ciudades";
import "./atlas.css";

/**
 * Territorio, nivel atlas (dirección A del paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md).
 * Estructura: la columna del estudio (cifras y ciudades elegidas) y, debajo, el resto de ciudades con
 * cartografía para que todas se alcancen también sin el mapa (C4). Inspector: la tarjeta de la ciudad
 * enfocada. El mapa informa; agregar, quitar y abrir son botones explícitos.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const enMiles = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("es-PE", { maximumFractionDigits: 1 })} M` : `${fmt(n / 1000)} mil`);

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
  onEnfocar: (codigo: string | null) => void;
  onAbrir: (codigo: string) => void;
};

export function AtlasEstructura({ ciudades, enEstudio, confirmados, enfocada, onEnfocar, onAbrir }: EstructuraProps) {
  const delEstudio = ciudades.filter((c) => enEstudio.includes(c.codigo));
  const otras = ciudades.filter((c) => !enEstudio.includes(c.codigo));
  const elegidos = new Set(confirmados);
  return (
    <div className="hr-atlas-estructura">
      <header className="hr-atlas-cab">
        <small>Territorio del estudio</small>
        <h2>{delEstudio.length ? delEstudio.map((c) => c.nombre).join(" · ") : "¿Dónde se hace?"}</h2>
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
          <p className="hr-atlas-vacio">Todavía ninguna. Haz clic en una ciudad del mapa o elígela abajo.</p>
        )}
        <h3>Otras ciudades con cartografía <span>{otras.length}</span></h3>
        <ul>
          {otras.map((c) => (
            <li key={c.codigo}>
              <button type="button" className="hr-atlas-ciudad hr-atlas-ciudad--otra" aria-current={enfocada === c.codigo || undefined} onClick={() => onEnfocar(enfocada === c.codigo ? null : c.codigo)}>
                <Silueta ciudad={c} tam={28} enEstudio={false} />
                <span>
                  <strong>{c.nombre}</strong>
                  <small>{c.departamento} · {enMiles(c.poblacion)} hab.</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
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

export function AtlasInspector({ ciudad, enEstudio, elegidos, totalCiudades, bloqueado, guardando, onAgregar, onAbrir, onQuitar }: InspectorProps) {
  if (!ciudad) {
    return (
      <>
        <InspectorCabecera icono={MapPinned} sobre="Territorio" titulo="¿Dónde se hace el estudio?" />
        <div className="hr-mapa-ins-cuerpo">
          <p className="hr-atlas-guia">
            Las {totalCiudades} ciudades con cartografía de manzanas están en el mapa; el tamaño del círculo es su población. Haz clic en una para ver qué cubre, agrégala al estudio y luego elige sus distritos.
          </p>
          <p className="hr-atlas-guia">Sólo se carga el mapa de las ciudades que abres.</p>
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
              <PulsoButton variant="secondary" disabled={bloqueado || guardando} onClick={() => onQuitar(ciudad.codigo)}>
                {elegidos ? `Quitar con sus ${elegidos} distrito${elegidos === 1 ? "" : "s"}` : "Quitar del estudio"}
              </PulsoButton>
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
