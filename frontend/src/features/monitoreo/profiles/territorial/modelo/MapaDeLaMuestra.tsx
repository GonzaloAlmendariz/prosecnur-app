import { useMemo } from "react";
import type { TerritorialBlockProgress } from "../../../../../api/client";
import { normalizeRouteBlockCode } from "../../../routeCoverageModel";
import { fmt, nombreDeDistrito } from "../rotulos";
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

/**
 * Las manzanas de la muestra sobre sus distritos (territorial.md §3.5):
 * titulares con relleno y reemplazos como anillo. Usa la misma cartografía y
 * caché que Avance › Mapa; nada se superpone al lienzo.
 */
export function MapaDeLaMuestra({ bloques }: { bloques: readonly TerritorialBlockProgress[] }) {
  const ubigeos = useMemo(
    () => [...new Set(bloques.map((bloque) => normalizeRouteBlockCode(bloque.ubigeo)).filter(Boolean))],
    [bloques],
  );
  const cartografia = useCartografiaDelMapa(ubigeos, null);
  const emparejadas = useMemo(() => {
    const features = ubigeos.flatMap((ubigeo) => cartografia.base[ubigeo]?.blockMap?.geojson?.features ?? []);
    return selectTerritorialMapFeatures(features, [...bloques]);
  }, [bloques, cartografia.base, ubigeos]);
  const activos = useMemo(() => new Set(ubigeos), [ubigeos]);
  const distritos = useMemo(
    () => LIMA_DISTRICT_FEATURES.filter((feature) => activos.has(normalizeRouteBlockCode(feature.properties.ubigeo))),
    [activos],
  );
  const proyeccion = useMemo(() => buildTerritorialMapProjection(distritos.length ? distritos : LIMA_DISTRICT_FEATURES, [], [], 24), [distritos]);
  const titulares = bloques.filter((bloque) => String(bloque.tipo_manzana).toLowerCase() !== "reemplazo").length;
  const listo = !cartografia.cargando || emparejadas.length > 0;

  return (
    <div className="mon-mod-mapa-lienzo" data-audit-ready={listo ? "monitoreo-territorial-modelo-mapa" : "false"}>
      <svg
        viewBox={`0 0 ${LIMA_MAP_WIDTH} ${LIMA_MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${fmt(titulares)} manzanas titulares y ${fmt(bloques.length - titulares)} reemplazos en ${fmt(distritos.length)} distritos`}
      >
        <g className="mon-mod-mapa-distritos">
          {distritos.map((feature) => {
            const rotulo = proyeccion.project(feature.properties.label_lon, feature.properties.label_lat);
            return (
              <g key={feature.properties.ubigeo}>
                <path d={territorialDistrictPath(feature, proyeccion)} />
                <text x={rotulo.x} y={rotulo.y} textAnchor="middle">{nombreDeDistrito(feature.properties.distrito)}</text>
              </g>
            );
          })}
        </g>
        <g>
          {emparejadas.map((item) => {
            const centro = centroDeManzana(item.feature);
            if (!centro) return null;
            const punto = proyeccion.project(centro.lon, centro.lat);
            const reemplazo = String(item.block.tipo_manzana).toLowerCase() === "reemplazo";
            return <circle key={item.key} cx={punto.x} cy={punto.y} r={4} className={reemplazo ? "is-reemplazo" : "is-titular"} />;
          })}
        </g>
      </svg>
      <footer className="mon-mod-mapa-pie">
        <span className="is-titular">Titular</span>
        <span className="is-reemplazo">Reemplazo</span>
        <span>Distritos PlanMet · manzanas INEI 2017{cartografia.incompleta ? " · cartografía incompleta" : ""}</span>
      </footer>
    </div>
  );
}
