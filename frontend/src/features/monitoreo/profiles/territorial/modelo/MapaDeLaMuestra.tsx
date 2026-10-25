import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MonitoreoTerritorialDashboard, TerritorialBlockProgress } from "../../../../../api/client";
import { normalizeRouteBlockCode } from "../../../routeCoverageModel";
import { fmt, nombreDeDistrito } from "../rotulos";
import { LIMA_DISTRICT_FEATURES, selectTerritorialMapFeatures } from "../TerritorialRouteCoverageAtlas";
import { centroDeManzana } from "../avance/mapaModel";
import { useCartografiaDelMapa } from "../avance/useCartografiaDelMapa";
import { cajaProyectada, candidatosDeCaja, ubicarRotulos } from "./rotulosDelMapa";
import { encuadrar, manzanasDelMapa, reemplazosEnUso, trazoDe, verticesDe } from "./mapaDeLaMuestraModel";

/** Ancho del lienzo en unidades del SVG; el alto sigue la proporción de la tarjeta. */
const ANCHO = 1000;
const MARGEN = 36;

/**
 * Lo que mide el lienzo en pantalla, para que el encuadre llene la tarjeta en
 * vez de quedar con la proporción fija del atlas (antes, media tarjeta vacía).
 */
function useProporcion(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [proporcion, setProporcion] = useState(0.62);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const { width, height } = nodo.getBoundingClientRect();
      if (width > 0 && height > 0) setProporcion((previa) => (Math.abs(previa - height / width) > 0.01 ? height / width : previa));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  return [ref, proporcion];
}

/**
 * Las manzanas de la muestra sobre Lima (territorial.md §3.5): titulares con
 * relleno y, como anillo, sólo los reemplazos que hoy cubren a su titular. Los
 * demás distritos de Lima Metropolitana van tenues, para ubicarse. Usa la
 * misma cartografía y caché que Avance › Mapa; nada se superpone al lienzo.
 */
export function MapaDeLaMuestra({
  bloques,
  avance,
}: {
  bloques: readonly TerritorialBlockProgress[];
  avance: MonitoreoTerritorialDashboard | null;
}) {
  const [refLienzo, proporcion] = useProporcion();
  const enUso = useMemo(() => reemplazosEnUso(avance), [avance]);
  const conteo = useMemo(() => manzanasDelMapa(bloques, enUso), [bloques, enUso]);
  const ubigeos = useMemo(
    () => [...new Set(bloques.map((bloque) => normalizeRouteBlockCode(bloque.ubigeo)).filter(Boolean))],
    [bloques],
  );
  const cartografia = useCartografiaDelMapa(ubigeos, null);
  const emparejadas = useMemo(() => {
    const features = ubigeos.flatMap((ubigeo) => cartografia.base[ubigeo]?.blockMap?.geojson?.features ?? []);
    return selectTerritorialMapFeatures(features, [...conteo.visibles]);
  }, [cartografia.base, conteo.visibles, ubigeos]);
  const activos = useMemo(() => new Set(ubigeos), [ubigeos]);
  const distritos = useMemo(
    () => LIMA_DISTRICT_FEATURES.filter((feature) => activos.has(normalizeRouteBlockCode(feature.properties.ubigeo))),
    [activos],
  );
  const contexto = useMemo(
    () => LIMA_DISTRICT_FEATURES.filter((feature) => !activos.has(normalizeRouteBlockCode(feature.properties.ubigeo))),
    [activos],
  );
  const alto = Math.round(ANCHO * proporcion);
  const encuadre = useMemo(
    () => encuadrar((distritos.length ? distritos : LIMA_DISTRICT_FEATURES).flatMap((feature) => verticesDe(feature.geometry.coordinates)), ANCHO, alto, MARGEN),
    [alto, distritos],
  );
  const puntos = useMemo(() => emparejadas.flatMap((item) => {
    const centro = centroDeManzana(item.feature);
    if (!centro) return [];
    const punto = encuadre.proyectar(centro.lon, centro.lat);
    return [{ key: item.key, x: punto.x, y: punto.y, reemplazo: String(item.block.tipo_manzana).toLowerCase() === "reemplazo" }];
  }), [emparejadas, encuadre]);
  const rotulos = useMemo(() => ubicarRotulos(
    distritos.map((feature) => ({
      clave: feature.properties.ubigeo,
      texto: nombreDeDistrito(feature.properties.distrito),
      candidatos: candidatosDeCaja(
        encuadre.proyectar(feature.properties.label_lon, feature.properties.label_lat),
        cajaProyectada(feature.geometry.coordinates, encuadre.proyectar),
      ),
    })),
    puntos,
  ), [distritos, encuadre, puntos]);
  // Sin el corte de avance no se sabe qué reemplazo está en uso: la vista
  // espera a que la precarga lo deje en la caché.
  const listo = avance != null && (!cartografia.cargando || emparejadas.length > 0);

  return (
    <div className="mon-mod-mapa-lienzo" data-audit-ready={listo ? "monitoreo-territorial-modelo-mapa" : "false"}>
      <div className="mon-mod-mapa-marco" ref={refLienzo}>
        <svg
          viewBox={`0 0 ${ANCHO} ${alto}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${fmt(conteo.titulares)} manzanas titulares y ${fmt(conteo.enUso)} reemplazos en uso en ${fmt(distritos.length)} distritos de Lima`}
        >
          <g className="mon-mod-mapa-contexto" aria-hidden="true">
            {contexto.map((feature) => <path key={feature.properties.ubigeo} d={trazoDe(feature.geometry, encuadre.proyectar)} />)}
          </g>
          <g className="mon-mod-mapa-distritos">
            {distritos.map((feature) => <path key={feature.properties.ubigeo} d={trazoDe(feature.geometry, encuadre.proyectar)} />)}
          </g>
          <g>
            {puntos.map((punto) => <circle key={punto.key} cx={punto.x} cy={punto.y} r={4.5} className={punto.reemplazo ? "is-reemplazo" : "is-titular"} />)}
          </g>
          <g className="mon-mod-mapa-rotulos">
            {rotulos.map((rotulo) => <text key={rotulo.clave} x={rotulo.x} y={rotulo.y} textAnchor="middle">{rotulo.texto}</text>)}
          </g>
        </svg>
      </div>
      <footer className="mon-mod-mapa-pie">
        <span className="is-titular">Titular</span>
        {conteo.enUso ? <span className="is-reemplazo">Reemplazo en uso</span> : null}
        {conteo.reserva && !conteo.sinDatoDeUso ? <span>{fmt(conteo.reserva)} de reserva sin usar</span> : null}
        {conteo.sinDatoDeUso ? <span>Sin el corte de avance no se sabe qué reemplazos están en uso.</span> : null}
        <span>Fuentes: distritos PlanMet y manzanas INEI 2017.{cartografia.incompleta ? " La cartografía está incompleta." : ""}</span>
      </footer>
    </div>
  );
}
