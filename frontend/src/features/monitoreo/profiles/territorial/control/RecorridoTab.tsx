import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Route as RouteIcon } from "lucide-react";
import type { MonitoreoTerritorialDashboard, TerritorialBlockProgress } from "../../../../../api/client";
import { fmt } from "../rotulos";
import {
  LIMA_MAP_HEIGHT,
  LIMA_MAP_WIDTH,
  buildTerritorialMapProjection,
  selectTerritorialMapFeatures,
  territorialFeaturePath,
  territorialStreetPath,
} from "../TerritorialRouteCoverageAtlas";
import { callesCercanas, centroDeManzana, manzanasVecinas } from "../avance/mapaModel";
import { useCartografiaDelMapa } from "../avance/useCartografiaDelMapa";
import { separarEnEspiral } from "../avance/exploracionModel";
import { TooltipDelMapa, type ContenidoDeTooltip } from "../avance/TooltipDelMapa";
import { useZoomDelMapa } from "../avance/useZoomDelMapa";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import {
  ROTULO_DEL_ESTADO,
  ROTULO_DE_TRAMO,
  construirRecorrido,
  resumirJornada,
  rotuloDeManzana,
  textoDeDistanciaDeFormulario,
  type FormularioDelRecorrido,
  type ManzanaDeLaJornada,
  type TramoDeDistancia,
} from "./recorridoModel";
import "./recorrido.css";

const TRAMOS: readonly TramoDeDistancia[] = ["cerca", "revision", "lejos"];
const LIENZO = { x: 0, y: 0, ancho: LIMA_MAP_WIDTH, alto: LIMA_MAP_HEIGHT };

function bloqueDe(manzana: ManzanaDeLaJornada): TerritorialBlockProgress {
  return {
    id_manzana: manzana.idManzana,
    ubigeo: manzana.ubigeo || manzana.idManzana.slice(0, 6),
    distrito: manzana.distrito,
    zona: manzana.zona,
    manzana: manzana.manzana,
    tipo_manzana: manzana.tipo,
    ump: manzana.ump,
    meta: null,
    validas: 0,
    revision: 0,
    no_defendibles: 0,
    avance_pct: null,
    brecha: null,
  };
}

function tooltipDe(formulario: FormularioDelRecorrido, punto: { x: number; y: number }): ContenidoDeTooltip {
  return {
    x: punto.x,
    y: punto.y,
    titulo: `${formulario.orden}. ${formulario.hora || "Sin hora"} · ${textoDeDistanciaDeFormulario(formulario)}`,
    lineas: [
      rotuloDeManzana(formulario),
      `${ROTULO_DEL_ESTADO[formulario.estado]}${formulario.duracionMin != null ? ` · ${fmt(Math.round(formulario.duracionMin))} min` : ""}`,
    ],
  };
}

/**
 * Control › Recorrido: el camino que registró Kobo para un aplicador en un día.
 * Cada formulario es un punto numerado en su GPS, unido a SU manzana por una
 * línea fina del color de su distancia; la línea gruesa une los puntos en orden
 * de hora. Un aplicador que pasó por varias manzanas las ve todas, cada una
 * con sus formularios.
 */
function RecorridoTabImpl({
  validacion,
}: {
  validacion: MonitoreoTerritorialDashboard | null;
}) {
  const modelo = useMemo(() => construirRecorrido(validacion), [validacion]);
  const [aplicadorPedido, setAplicador] = useState<string | null>(null);
  const aplicador = modelo.aplicadores.find((item) => item.aplicador === aplicadorPedido) ?? modelo.aplicadores[0] ?? null;
  const [diaPedido, setDia] = useState<string | null>(null);
  const jornada = aplicador?.jornadas.find((item) => item.fechaIso === diaPedido) ?? aplicador?.jornadas[0] ?? null;
  const resumen = jornada ? resumirJornada(jornada) : null;
  const [sobre, setSobre] = useState<{ id: string; contenido: ContenidoDeTooltip } | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);

  const ubigeos = useMemo(() => [...new Set((jornada?.manzanas ?? []).map((manzana) => manzana.ubigeo).filter(Boolean))], [jornada]);
  const ubigeoPrincipal = jornada?.manzanas[0]?.ubigeo ?? null;
  const cartografia = useCartografiaDelMapa(ubigeos, ubigeoPrincipal);

  const geometria = useMemo(() => {
    if (!jornada) return null;
    const features = ubigeos.flatMap((ubigeo) => (cartografia.rica[ubigeo] ?? cartografia.base[ubigeo])?.blockMap?.geojson?.features ?? []);
    const propias = selectTerritorialMapFeatures(features, jornada.manzanas.filter((manzana) => manzana.idManzana).map(bloqueDe));
    const centros = new Map(propias.flatMap((item) => {
      const centro = centroDeManzana(item.feature);
      return centro ? [[item.block.id_manzana, centro] as const] : [];
    }));
    const vecinas = [...centros.values()].flatMap((centro) => manzanasVecinas(features, centro, 220));
    const calles = ubigeoPrincipal
      ? [...centros.values()].flatMap((centro) => callesCercanas(cartografia.rica[ubigeoPrincipal]?.streetMap?.geojson?.features ?? [], centro, 360))
      : [];
    return { propias, centros, vecinas, calles };
  }, [cartografia.base, cartografia.rica, jornada, ubigeoPrincipal, ubigeos]);

  const proyeccion = useMemo(() => {
    const gps = (jornada?.formularios ?? [])
      .filter((formulario) => formulario.lat != null && formulario.lon != null)
      .map((formulario) => ({ lon: formulario.lon as number, lat: formulario.lat as number }));
    const bloques = geometria ? [...geometria.propias.map((item) => item.feature)] : [];
    return buildTerritorialMapProjection([], bloques, [], 36, gps);
  }, [geometria, jornada]);

  const puntos = useMemo(() => {
    const conGps = (jornada?.formularios ?? []).filter((formulario) => formulario.lat != null && formulario.lon != null);
    const proyectados = conGps.map((formulario) => ({ id: formulario.id, ...proyeccion.project(formulario.lon as number, formulario.lat as number) }));
    const separados = new Map(separarEnEspiral(proyectados, 14).map((punto) => [punto.id, punto]));
    return conGps.flatMap((formulario) => {
      const punto = separados.get(formulario.id);
      return punto ? [{ formulario, punto }] : [];
    });
  }, [jornada, proyeccion]);

  // Unidades del viewBox por píxel: puntos, números y tooltip miden lo mismo
  // en pantalla a cualquier ancho del panel.
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Rueda y arrastre; cambiar de aplicador o de día vuelve al encuadre completo.
  const zoom = useZoomDelMapa(LIENZO, svgRef, `${aplicador?.aplicador ?? ""}|${jornada?.fechaIso ?? ""}`);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return undefined;
    const medir = () => setTamano({ ancho: svg.clientWidth, alto: svg.clientHeight });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(svg);
    return () => observador.disconnect();
  }, [jornada]);
  const upp = tamano.ancho > 0 && tamano.alto > 0
    ? Math.max(zoom.vista.ancho / tamano.ancho, zoom.vista.alto / tamano.alto)
    : zoom.vista.ancho / LIMA_MAP_WIDTH;

  if (!modelo.disponible || !aplicador || !jornada || !resumen) {
    return (
      <section className="mon-rec mon-rec--vacio" data-audit-ready="vacio:sin-respuestas" aria-label="Recorrido">
        <div className="mon-rec-panel mon-rec-vacio">
          <RotuloDePestana />
          <RouteIcon size={20} aria-hidden="true" />
          <strong>Sin formularios en el corte</strong>
          <span>El recorrido aparece cuando la fuente de Kobo trae respuestas con fecha de la fase activa.</span>
        </div>
      </section>
    );
  }

  const esperando = cartografia.cargando || cartografia.ricaPendiente;
  const readiness = esperando ? "false" : "monitoreo-territorial-control-recorrido";
  const elegirAplicador = (valor: string) => {
    setAplicador(valor);
    setDia(null);
    setElegido(null);
    setSobre(null);
  };
  const elegirDia = (valor: string) => {
    setDia(valor);
    setElegido(null);
    setSobre(null);
  };
  const resaltado = sobre?.id ?? elegido;
  const linea = puntos.map(({ punto }, indice) => `${indice ? "L" : "M"}${punto.x.toFixed(1)},${punto.y.toFixed(1)}`).join(" ");
  const rotuloDeManzanaEnMapa = (manzana: ManzanaDeLaJornada) => [manzana.ump ? `UMP ${manzana.ump}` : "", manzana.manzana].filter(Boolean).join(" · ");

  return (
    <section
      className="mon-rec"
      aria-label="Recorrido del aplicador"
      data-audit-ready={readiness}
      data-qa-geometry-group="territorial-recorrido"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-rec-panel mon-rec-mapa-panel" data-qa-geometry-member="mapa">
        <header className="mon-rec-barra">
          <RotuloDePestana />
          <label className="mon-rec-campo">
            <span>Aplicador</span>
            <select value={aplicador.aplicador} onChange={(event) => elegirAplicador(event.currentTarget.value)}>
              {modelo.aplicadores.map((item) => (
                <option key={item.aplicador} value={item.aplicador}>
                  {item.aplicador} · {fmt(item.formularios)} formularios{item.lejos ? ` · ${fmt(item.lejos)} lejos` : ""}
                </option>
              ))}
            </select>
          </label>
          <span className="mon-rec-dias" role="group" aria-label="Día">
            {aplicador.jornadas.map((item) => (
              <button
                key={item.fechaIso}
                type="button"
                aria-pressed={item.fechaIso === jornada.fechaIso}
                className={item.fechaIso === jornada.fechaIso ? "is-active" : ""}
                onClick={() => elegirDia(item.fechaIso)}
              >
                {item.rotulo}
                <small>{fmt(item.formularios.length)}</small>
              </button>
            ))}
          </span>
          <span className="mon-rec-zoom">
            <button type="button" aria-label="Acercar" title="Acercar (también con la rueda del mouse)" disabled={!zoom.puedeAcercar} onClick={() => zoom.acercar()}>
              <Plus size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Alejar" disabled={!zoom.puedeAlejar} onClick={() => zoom.alejar()}>
              <Minus size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Ver la jornada completa" title="Ver la jornada completa" disabled={!zoom.puedeAlejar} onClick={() => zoom.encuadrar()}>
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          </span>
        </header>

        <div className="mon-rec-lienzo">
          <svg
            ref={svgRef}
            className={`mon-rec-svg${zoom.arrastrando ? " is-arrastrando" : ""}`}
            viewBox={zoom.viewBox}
            {...zoom.manejadores}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Recorrido de ${aplicador.aplicador} el ${jornada.rotulo}: ${fmt(resumen.formularios)} formularios en ${fmt(resumen.manzanas)} manzanas`}
            onMouseLeave={() => setSobre(null)}
          >
            {geometria ? (
              <>
                <g className="mon-rec-calles" aria-hidden="true">
                  {geometria.calles.map((calle, indice) => {
                    const d = territorialStreetPath(calle, proyeccion);
                    return d ? <path key={`${calle.properties.id ?? indice}-${indice}`} d={d} /> : null;
                  })}
                </g>
                <g className="mon-rec-vecinas" aria-hidden="true">
                  {geometria.vecinas.map((feature, indice) => {
                    const d = territorialFeaturePath(feature, proyeccion);
                    return d ? <path key={`${feature.properties.ID_MANZANA ?? indice}-${indice}`} d={d} /> : null;
                  })}
                </g>
                <g className="mon-rec-manzanas">
                  {geometria.propias.map((item) => {
                    const d = territorialFeaturePath(item.feature, proyeccion);
                    return d ? <path key={item.key} d={d} className={item.block.tipo_manzana.toLowerCase() === "reemplazo" ? "is-reemplazo" : "is-titular"} /> : null;
                  })}
                </g>
                <g className="mon-rec-manzanas-rotulos" aria-hidden="true">
                  {jornada.manzanas.map((manzana) => {
                    const centro = geometria.centros.get(manzana.idManzana);
                    if (!centro) return null;
                    const punto = proyeccion.project(centro.lon, centro.lat);
                    return (
                      <text key={manzana.idManzana} x={punto.x} y={punto.y} textAnchor="middle" style={{ fontSize: 11 * upp }}>
                        {rotuloDeManzanaEnMapa(manzana)}
                      </text>
                    );
                  })}
                </g>
                {/* Cada formulario a SU manzana: la línea fina dice cuán lejos estaba. */}
                <g className="mon-rec-enlaces" aria-hidden="true">
                  {puntos.map(({ formulario, punto }) => {
                    const centro = geometria.centros.get(formulario.idManzana);
                    if (!centro) return null;
                    const destino = proyeccion.project(centro.lon, centro.lat);
                    return <line key={formulario.id} className={`is-${formulario.tramo}`} x1={punto.x} y1={punto.y} x2={destino.x} y2={destino.y} />;
                  })}
                </g>
              </>
            ) : null}
            <path className="mon-rec-camino" d={linea} aria-hidden="true" />
            <g className="mon-rec-puntos">
              {puntos.map(({ formulario, punto }) => (
                <g
                  key={formulario.id}
                  className={`mon-rec-punto is-${formulario.tramo}${resaltado === formulario.id ? " is-resaltado" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Formulario ${formulario.orden}, ${formulario.hora || "sin hora"}, ${textoDeDistanciaDeFormulario(formulario)}`}
                  onMouseEnter={() => setSobre({ id: formulario.id, contenido: tooltipDe(formulario, punto) })}
                  onMouseLeave={() => setSobre(null)}
                  onFocus={() => setSobre({ id: formulario.id, contenido: tooltipDe(formulario, punto) })}
                  onBlur={() => setSobre(null)}
                  onClick={() => setElegido(formulario.id)}
                >
                  <circle cx={punto.x} cy={punto.y} r={(resaltado === formulario.id ? 13 : 11) * upp} />
                  <text x={punto.x} y={punto.y + 4 * upp} textAnchor="middle" style={{ fontSize: 11 * upp }}>{formulario.orden}</text>
                </g>
              ))}
            </g>
            {sobre ? <TooltipDelMapa contenido={sobre.contenido} unidadesPorPixel={upp} vista={zoom.vista} /> : null}
          </svg>
        </div>

        <footer className="mon-rec-pie">
          <span className="mon-rec-leyenda">
            <span className="is-camino">Camino en orden de hora</span>
            {TRAMOS.map((tramo) => <span key={tramo} className={`is-${tramo}`}>{ROTULO_DE_TRAMO[tramo]} de su manzana</span>)}
          </span>
          <span className="mon-rec-fuente">Fuentes: GPS de Kobo, manzanas INEI 2017{geometria?.calles.length ? " y calles OpenStreetMap" : ""}</span>
          {resumen.formularios > resumen.conGps ? <span className="mon-ter-chip is-aviso">{fmt(resumen.formularios - resumen.conGps)} sin GPS</span> : null}
          {esperando ? <span className="mon-ter-chip is-info" role="status">Cargando cartografía</span> : null}
        </footer>
      </div>

      <aside className="mon-rec-panel mon-rec-lateral" aria-label="Jornada del aplicador" data-qa-geometry-member="lateral">
        <header className="mon-rec-lateral-cabecera">
          <h3>{aplicador.aplicador}</h3>
          <span className="mon-rec-base">{jornada.rotulo}{resumen.desde ? `, de ${resumen.desde} a ${resumen.hasta}` : ""}</span>
        </header>
        <dl className="mon-rec-cifras">
          <div><dt>Formularios</dt><dd>{fmt(resumen.formularios)}</dd></div>
          <div><dt>Manzanas</dt><dd>{fmt(resumen.manzanas)}</dd></div>
          <div className={resumen.fuera ? "is-alerta" : ""}><dt>A más de 150 m</dt><dd>{fmt(resumen.fuera)}</dd></div>
          <div><dt>Distancia mediana</dt><dd>{resumen.medianaM != null ? `${fmt(Math.round(resumen.medianaM))} m` : "—"}</dd></div>
        </dl>
        <h4 className="mon-rec-subtitulo">Formularios en orden</h4>
        <ol className="mon-rec-lista" data-qa-geometry-capacity="owned">
          {jornada.formularios.map((formulario) => (
            <li key={formulario.id}>
              <button
                type="button"
                aria-pressed={elegido === formulario.id}
                className={resaltado === formulario.id ? "is-resaltado" : ""}
                onMouseEnter={() => {
                  const item = puntos.find((p) => p.formulario.id === formulario.id);
                  if (item) setSobre({ id: formulario.id, contenido: tooltipDe(formulario, item.punto) });
                }}
                onMouseLeave={() => setSobre(null)}
                onClick={() => setElegido(formulario.id)}
              >
                <b className={`mon-rec-numero is-${formulario.tramo}`}>{formulario.orden}</b>
                <span className="mon-rec-hora">{formulario.hora || "—"}</span>
                <span className="mon-rec-manzana">{rotuloDeManzana(formulario)}</span>
                <span className={`mon-rec-distancia is-${formulario.tramo}`}>{textoDeDistanciaDeFormulario(formulario).replace(" de su manzana", "")}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

export const RecorridoTab = memo(RecorridoTabImpl);
