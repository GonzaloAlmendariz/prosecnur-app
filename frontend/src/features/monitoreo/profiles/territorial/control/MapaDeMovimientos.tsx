import { useMemo } from "react";
import type { MonitoreoTerritorialOperationalAdjustment, TerritorialBlockProgress } from "../../../../../api/client";
import { normalizeRouteBlockCode } from "../../../routeCoverageModel";
import { fmt } from "../rotulos";
import {
  LIMA_DISTRICT_FEATURES,
  LIMA_MAP_HEIGHT,
  LIMA_MAP_WIDTH,
  buildTerritorialMapProjection,
  selectTerritorialMapFeatures,
  territorialDistrictPath,
} from "../TerritorialRouteCoverageAtlas";
import { centroDeManzana } from "../avance/mapaModel";
import { useCartografiaDelMapa } from "../avance/useCartografiaDelMapa";

type Movimiento = { clave: string; origen: string; destino: string; sugerido: boolean };

function bloqueMinimo(id: string): TerritorialBlockProgress {
  return {
    id_manzana: id, ubigeo: id.slice(0, 6), distrito: "", zona: "", manzana: "", tipo_manzana: "",
    meta: null, validas: 0, revision: 0, no_defendibles: 0, avance_pct: null, brecha: null,
  };
}

/**
 * Los movimientos de subsanación sobre el mapa (territorial.md §3.11): cada
 * activo como línea de la manzana que cede a la que recibe y el sugerido
 * punteado. Misma cartografía y caché que Avance › Mapa; nada encima del
 * lienzo.
 */
export function MapaDeMovimientos({
  activos,
  sugeridos,
}: {
  activos: readonly MonitoreoTerritorialOperationalAdjustment[];
  sugeridos: readonly MonitoreoTerritorialOperationalAdjustment[];
}) {
  const movimientos = useMemo<Movimiento[]>(() => [
    ...activos.map((item, indice) => ({ clave: `a-${item.id ?? indice}`, origen: String(item.source_block_id), destino: String(item.target_block_id), sugerido: false })),
    ...sugeridos.map((item, indice) => ({ clave: `s-${item.id ?? indice}`, origen: String(item.source_block_id), destino: String(item.target_block_id), sugerido: true })),
  ].filter((mov) => mov.origen && mov.destino), [activos, sugeridos]);
  const ids = useMemo(() => [...new Set(movimientos.flatMap((mov) => [mov.origen, mov.destino]))], [movimientos]);
  const ubigeos = useMemo(() => [...new Set(ids.map((id) => normalizeRouteBlockCode(id.slice(0, 6))).filter(Boolean))], [ids]);
  const cartografia = useCartografiaDelMapa(ubigeos, null);
  const centros = useMemo(() => {
    const features = ubigeos.flatMap((ubigeo) => cartografia.base[ubigeo]?.blockMap?.geojson?.features ?? []);
    const pares = selectTerritorialMapFeatures(features, ids.map(bloqueMinimo));
    return new Map(pares.map((par) => [par.block.id_manzana, centroDeManzana(par.feature)]));
  }, [cartografia.base, ids, ubigeos]);
  const distritos = useMemo(() => {
    const conMovimientos = new Set(ubigeos);
    return LIMA_DISTRICT_FEATURES.filter((feature) => conMovimientos.has(normalizeRouteBlockCode(feature.properties.ubigeo)));
  }, [ubigeos]);
  const proyeccion = useMemo(() => buildTerritorialMapProjection(distritos.length ? distritos : LIMA_DISTRICT_FEATURES, [], [], 18), [distritos]);
  const dibujables = movimientos.filter((mov) => centros.get(mov.origen) && centros.get(mov.destino));

  if (!movimientos.length) return null;

  return (
    <figure className="mon-sub-mapa">
      <svg
        viewBox={`0 0 ${LIMA_MAP_WIDTH} ${LIMA_MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${fmt(activos.length)} movimientos activos y ${fmt(sugeridos.length)} sugeridos sobre el mapa`}
      >
        <defs>
          <marker id="mon-sub-punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" />
          </marker>
        </defs>
        <g className="mon-sub-mapa-distritos">
          {distritos.map((feature) => <path key={feature.properties.ubigeo} d={territorialDistrictPath(feature, proyeccion)} />)}
        </g>
        {dibujables.map((mov) => {
          const a = centros.get(mov.origen)!;
          const b = centros.get(mov.destino)!;
          const desde = proyeccion.project(a.lon, a.lat);
          const hasta = proyeccion.project(b.lon, b.lat);
          return (
            <line
              key={mov.clave}
              className={mov.sugerido ? "is-sugerido" : "is-activo"}
              x1={desde.x}
              y1={desde.y}
              x2={hasta.x}
              y2={hasta.y}
              markerEnd="url(#mon-sub-punta)"
            />
          );
        })}
      </svg>
      <figcaption className="mon-sub-base">
        <span className="mon-sub-leyenda is-activo">Activos</span>
        <span className="mon-sub-leyenda is-sugerido">Sugerido</span>
        {cartografia.cargando
          ? <span>Cargando la cartografía…</span>
          : dibujables.length < movimientos.length
            ? <span>{fmt(movimientos.length - dibujables.length)} sin manzana en la cartografía</span>
            : null}
      </figcaption>
    </figure>
  );
}
