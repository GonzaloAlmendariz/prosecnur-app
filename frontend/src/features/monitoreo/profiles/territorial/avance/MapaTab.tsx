import { memo, useMemo, useState } from "react";
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
import "./mapa.css";

type Capa = "avance" | "ocurrencias";

const ROTULO_DE_ESTADO: Record<EstadoEnMapa, string> = {
  completa: "Completa",
  subsanada: "Subsanada",
  pendiente: "Celda pendiente",
  "sin-usar": "Titular reemplazada",
};

const ACERCAMIENTOS = [1, 1.5, 2.25, 3.4];

/**
 * Avance › Mapa (territorial.md §3.15). Arriba la barra del mapa (capa,
 * acercar, alejar, encuadrar e ir a una UMP); el lienzo a todo el alto; abajo
 * la leyenda y la fuente. Al costado, los conteos o la ficha de la UMP elegida
 * (`panel=ump&foco=<UMP>`): nada se superpone al mapa.
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
  const [nivel, setNivel] = useState(0);
  const enfocada = ficha ? modelo.manzanas.find((manzana) => manzana.ump === ficha.ump && manzana.estado !== "sin-usar") ?? null : null;
  const cartografia = useCartografiaDelMapa(modelo.ubigeos, enfocada?.ubigeo ?? null);
  const sinParte = useMemo(() => new Set(modelo.sinParte.map((fila) => fila.ump)), [modelo.sinParte]);

  const todas = useMemo(
    () => modelo.ubigeos.flatMap((ubigeo) => cartografia.base[ubigeo]?.blockMap?.geojson?.features ?? []),
    [cartografia.base, modelo.ubigeos],
  );
  const emparejadas = useMemo(
    () => selectTerritorialMapFeatures(todas, modelo.manzanas.map((manzana) => manzana.bloque)),
    [modelo.manzanas, todas],
  );
  const manzanaPorId = useMemo(() => new Map(modelo.manzanas.map((manzana) => [manzana.idManzana, manzana])), [modelo.manzanas]);
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
    return buildTerritorialMapProjection(distritos.length ? distritos : LIMA_DISTRICT_FEATURES, [], [], 24);
  }, [acercada, distritos]);

  // Los nombres de distrito van encima de los puntos, con halo, donde menos
  // manzanas pisan (la misma regla que el mapa de Modelo › Metas).
  const rotulosDeDistrito = useMemo(() => {
    if (acercada) return [];
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
  }, [acercada, distritos, emparejadas, proyeccion]);

  const escala = ACERCAMIENTOS[nivel] ?? 1;
  const ancho = LIMA_MAP_WIDTH / escala;
  const alto = LIMA_MAP_HEIGHT / escala;
  const centroVista = acercada ? proyeccion.project(acercada.centro.lon, acercada.centro.lat) : { x: LIMA_MAP_WIDTH / 2, y: LIMA_MAP_HEIGHT / 2 };
  const viewBox = `${Math.max(0, Math.min(LIMA_MAP_WIDTH - ancho, centroVista.x - ancho / 2)).toFixed(1)} ${Math.max(0, Math.min(LIMA_MAP_HEIGHT - alto, centroVista.y - alto / 2)).toFixed(1)} ${ancho.toFixed(1)} ${alto.toFixed(1)}`;

  const sinGeometria = !cartografia.cargando && !emparejadas.length;
  const readiness = !modelo.manzanas.length
    ? "vacio:sin-cuota"
    : cartografia.cargando && !emparejadas.length
      ? "false"
      : sinGeometria ? "vacio:sin-cartografia" : "monitoreo-territorial-avance-mapa";

  const abrir = (ump: string) => {
    setNivel(0);
    escribirFoco(ump, { panel: "ump" });
  };
  const encuadrar = () => {
    setNivel(0);
    if (foco) escribirFoco(null, { panel: null });
  };

  const claseDe = (estado: EstadoEnMapa, ump: string) => {
    if (capa === "ocurrencias" && estado !== "sin-usar") return sinParte.has(ump) ? "is-sin-parte" : "is-con-parte";
    return `is-${estado}`;
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
            <span>Ir a la UMP</span>
            <select value={ficha?.ump ?? ""} onChange={(event) => (event.currentTarget.value ? abrir(event.currentTarget.value) : encuadrar())}>
              <option value="">Todas</option>
              {modelo.manzanas.filter((manzana) => manzana.estado !== "sin-usar").map((manzana) => (
                <option key={manzana.ump} value={manzana.ump}>UMP {manzana.ump}</option>
              ))}
            </select>
          </label>
          <span className="mon-mapa-zoom">
            <button type="button" aria-label="Acercar" disabled={nivel >= ACERCAMIENTOS.length - 1} onClick={() => setNivel((valor) => Math.min(ACERCAMIENTOS.length - 1, valor + 1))}>
              <Plus size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Alejar" disabled={nivel === 0} onClick={() => setNivel((valor) => Math.max(0, valor - 1))}>
              <Minus size={15} aria-hidden="true" />
            </button>
            <button type="button" className="is-texto" onClick={encuadrar}>
              <Maximize2 size={14} aria-hidden="true" />
              Encuadrar campo
            </button>
          </span>
        </header>

        <div className="mon-mapa-lienzo">
          {sinGeometria ? (
            <p className="mon-mapa-vacio">
              {cartografia.incompleta
                ? "No se pudo cargar la cartografía de Hojas de ruta para estos distritos."
                : "Las manzanas de la ruta no tienen cartografía en Hojas de ruta."}
            </p>
          ) : (
            <svg
              className="mon-mapa-svg"
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={acercada
                ? `Entorno de la UMP ${ficha?.ump}: su manzana, las vecinas y las calles`
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
                <g className="mon-mapa-contexto" aria-hidden="true">
                  {contexto.map((feature) => <path key={feature.properties.ubigeo} d={territorialDistrictPath(feature, proyeccion)} />)}
                </g>
                <g className="mon-mapa-distritos">
                  {distritos.map((feature) => <path key={feature.properties.ubigeo} d={territorialDistrictPath(feature, proyeccion)} />)}
                </g>
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
                  return (
                    <circle
                      key={item.key}
                      cx={punto.x}
                      cy={punto.y}
                      r={manzana.estado === "sin-usar" ? 4 : 4.5}
                      className={`mon-mapa-punto ${claseDe(manzana.estado, manzana.ump)}`}
                      onClick={() => abrir(manzana.ump)}
                    >
                      <title>UMP {manzana.ump}, {ROTULO_DE_ESTADO[manzana.estado].toLowerCase()}</title>
                    </circle>
                  );
                })}
              </g>

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
            </svg>
          )}
        </div>

        <footer className="mon-mapa-pie">
          <span className="mon-mapa-leyenda">
            {capa === "ocurrencias" ? (
              <>
                <span className="is-con-parte">Con parte</span>
                <span className="is-sin-parte">Sin parte</span>
              </>
            ) : (
              (["completa", "subsanada", "pendiente", "sin-usar"] as const).map((estado) => (
                <span key={estado} className={`is-${estado}`}>{ROTULO_DE_ESTADO[estado]}</span>
              ))
            )}
          </span>
          <span className="mon-mapa-fuente">
            Fuentes: {enumerar(["distritos PlanMet", "manzanas INEI 2017", acercada?.calles.length ? "calles OpenStreetMap" : ""])}.
            {cartografia.incompleta ? " La cartografía está incompleta." : ""}
          </span>
        </footer>
      </div>

      <div className="mon-mapa-lateral" data-qa-geometry-member="lateral">
        {ficha ? (
          <FichaDeUmp
            ficha={ficha}
            onCerrar={encuadrar}
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

export const MapaTab = memo(MapaTabImpl);
