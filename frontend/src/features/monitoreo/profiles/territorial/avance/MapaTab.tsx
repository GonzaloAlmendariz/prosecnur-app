import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { normalizeRouteBlockCode } from "../../../routeCoverageModel";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { enumerar, fmt, nombreDeDistrito } from "../rotulos";
import {
  LIMA_DISTRICT_FEATURES,
  LIMA_MAP_HEIGHT,
  LIMA_MAP_WIDTH,
  buildTerritorialMapProjection,
  selectTerritorialMapFeatures,
  territorialDistrictPath,
  territorialFeaturePath,
  territorialStreetPath,
} from "../TerritorialRouteCoverageAtlas";
import { FichaDeUmp } from "./FichaDeUmp";
import { construirFichaDeUmp } from "./fichaUmpModel";
import { callesCercanas, centroDeManzana, construirMapa, manzanasVecinas, type EstadoEnMapa } from "./mapaModel";
import { useCartografiaDelMapa } from "./useCartografiaDelMapa";
import { cajaProyectada, candidatosDeCaja, ubicarRotulos } from "../modelo/rotulosDelMapa";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { construirUmps } from "./umpsModel";
import { TooltipDelMapa, type ContenidoDeTooltip } from "./TooltipDelMapa";
import { useZoomDelMapa } from "./useZoomDelMapa";
import "./mapa.css";

type Capa = "avance" | "ocurrencias";

const ROTULO_DE_ESTADO: Record<EstadoEnMapa, string> = {
  completa: "Completa",
  subsanada: "Subsanada",
  pendiente: "Celda pendiente",
  "sin-usar": "Titular reemplazada",
};

const LIENZO = { x: 0, y: 0, ancho: LIMA_MAP_WIDTH, alto: LIMA_MAP_HEIGHT };

const PESO_DE_ESTADO: Record<EstadoEnMapa, number> = { "sin-usar": 0, completa: 1, subsanada: 2, pendiente: 3 };
const RADIO_DE_ESTADO: Record<EstadoEnMapa, number> = { "sin-usar": 3, completa: 3.6, subsanada: 4.6, pendiente: 7 };

/**
 * Avance › Mapa (territorial.md §3.15): cómo vamos en cada manzana. Tres
 * alturas: todo el campo (un punto por UMP), un distrito (las manzanas de la
 * ruta como áreas coloreadas por su estado, sobre el resto de manzanas del
 * distrito) y una UMP (su manzana, las vecinas y las calles, con su ficha).
 * El camino que registró Kobo vive en Control › Recorrido, no aquí.
 * Nada se superpone al mapa: barra arriba, leyenda abajo, ficha al costado.
 */
function MapaTabImpl({
  avance,
  validacion,
}: {
  avance: MonitoreoTerritorialDashboard | null;
  validacion: MonitoreoTerritorialDashboard | null;
}) {
  const modelo = useMemo(() => construirMapa(avance, validacion), [avance, validacion]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const ficha = useMemo(() => construirFichaDeUmp(avance, validacion, foco), [avance, foco, validacion]);
  const [capa, setCapa] = useState<Capa>("avance");
  const [sobre, setSobre] = useState<ContenidoDeTooltip | null>(null);
  // Estados apagados desde la leyenda: valen para los puntos y para las áreas.
  const [ocultos, setOcultos] = useState<ReadonlySet<string>>(() => new Set());
  // Distrito elegido (ubigeo): sus manzanas como áreas en vez de puntos.
  const [distritoElegido, setDistritoElegido] = useState<string | null>(null);
  const filaPorUmp = useMemo(() => new Map(construirUmps(avance, validacion).filas.map((fila) => [fila.ump, fila])), [avance, validacion]);
  const enfocada = ficha ? modelo.manzanas.find((manzana) => manzana.ump === ficha.ump && manzana.estado !== "sin-usar") ?? null : null;
  const cartografia = useCartografiaDelMapa(modelo.ubigeos, enfocada?.ubigeo ?? null);
  const sinParte = useMemo(() => new Set(modelo.sinParte.map((fila) => fila.ump)), [modelo.sinParte]);

  const todas = useMemo(
    () => modelo.ubigeos.flatMap((ubigeo) => cartografia.base[ubigeo]?.blockMap?.geojson?.features ?? []),
    [cartografia.base, modelo.ubigeos],
  );
  const manzanaPorId = useMemo(() => new Map(modelo.manzanas.map((manzana) => [manzana.idManzana, manzana])), [modelo.manzanas]);
  // Lo que pide atención se dibuja al final, encima: una pendiente no queda
  // tapada por las completas vecinas.
  const emparejadas = useMemo(
    () => selectTerritorialMapFeatures(todas, modelo.manzanas.map((manzana) => manzana.bloque))
      .map((item, indice) => ({ item, indice, peso: PESO_DE_ESTADO[manzanaPorId.get(item.block.id_manzana)?.estado ?? "completa"] }))
      .sort((a, b) => a.peso - b.peso || a.indice - b.indice)
      .map(({ item }) => item),
    [manzanaPorId, modelo.manzanas, todas],
  );
  const ubigeosActivos = useMemo(() => new Set(modelo.ubigeos.map(normalizeRouteBlockCode)), [modelo.ubigeos]);
  const distritos = useMemo(
    () => LIMA_DISTRICT_FEATURES.filter((feature) => ubigeosActivos.has(normalizeRouteBlockCode(feature.properties.ubigeo))),
    [ubigeosActivos],
  );
  // Los demás distritos de Lima, tenues, para ubicar los de la muestra.
  const contexto = useMemo(
    () => LIMA_DISTRICT_FEATURES.filter((feature) => !ubigeosActivos.has(normalizeRouteBlockCode(feature.properties.ubigeo))),
    [ubigeosActivos],
  );
  const distritoFeature = useMemo(
    () => (distritoElegido ? distritos.find((feature) => normalizeRouteBlockCode(feature.properties.ubigeo) === normalizeRouteBlockCode(distritoElegido)) ?? null : null),
    [distritoElegido, distritos],
  );
  const enDistrito = !enfocada && distritoFeature != null;
  // Las manzanas de la ruta en el distrito elegido. El encuadre se ajusta a
  // ellas, no al distrito: en San Juan de Lurigancho las 25 de la ruta quedaban
  // en una esquina, diminutas, entre 16 mil manzanas.
  const rutaDelDistrito = useMemo(() => {
    if (!enDistrito || !distritoFeature) return [];
    const ubigeo = normalizeRouteBlockCode(distritoFeature.properties.ubigeo);
    return emparejadas.filter((item) => normalizeRouteBlockCode(manzanaPorId.get(item.block.id_manzana)?.ubigeo) === ubigeo);
  }, [distritoFeature, emparejadas, enDistrito, manzanaPorId]);
  // El resto de manzanas del distrito, tenues y sólo alrededor de la ruta,
  // para leer las de la ruta en su trama real sin dibujar el distrito entero.
  const fondoDelDistrito = useMemo(() => {
    if (!rutaDelDistrito.length || !distritoFeature) return [];
    const centros = rutaDelDistrito.map((item) => centroDeManzana(item.feature)).filter((c): c is NonNullable<typeof c> => c != null);
    if (!centros.length) return [];
    const lons = centros.map((c) => c.lon);
    const lats = centros.map((c) => c.lat);
    const margenLon = Math.max(0.004, (Math.max(...lons) - Math.min(...lons)) * 0.12);
    const margenLat = Math.max(0.004, (Math.max(...lats) - Math.min(...lats)) * 0.12);
    const caja = { lon0: Math.min(...lons) - margenLon, lon1: Math.max(...lons) + margenLon, lat0: Math.min(...lats) - margenLat, lat1: Math.max(...lats) + margenLat };
    const ubigeo = modelo.ubigeos.find((item) => normalizeRouteBlockCode(item) === normalizeRouteBlockCode(distritoFeature.properties.ubigeo));
    const todas = ubigeo ? cartografia.base[ubigeo]?.blockMap?.geojson?.features ?? [] : [];
    return todas.filter((feature) => {
      const centro = centroDeManzana(feature);
      return centro != null && centro.lon >= caja.lon0 && centro.lon <= caja.lon1 && centro.lat >= caja.lat0 && centro.lat <= caja.lat1;
    });
  }, [cartografia.base, distritoFeature, modelo.ubigeos, rutaDelDistrito]);

  // Vista acercada a la UMP elegida: su manzana, las vecinas, calles y flecha.
  const acercada = useMemo(() => {
    if (!enfocada) return null;
    const propia = emparejadas.find((item) => item.block.id_manzana === enfocada.idManzana);
    const centro = propia ? centroDeManzana(propia.feature) : null;
    if (!propia || !centro) return null;
    const rica = cartografia.rica[enfocada.ubigeo];
    const featuresDelDistrito = rica?.blockMap?.geojson?.features ?? cartografia.base[enfocada.ubigeo]?.blockMap?.geojson?.features ?? [];
    const vecinas = manzanasVecinas(featuresDelDistrito, centro);
    const flecha = modelo.flechas.get(enfocada.ump) ?? null;
    const origen = flecha ? emparejadas.find((item) => item.block.id_manzana === flecha.origen) ?? null : null;
    const calles = callesCercanas(rica?.streetMap?.geojson?.features ?? [], centro);
    return { propia, centro, vecinas, flecha, origen, calles };
  }, [cartografia.base, cartografia.rica, emparejadas, enfocada, modelo.flechas]);

  const proyeccion = useMemo(() => {
    if (acercada) {
      const extra = acercada.origen ? [acercada.origen.feature] : [];
      return buildTerritorialMapProjection([], [...acercada.vecinas, acercada.propia.feature, ...extra], [], 28);
    }
    if (enDistrito && rutaDelDistrito.length) return buildTerritorialMapProjection([], rutaDelDistrito.map((item) => item.feature), [], 32);
    if (enDistrito && distritoFeature) return buildTerritorialMapProjection([distritoFeature], [], [], 20);
    return buildTerritorialMapProjection(distritos.length ? distritos : LIMA_DISTRICT_FEATURES, [], [], 24);
  }, [acercada, distritoFeature, distritos, enDistrito, rutaDelDistrito]);

  // Los nombres de distrito van encima de los puntos, con halo, donde menos
  // manzanas pisan (la misma regla que el mapa de Modelo › Metas).
  const rotulosDeDistrito = useMemo(() => {
    if (acercada || enDistrito) return [];
    const puntos = emparejadas.flatMap((item) => {
      const centro = centroDeManzana(item.feature);
      return centro ? [proyeccion.project(centro.lon, centro.lat)] : [];
    });
    return ubicarRotulos(
      distritos.map((feature) => ({
        clave: feature.properties.ubigeo,
        texto: nombreDeDistrito(feature.properties.distrito),
        candidatos: candidatosDeCaja(
          proyeccion.project(feature.properties.label_lon, feature.properties.label_lat),
          cajaProyectada(feature.geometry.coordinates, proyeccion.project),
        ),
      })),
      puntos,
    );
  }, [acercada, distritos, emparejadas, enDistrito, proyeccion]);

  // Unidades del viewBox por píxel de pantalla (`meet`: manda el eje más
  // apretado). Con esto el tooltip y los formularios miden lo mismo en
  // pantalla a cualquier zoom y ancho del panel.
  // Las capas pesadas (miles de manzanas de fondo, los distritos de Lima) se
  // memorizan: la rueda y el arrastre sólo cambian el viewBox y no deben
  // volver a crear 13 mil paths en cada paso.
  const capaDeFondo = useMemo(() => (
    <g className="mon-mapa-fondo" aria-hidden="true">
      {fondoDelDistrito.map((feature, indice) => {
        const d = territorialFeaturePath(feature, proyeccion);
        return d ? <path key={`${feature.properties.ID_MANZANA ?? indice}-${indice}`} d={d} /> : null;
      })}
    </g>
  ), [fondoDelDistrito, proyeccion]);
  const capaDeContexto = useMemo(() => (
    <g className="mon-mapa-contexto" aria-hidden="true">
      {contexto.map((feature) => <path key={feature.properties.ubigeo} d={territorialDistrictPath(feature, proyeccion)} />)}
    </g>
  ), [contexto, proyeccion]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Rueda y arrastre: cambiar de UMP o de distrito vuelve al encuadre completo.
  const zoom = useZoomDelMapa(LIENZO, svgRef, `${acercada?.propia.key ?? ""}|${enDistrito ? distritoElegido ?? "" : ""}`);
  const vista = zoom.vista;
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return undefined;
    const medir = () => setTamano({ ancho: svg.clientWidth, alto: svg.clientHeight });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(svg);
    return () => observador.disconnect();
    // El SVG se monta cuando llega la cartografía: se vuelve a observar entonces.
  }, [emparejadas.length, cartografia.cargando]);
  const unidadesPorPixel = tamano.ancho > 0 && tamano.alto > 0 ? Math.max(vista.ancho / tamano.ancho, vista.alto / tamano.alto) : vista.ancho / LIMA_MAP_WIDTH;

  const sinGeometria = !cartografia.cargando && !emparejadas.length;
  // Acercada a una UMP, la vista no está lista hasta tener sus calles y
  // vecinas (o saber que fallaron): mientras tanto lo declara en el pie.
  const esperaCalles = enfocada != null && cartografia.ricaPendiente;
  const readiness = !modelo.manzanas.length
    ? "vacio:sin-cuota"
    : (cartografia.cargando && !emparejadas.length) || esperaCalles
      ? "false"
      : sinGeometria ? "vacio:sin-cartografia" : "monitoreo-territorial-avance-mapa";

  const abrir = (ump: string) => {
    setSobre(null);
    escribirFoco(ump, { panel: "ump" });
  };
  // Cerrar la ficha vuelve al distrito si se venía de uno; «Todo el campo»
  // vuelve a la vista general.
  const cerrarFicha = () => {
    setSobre(null);
    if (foco) escribirFoco(null, { panel: null });
  };
  const encuadrar = () => {
    cerrarFicha();
    setDistritoElegido(null);
    zoom.encuadrar();
  };
  const entrarAlDistrito = (ubigeo: string | null) => {
    setSobre(null);
    setDistritoElegido(ubigeo);
    if (foco) escribirFoco(null, { panel: null });
  };

  const claseDe = (estado: EstadoEnMapa, ump: string) => {
    if (capa === "ocurrencias" && estado !== "sin-usar") return sinParte.has(ump) ? "is-sin-parte" : "is-con-parte";
    return `is-${estado}`;
  };

  const alternar = (clave: string) => {
    setSobre(null);
    setOcultos((previos) => {
      const siguientes = new Set(previos);
      if (siguientes.has(clave)) siguientes.delete(clave);
      else siguientes.add(clave);
      return siguientes;
    });
  };

  const leyenda: Array<{ clave: string; rotulo: string }> = capa === "ocurrencias"
    ? [{ clave: "is-con-parte", rotulo: "Con parte" }, { clave: "is-sin-parte", rotulo: "Sin parte" }]
    : (["completa", "subsanada", "pendiente", "sin-usar"] as const).map((estado) => ({ clave: `is-${estado}`, rotulo: ROTULO_DE_ESTADO[estado] }));

  const tooltipDeUmp = (manzana: (typeof modelo.manzanas)[number], punto: { x: number; y: number }): ContenidoDeTooltip => {
    const tipo = manzana.bloque.tipo_manzana ? manzana.bloque.tipo_manzana.toLowerCase() : "";
    const lugar = [
      manzana.bloque.distrito ? nombreDeDistrito(manzana.bloque.distrito) : "",
      manzana.bloque.manzana ? `manzana ${tipo ? `${tipo} ` : ""}${manzana.bloque.manzana}` : "",
    ].filter(Boolean).join(", ");
    const estado = capa === "ocurrencias" && manzana.estado !== "sin-usar"
      ? (sinParte.has(manzana.ump) ? "Sin reporte de ocurrencias" : "Con reporte de ocurrencias")
      : ROTULO_DE_ESTADO[manzana.estado];
    const fila = manzana.estado === "sin-usar" ? null : filaPorUmp.get(manzana.ump);
    const cifras = fila ? `${fmt(fila.cuentan)} de ${fmt(fila.meta)} encuestas cuentan${fila.observacion ? `, ${fmt(fila.observacion)} en observación` : ""}` : "";
    return {
      x: punto.x,
      y: punto.y,
      titulo: `UMP ${manzana.ump} · ${estado}`,
      lineas: [lugar || "Sin ubicación", cifras, manzana.estado === "sin-usar" ? "Ya no se usa en la ruta" : "Clic para ver su ficha"].filter(Boolean),
    };
  };

  return (
    <section
      className={`mon-mapa${ficha ? " con-ficha" : ""}`}
      aria-label="Mapa del avance por UMP"
      data-audit-ready={readiness}
      data-qa-geometry-group="territorial-mapa"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-mapa-lienzo-panel" data-qa-geometry-member="mapa">
        <header className="mon-mapa-barra">
          <RotuloDePestana />
          {modelo.conOcurrencias ? (
            <span className="mon-mapa-segmentado" role="group" aria-label="Capa del mapa">
              <button type="button" aria-pressed={capa === "avance"} className={capa === "avance" ? "is-active" : ""} onClick={() => setCapa("avance")}>Avance UMP</button>
              <button type="button" aria-pressed={capa === "ocurrencias"} className={capa === "ocurrencias" ? "is-active" : ""} onClick={() => setCapa("ocurrencias")}>Ocurrencias</button>
            </span>
          ) : (
            <span className="mon-mapa-titulo">Avance UMP</span>
          )}
          <label className="mon-mapa-ir">
            <span>Distrito</span>
            <select value={enDistrito && distritoFeature ? distritoFeature.properties.ubigeo : ""} onChange={(event) => entrarAlDistrito(event.currentTarget.value || null)}>
              <option value="">Todo el campo</option>
              {distritos.map((feature) => (
                <option key={feature.properties.ubigeo} value={feature.properties.ubigeo}>{nombreDeDistrito(feature.properties.distrito)}</option>
              ))}
            </select>
          </label>
          <label className="mon-mapa-ir">
            <span>UMP</span>
            <select value={ficha?.ump ?? ""} onChange={(event) => (event.currentTarget.value ? abrir(event.currentTarget.value) : cerrarFicha())}>
              <option value="">Todas</option>
              {modelo.manzanas.filter((manzana) => manzana.estado !== "sin-usar").map((manzana) => (
                <option key={manzana.ump} value={manzana.ump}>UMP {manzana.ump}</option>
              ))}
            </select>
          </label>
          <span className="mon-mapa-zoom">
            <button type="button" aria-label="Acercar" title="Acercar (también con la rueda del mouse)" disabled={!zoom.puedeAcercar} onClick={() => zoom.acercar()}>
              <Plus size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Alejar" disabled={!zoom.puedeAlejar} onClick={() => zoom.alejar()}>
              <Minus size={15} aria-hidden="true" />
            </button>
            <button type="button" className="is-texto" onClick={encuadrar}>
              <Maximize2 size={14} aria-hidden="true" />
              Todo el campo
            </button>
          </span>
        </header>

        <div className="mon-mapa-lienzo" aria-busy={esperaCalles || undefined}>
          {sinGeometria ? (
            <p className="mon-mapa-vacio">
              {cartografia.incompleta
                ? "No se pudo cargar la cartografía de Hojas de ruta para estos distritos."
                : "Las manzanas de la ruta no tienen cartografía en Hojas de ruta."}
            </p>
          ) : (
            <svg
              ref={svgRef}
              className={`mon-mapa-svg${enDistrito ? " en-distrito" : ""}${zoom.arrastrando ? " is-arrastrando" : ""}`}
              {...zoom.manejadores}
              onMouseLeave={() => setSobre(null)}
              viewBox={zoom.viewBox}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={acercada
                ? `Entorno de la UMP ${ficha?.ump}: su manzana, las vecinas y las calles`
                : enDistrito && distritoFeature
                  ? `Manzanas de la ruta en ${nombreDeDistrito(distritoFeature.properties.distrito)}, coloreadas por su estado`
                  : `Manzanas de ${fmt(modelo.manzanas.length)} UMP en ${fmt(distritos.length)} distritos`}
            >
              {acercada ? (
                <>
                  <g className="mon-mapa-calles">
                    {acercada.calles.map((calle, indice) => {
                      const d = territorialStreetPath(calle, proyeccion);
                      return d ? <path key={`${calle.properties.id ?? indice}`} d={d} /> : null;
                    })}
                  </g>
                  <g className="mon-mapa-vecinas">
                    {acercada.vecinas.map((feature, indice) => {
                      const d = territorialFeaturePath(feature, proyeccion);
                      return d ? <path key={`${feature.properties.ID_MANZANA ?? indice}`} d={d} /> : null;
                    })}
                  </g>
                </>
              ) : (
                <>
                {capaDeContexto}
                <g className="mon-mapa-distritos">
                  {distritos.map((feature) => (
                    <path
                      key={feature.properties.ubigeo}
                      d={territorialDistrictPath(feature, proyeccion)}
                      className={enDistrito ? "" : "is-elegible"}
                      onClick={enDistrito ? undefined : () => entrarAlDistrito(feature.properties.ubigeo)}
                    >
                      {enDistrito ? null : <title>Ver las manzanas de {nombreDeDistrito(feature.properties.distrito)}</title>}
                    </path>
                  ))}
                </g>
                {enDistrito ? capaDeFondo : null}
                </>
              )}

              <g className="mon-mapa-manzanas">
                {emparejadas.map((item) => {
                  const manzana = manzanaPorId.get(item.block.id_manzana);
                  if (!manzana) return null;
                  const elegida = enfocada?.idManzana === manzana.idManzana;
                  if (acercada) {
                    const d = territorialFeaturePath(item.feature, proyeccion);
                    if (!d) return null;
                    return (
                      <path
                        key={item.key}
                        d={d}
                        className={`mon-mapa-manzana ${claseDe(manzana.estado, manzana.ump)}${elegida ? " is-elegida" : ""}`}
                        onClick={() => abrir(manzana.ump)}
                      >
                        <title>UMP {manzana.ump}, {ROTULO_DE_ESTADO[manzana.estado].toLowerCase()}</title>
                      </path>
                    );
                  }
                  const centro = centroDeManzana(item.feature);
                  if (!centro) return null;
                  const punto = proyeccion.project(centro.lon, centro.lat);
                  const clase = claseDe(manzana.estado, manzana.ump);
                  if (ocultos.has(clase)) return null;
                  if (enDistrito) {
                    if (normalizeRouteBlockCode(manzana.ubigeo) !== normalizeRouteBlockCode(distritoFeature?.properties.ubigeo)) return null;
                    const d = territorialFeaturePath(item.feature, proyeccion);
                    if (!d) return null;
                    return (
                      <path
                        key={item.key}
                        d={d}
                        className={`mon-mapa-area ${clase}`}
                        onClick={() => abrir(manzana.ump)}
                        onMouseEnter={() => setSobre(tooltipDeUmp(manzana, punto))}
                        onMouseLeave={() => setSobre(null)}
                      />
                    );
                  }
                  const radio = capa === "ocurrencias" && manzana.estado !== "sin-usar"
                    ? (sinParte.has(manzana.ump) ? RADIO_DE_ESTADO.pendiente : RADIO_DE_ESTADO.completa)
                    : RADIO_DE_ESTADO[manzana.estado];
                  const resalta = clase === "is-pendiente" || clase === "is-sin-parte";
                  return (
                    <g
                      key={item.key}
                      className={`mon-mapa-punto-grupo ${clase}`}
                      onClick={() => abrir(manzana.ump)}
                      onMouseEnter={() => setSobre(tooltipDeUmp(manzana, punto))}
                      onMouseLeave={() => setSobre(null)}
                    >
                      {resalta ? <circle className="mon-mapa-halo" cx={punto.x} cy={punto.y} r={radio + 6} /> : null}
                      <circle cx={punto.x} cy={punto.y} r={radio} className={`mon-mapa-punto ${clase}`} />
                      {resalta && capa === "avance" ? (
                        <text className="mon-mapa-etiqueta" x={punto.x + radio + 5} y={punto.y + 4}>UMP {manzana.ump}</text>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              {enDistrito ? (
                <g className="mon-mapa-areas-rotulos" aria-hidden="true">
                  {rutaDelDistrito.map((item) => {
                    const manzana = manzanaPorId.get(item.block.id_manzana);
                    const centro = centroDeManzana(item.feature);
                    if (!manzana || !centro || ocultos.has(claseDe(manzana.estado, manzana.ump))) return null;
                    const punto = proyeccion.project(centro.lon, centro.lat);
                    // Insignia de tamaño fijo en pantalla (~22 px): el círculo
                    // lleva el color del estado y el número va en blanco.
                    const radio = (manzana.ump.length > 2 ? 12 : 10.5) * unidadesPorPixel;
                    return (
                      <g key={item.key} className={`mon-mapa-insignia ${claseDe(manzana.estado, manzana.ump)}`}>
                        <circle cx={punto.x} cy={punto.y} r={radio} style={{ strokeWidth: 1.5 * unidadesPorPixel }} />
                        <text x={punto.x} y={punto.y + 3.6 * unidadesPorPixel} textAnchor="middle" style={{ fontSize: 10 * unidadesPorPixel }}>
                          {manzana.ump}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ) : null}

              {rotulosDeDistrito.length ? (
                <g className="mon-mapa-rotulos" aria-hidden="true">
                  {rotulosDeDistrito.map((rotulo) => <text key={rotulo.clave} x={rotulo.x} y={rotulo.y} textAnchor="middle">{rotulo.texto}</text>)}
                </g>
              ) : null}

              {acercada?.flecha && acercada.origen ? (() => {
                const desde = centroDeManzana(acercada.origen.feature);
                if (!desde) return null;
                const a = proyeccion.project(desde.lon, desde.lat);
                const b = proyeccion.project(acercada.centro.lon, acercada.centro.lat);
                return (
                  <g className="mon-mapa-flecha">
                    <defs>
                      <marker id="mon-mapa-punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 z" />
                      </marker>
                    </defs>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd="url(#mon-mapa-punta)" />
                    <text x={a.x} y={a.y - 8} textAnchor="middle">UMP {acercada.flecha.umpOrigen}</text>
                  </g>
                );
              })() : null}

              {sobre ? <TooltipDelMapa contenido={sobre} unidadesPorPixel={unidadesPorPixel} vista={vista} /> : null}
            </svg>
          )}
        </div>

        <footer className="mon-mapa-pie">
          <span className="mon-mapa-leyenda" role="group" aria-label="Mostrar u ocultar por estado">
            {leyenda.map((item) => {
              const visible = !ocultos.has(item.clave);
              return (
                <button
                  key={item.clave}
                  type="button"
                  className={`${item.clave}${visible ? "" : " is-apagado"}`}
                  aria-pressed={visible}
                  title={visible ? `Ocultar «${item.rotulo}»` : `Mostrar «${item.rotulo}»`}
                  onClick={() => alternar(item.clave)}
                >
                  {item.rotulo}
                </button>
              );
            })}
          </span>
          <span className="mon-mapa-fuente">
            Fuentes: {enumerar(["distritos PlanMet", "manzanas INEI 2017", acercada?.calles.length ? "calles OpenStreetMap" : ""])}
          </span>
          {cartografia.incompleta ? <span className="mon-ter-chip is-aviso">Cartografía incompleta</span> : null}
          {esperaCalles ? <span className="mon-ter-chip is-info" role="status">Cargando calles</span> : null}
        </footer>
      </div>

      <div className="mon-mapa-lateral" data-qa-geometry-member="lateral">
        {ficha ? (
          <FichaDeUmp
            ficha={ficha}
            onCerrar={cerrarFicha}
            onSugerencia={() => escribirFoco(ficha.ump, { seccion: "control", pestana: "subsanaciones", panel: null })}
          />
        ) : (
          <ResumenDelMapa modelo={modelo} onAbrir={abrir} />
        )}
      </div>
    </section>
  );
}

function ResumenDelMapa({ modelo, onAbrir }: { modelo: ReturnType<typeof construirMapa>; onAbrir: (ump: string) => void }) {
  return (
    <aside className="mon-mapa-resumen" aria-label="Estado de las UMP">
      <dl className="mon-mapa-conteos" data-qa-geometry-group="territorial-mapa-conteos" data-qa-geometry-contract="equal">
        <div className="is-completa"><dt>Completas</dt><dd>{fmt(modelo.conteos.completa)}</dd></div>
        <div className="is-subsanada"><dt>Subsanadas</dt><dd>{fmt(modelo.conteos.subsanada)}</dd></div>
        <div className="is-pendiente"><dt>Pendientes</dt><dd>{fmt(modelo.conteos.pendiente)}</dd></div>
      </dl>
      <PorDistrito modelo={modelo} />
      <section aria-labelledby="mon-mapa-pendientes">
        <h3 id="mon-mapa-pendientes" className="mon-mapa-subtitulo">Celda de cuota pendiente</h3>
        {modelo.pendientes.length ? (
          <ul className="mon-mapa-lista">
            {modelo.pendientes.map((fila) => (
              <li key={fila.ump}>
                <button type="button" onClick={() => onAbrir(fila.ump)}>
                  <b>UMP {fila.ump}</b>
                  <span>{fila.distrito}</span>
                  <small>{fila.cuota}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mon-mapa-base">Ninguna UMP tiene celdas pendientes.</p>
        )}
      </section>
      {modelo.conOcurrencias ? (
        <section aria-labelledby="mon-mapa-sin-parte">
          <h3 id="mon-mapa-sin-parte" className="mon-mapa-subtitulo">Sin reporte de ocurrencias</h3>
          {modelo.sinParte.length ? (
            <ul className="mon-mapa-lista">
              {modelo.sinParte.map((fila) => (
                <li key={fila.ump}>
                  <button type="button" onClick={() => onAbrir(fila.ump)}>
                    <b>UMP {fila.ump}</b>
                    <span>{fila.distrito}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mon-mapa-base">Todas las UMP tienen su parte.</p>
          )}
        </section>
      ) : null}
    </aside>
  );
}

/** UMP por distrito con su estado: dónde está el campo cerrado y dónde no. */
function PorDistrito({ modelo }: { modelo: ReturnType<typeof construirMapa> }) {
  const filas = useMemo(() => {
    const porDistrito = new Map<string, Record<"completa" | "subsanada" | "pendiente", number>>();
    for (const manzana of modelo.manzanas) {
      if (manzana.estado === "sin-usar") continue;
      const distrito = manzana.bloque.distrito ? nombreDeDistrito(manzana.bloque.distrito) : "Sin distrito";
      const fila = porDistrito.get(distrito) ?? { completa: 0, subsanada: 0, pendiente: 0 };
      fila[manzana.estado] += 1;
      porDistrito.set(distrito, fila);
    }
    return [...porDistrito.entries()]
      .map(([distrito, cuenta]) => ({ distrito, ...cuenta, total: cuenta.completa + cuenta.subsanada + cuenta.pendiente }))
      .sort((a, b) => b.pendiente - a.pendiente || a.distrito.localeCompare(b.distrito, "es"));
  }, [modelo.manzanas]);
  if (!filas.length) return null;
  return (
    <section aria-labelledby="mon-mapa-distritos">
      <h3 id="mon-mapa-distritos" className="mon-mapa-subtitulo">UMP por distrito</h3>
      <ul className="mon-mapa-distritos-lista">
        {filas.map((fila) => (
          <li key={fila.distrito}>
            <span className="mon-mapa-distrito-nombre">{fila.distrito}</span>
            <span className="mon-mapa-distrito-barra" aria-hidden="true">
              <i className="is-completa" style={{ flexGrow: fila.completa }} />
              <i className="is-subsanada" style={{ flexGrow: fila.subsanada }} />
              <i className="is-pendiente" style={{ flexGrow: fila.pendiente }} />
            </span>
            <span className="mon-mapa-distrito-cifra">
              {fmt(fila.total - fila.pendiente)}/{fmt(fila.total)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const MapaTab = memo(MapaTabImpl);
