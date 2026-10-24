import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import type { CasoDeUmpConGps } from "../../../../../api/monitoreoCasosUmp";
import { celdaEnFrase, diaYMes, fmt } from "../rotulos";
import {
  LIMA_MAP_HEIGHT,
  LIMA_MAP_WIDTH,
  buildTerritorialMapProjection,
  selectTerritorialMapFeatures,
  territorialFeaturePath,
  territorialStreetPath,
} from "../TerritorialRouteCoverageAtlas";
import { FichaDeUmp } from "./FichaDeUmp";
import { HistoriaUmp } from "./HistoriaUmp";
import type { FichaDeUmp as Ficha } from "./fichaUmpModel";
import type { HistoriaDeUmp } from "./historiaUmpModel";
import {
  ROTULO_DE_ESTADO_DE_CASO,
  aplicadoresEnOrden,
  casosDeLaVista,
  claseDelPunto,
  esReemplazo,
  jornadas,
  recorridos,
  separarEnEspiral,
  textoDeDistancia,
  tiempoDesdeElAnterior,
  vistasDisponibles,
  type CapaDeExploracion,
  type VistaDeManzana,
} from "./exploracionModel";
import { callesCercanas, centroDeManzana, construirMapa, manzanasVecinas } from "./mapaModel";
import { rotuloDeMotivo } from "./resumenModel";
import { useCartografiaDelMapa } from "./useCartografiaDelMapa";
import { useCasosDeUmp } from "./useCasosDeUmp";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./exploracion.css";

const ROTULO_DE_VISTA: Record<VistaDeManzana, string> = { titular: "Titular", reemplazo: "Reemplazo", ambas: "Ambas" };
const ROTULO_DE_CAPA: Record<CapaDeExploracion, string> = { recorrido: "Recorrido", estado: "Estado", cuota: "Cuota" };

/**
 * Exploración de una UMP (territorial.md §3.16b): el mapa de su entorno con un
 * punto por formulario en su GPS de Kobo, numerado por orden e incluidos los
 * anulados; la tarjeta del caso elegido y los casos de la jornada; y la
 * historia de la UMP. Elegir un capítulo, un punto, una fila o una marca
 * selecciona el mismo caso en los tres lugares.
 */
export function ExploracionUmp({
  ficha,
  historia,
  avance,
  version,
  onCerrar,
  onSugerencia,
}: {
  ficha: Ficha;
  historia: HistoriaDeUmp | null;
  avance: MonitoreoTerritorialDashboard | null;
  version: string;
  onCerrar: () => void;
  onSugerencia: () => void;
}) {
  const estado = useCasosDeUmp(ficha.ump, version);
  const casos = useMemo(() => (estado.tipo === "listo" ? estado.datos.casos : []), [estado]);
  const vistas = useMemo(() => vistasDisponibles(casos), [casos]);
  const [vistaPedida, setVista] = useState<VistaDeManzana | null>(null);
  const vista = vistaPedida && vistas.includes(vistaPedida) ? vistaPedida : vistas.at(-1) ?? "titular";
  const [capa, setCapa] = useState<CapaDeExploracion>("estado");
  const [elegidoPedido, setElegido] = useState<string | null>(null);
  const deLaVista = useMemo(() => casosDeLaVista(casos, vista), [casos, vista]);
  const elegido = casos.find((caso) => caso.id === elegidoPedido) ?? deLaVista[0] ?? null;
  const aplicadores = useMemo(() => aplicadoresEnOrden(casos), [casos]);
  const dias = useMemo(() => jornadas(casos), [casos]);

  // Las manzanas de la UMP (en uso y la que ya no usa) y su cartografía.
  const mapa = useMemo(() => construirMapa(avance), [avance]);
  const manzanas = useMemo(() => mapa.manzanas.filter((manzana) => manzana.ump === ficha.ump), [ficha.ump, mapa.manzanas]);
  const ubigeo = manzanas[0]?.ubigeo ?? null;
  const cartografia = useCartografiaDelMapa(ubigeo ? [ubigeo] : [], ubigeo);
  const rica = ubigeo ? cartografia.rica[ubigeo] ?? cartografia.base[ubigeo] : undefined;
  const geometria = useMemo(() => {
    const features = rica?.blockMap?.geojson?.features ?? [];
    const emparejadas = selectTerritorialMapFeatures(features, manzanas.map((manzana) => manzana.bloque));
    const enVista = emparejadas.filter((item) => {
      const reemplazo = item.block.tipo_manzana.toLowerCase() === "reemplazo";
      return vista === "ambas" || (vista === "reemplazo" ? reemplazo : !reemplazo);
    });
    const centros = enVista.map((item) => centroDeManzana(item.feature)).filter((centro): centro is NonNullable<typeof centro> => centro != null);
    const vecinas = centros.flatMap((centro) => manzanasVecinas(features, centro, 200));
    const calles = centros.flatMap((centro) => callesCercanas(rica?.streetMap?.geojson?.features ?? [], centro, 320));
    return { emparejadas, enVista, vecinas, calles };
  }, [manzanas, rica, vista]);

  const proyeccion = useMemo(() => buildTerritorialMapProjection(
    [],
    [...geometria.enVista.map((item) => item.feature), ...geometria.vecinas],
    [],
    30,
    deLaVista.filter((caso) => caso.lat != null && caso.lon != null).map((caso) => ({ lon: caso.lon as number, lat: caso.lat as number })),
  ), [deLaVista, geometria]);

  const puntos = useMemo(() => {
    const conGps = deLaVista.filter((caso) => caso.lat != null && caso.lon != null);
    const proyectados = conGps.map((caso) => ({ id: caso.id, ...proyeccion.project(caso.lon as number, caso.lat as number) }));
    const separados = new Map(separarEnEspiral(proyectados).map((punto) => [punto.id, punto]));
    return conGps.map((caso) => ({ caso, punto: separados.get(caso.id)! }));
  }, [deLaVista, proyeccion]);

  const elegirCaso = (id: string) => {
    const caso = casos.find((item) => item.id === id);
    if (caso && vista !== "ambas" && esReemplazo(caso) !== (vista === "reemplazo")) setVista(esReemplazo(caso) ? "reemplazo" : "titular");
    setElegido(id);
  };

  const readiness = estado.tipo === "listo"
    ? "monitoreo-territorial-avance-umps-exploracion"
    : estado.tipo === "error" ? "vacio:sin-casos-de-ump" : "false";
  const delDia = elegido ? casos.filter((caso) => caso.fechaIso === elegido.fechaIso) : [];

  return (
    <div className="mon-exp" data-audit-ready={readiness} data-qa-geometry-group="territorial-exploracion" data-qa-geometry-contract="intrinsic">
      <div className="mon-exp-principal" data-qa-geometry-member="principal">
        <section className="mon-exp-panel mon-exp-mapa-panel" aria-labelledby="mon-exp-titulo">
          <header className="mon-exp-barra">
            <RotuloDePestana />
            <button type="button" className="mon-exp-volver" onClick={onCerrar}>
              <ArrowLeft size={14} aria-hidden="true" />
              Todas las UMP
            </button>
            <h3 id="mon-exp-titulo">UMP {ficha.ump}, formulario por formulario</h3>
            {vistas.length > 1 ? (
              <span className="mon-exp-segmentado" role="group" aria-label="Qué manzana ver">
                {vistas.map((clave) => (
                  <button key={clave} type="button" aria-pressed={vista === clave} className={vista === clave ? "is-active" : ""} onClick={() => setVista(clave)}>
                    {ROTULO_DE_VISTA[clave]}
                  </button>
                ))}
              </span>
            ) : null}
            <span className="mon-exp-segmentado" role="group" aria-label="Capa de los puntos">
              {(["recorrido", "estado", "cuota"] as const).map((clave) => (
                <button key={clave} type="button" aria-pressed={capa === clave} className={capa === clave ? "is-active" : ""} onClick={() => setCapa(clave)}>
                  {ROTULO_DE_CAPA[clave]}
                </button>
              ))}
            </span>
          </header>
          <div className="mon-exp-lienzo">
            {estado.tipo === "error" ? (
              <p className="mon-exp-vacio">No se pudieron traer los casos de la UMP: {estado.mensaje}</p>
            ) : estado.tipo !== "listo" ? (
              <p className="mon-exp-vacio">Trayendo los formularios de la UMP con su GPS…</p>
            ) : (
              <svg
                className="mon-exp-svg"
                viewBox={`0 0 ${LIMA_MAP_WIDTH} ${LIMA_MAP_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={`UMP ${ficha.ump}: ${fmt(puntos.length)} formularios con GPS en la vista ${ROTULO_DE_VISTA[vista].toLowerCase()}`}
              >
                <g className="mon-exp-calles">
                  {geometria.calles.map((calle, indice) => {
                    const d = territorialStreetPath(calle, proyeccion);
                    return d ? <path key={`${calle.properties.id ?? indice}-${indice}`} d={d} /> : null;
                  })}
                </g>
                <g className="mon-exp-vecinas">
                  {geometria.vecinas.map((feature, indice) => {
                    const d = territorialFeaturePath(feature, proyeccion);
                    return d ? <path key={`${feature.properties.ID_MANZANA ?? indice}-${indice}`} d={d} /> : null;
                  })}
                </g>
                <g className="mon-exp-propias">
                  {geometria.enVista.map((item) => {
                    const d = territorialFeaturePath(item.feature, proyeccion);
                    return d ? (
                      <path key={item.key} d={d} className={item.block.tipo_manzana.toLowerCase() === "reemplazo" ? "is-reemplazo" : "is-titular"}>
                        <title>Manzana {item.block.tipo_manzana.toLowerCase()} {item.block.manzana}</title>
                      </path>
                    ) : null;
                  })}
                </g>
                {capa === "recorrido" ? (
                  <g className="mon-exp-recorridos">
                    {recorridos(deLaVista).map((recorrido) => {
                      const d = recorrido.casos
                        .map((caso, paso) => {
                          const punto = puntos.find((item) => item.caso.id === caso.id)?.punto;
                          return punto ? `${paso ? "L" : "M"}${punto.x.toFixed(1)},${punto.y.toFixed(1)}` : "";
                        })
                        .join(" ");
                      return d ? <path key={recorrido.aplicador} d={d} className={`is-aplicador-${aplicadores.indexOf(recorrido.aplicador) % 4}`} /> : null;
                    })}
                  </g>
                ) : null}
                <g className="mon-exp-puntos">
                  {puntos.map(({ caso, punto }) => (
                    <g
                      key={caso.id}
                      className={`mon-exp-punto ${claseDelPunto(caso, capa, aplicadores.indexOf(caso.aplicador || "Sin aplicador"))}${elegido?.id === caso.id ? " is-elegido" : ""}`}
                      onClick={() => elegirCaso(caso.id)}
                    >
                      <circle cx={punto.x} cy={punto.y} r={elegido?.id === caso.id ? 11 : 9} />
                      <text x={punto.x} y={punto.y + 3.5} textAnchor="middle">{caso.orden}</text>
                      <title>Caso {caso.orden}: {ROTULO_DE_ESTADO_DE_CASO[caso.estado]}</title>
                    </g>
                  ))}
                </g>
              </svg>
            )}
          </div>
          <footer className="mon-exp-pie">
            <Leyenda capa={capa} aplicadores={aplicadores} />
            <span>
              Manzanas INEI 2017{geometria.calles.length ? " · calles OpenStreetMap" : ""} · GPS de Kobo
              {estado.tipo === "listo" && estado.datos.resumen.total > estado.datos.resumen.conGps
                ? ` · ${fmt(estado.datos.resumen.total - estado.datos.resumen.conGps)} sin GPS`
                : ""}
            </span>
          </footer>
        </section>

        {historia ? (
          <HistoriaUmp
            historia={historia}
            jornadas={estado.tipo === "listo" ? dias : null}
            casoElegido={elegido?.id ?? null}
            onElegirCaso={elegirCaso}
            onElegirCapitulo={(capitulo) => {
              const primero = capitulo.formularios.map((item) => casos.find((caso) => caso.id === item.id)).find((caso): caso is CasoDeUmpConGps => caso != null);
              if (primero) {
                if (vista !== "ambas") setVista(esReemplazo(primero) ? "reemplazo" : "titular");
                setElegido(primero.id);
              }
            }}
          />
        ) : null}
      </div>

      <div className="mon-exp-lateral" data-qa-geometry-member="lateral">
        {elegido ? <TarjetaDeCaso caso={elegido} casos={casos} /> : null}
        <FichaDeUmp ficha={ficha} onCerrar={onCerrar} onSugerencia={onSugerencia} />
        {delDia.length ? (
          <section className="mon-exp-panel" aria-labelledby="mon-exp-jornada">
            <h4 id="mon-exp-jornada" className="mon-ump-subtitulo">Casos del {diaYMes(elegido?.fechaIso)}</h4>
            <ol className="mon-exp-lista" data-qa-geometry-capacity="owned">
              {delDia.map((caso) => (
                <li key={caso.id}>
                  <button type="button" aria-pressed={elegido?.id === caso.id} className={`is-${caso.estado}`} onClick={() => elegirCaso(caso.id)}>
                    <b>{caso.orden}</b>
                    <span>{caso.hora.slice(0, 5) || "Sin hora"}</span>
                    <span>{ROTULO_DE_ESTADO_DE_CASO[caso.estado]}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Leyenda({ capa, aplicadores }: { capa: CapaDeExploracion; aplicadores: readonly string[] }) {
  const items: Array<[string, string]> = capa === "recorrido"
    ? aplicadores.slice(0, 4).map((aplicador, indice) => [`is-aplicador-${indice}`, aplicador])
    : capa === "cuota"
      ? [["is-mujer", "Mujer"], ["is-hombre", "Hombre"], ["is-sin-dato", "Sin dato"]]
      : [["is-cuenta", "Cuenta"], ["is-gps-fuera", "GPS fuera de su manzana"], ["is-anulado-efectiva", "Anulado, había aceptado"], ["is-anulado-sin", "Anulado, sin consentimiento"], ["is-no-cuenta", "No cuenta"]];
  return (
    <span className="mon-exp-leyenda">
      {items.map(([clase, rotulo]) => <span key={clase} className={clase}>{rotulo}</span>)}
    </span>
  );
}

function TarjetaDeCaso({ caso, casos }: { caso: CasoDeUmpConGps; casos: readonly CasoDeUmpConGps[] }) {
  const celda = [caso.sexo ? celdaEnFrase(caso.sexo) : "", caso.edad != null ? `${fmt(caso.edad)} años` : ""].filter(Boolean).join(", ");
  return (
    <section className="mon-exp-panel mon-exp-caso" aria-labelledby="mon-exp-caso-titulo">
      <header>
        <h4 id="mon-exp-caso-titulo">Caso {caso.orden}</h4>
        <span className={`mon-exp-estado is-${caso.estado}`}>{ROTULO_DE_ESTADO_DE_CASO[caso.estado]}</span>
      </header>
      <dl>
        <div><dt>Cuándo</dt><dd>{diaYMes(caso.fechaIso) || "Sin fecha"}{caso.hora ? `, ${caso.hora.slice(0, 5)}` : ""}</dd></div>
        <div><dt>Aplicador</dt><dd>{caso.aplicador || "Sin aplicador"}</dd></div>
        <div><dt>Ritmo</dt><dd>{tiempoDesdeElAnterior(caso, casos)}</dd></div>
        <div><dt>Celda</dt><dd>{celda || "Sin dato"}</dd></div>
        <div><dt>GPS</dt><dd>{textoDeDistancia(caso.distanciaM)}</dd></div>
        {caso.duracionSegundos != null ? <div><dt>Duración</dt><dd>{fmt(Math.round(caso.duracionSegundos / 60))} min</dd></div> : null}
      </dl>
      {caso.motivos.length ? (
        <p className="mon-ump-base">En observación por {caso.motivos.map((motivo) => rotuloDeMotivo(motivo).toLowerCase()).join(" y ")}.</p>
      ) : null}
    </section>
  );
}
