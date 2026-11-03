import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";

import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import type { HojasRutaStreetMapFeature } from "../../../../../api/hojasRuta";
import { fmt, nombreDeDistrito } from "../rotulos";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { LIMA_DISTRICT_FEATURES, loadTerritorialRouteCartography } from "../TerritorialRouteCoverageAtlas";
import { construirCasosDelMapa, type EstadoDeCaso } from "./mapaDeCasosModelo";
import { construirMapaDeZonas } from "./mapaDeZonasModelo";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import type { AvancePorZona } from "./porZonaModelo";
import "./mapa.css";
import "./mapaDeCasos.css";

const ANCHO = 640;
const ALTO = 600;
const JERARQUIA: Record<string, "mayor" | "media" | "menor"> = {
  motorway: "mayor", motorway_link: "mayor", trunk: "mayor", trunk_link: "mayor", primary: "mayor", primary_link: "mayor",
  secondary: "media", secondary_link: "media",
  tertiary: "menor", tertiary_link: "menor",
};
const ROTULO: Record<EstadoDeCaso, string> = { cuenta: "Cuentan", observacion: "En observación", "no-cuenta": "Sin zona del envío" };

/** Las calles principales de las zonas, de la misma cartografía de Hojas de ruta. */
function useCallesDeZonas(ubigeos: readonly string[]) {
  const [calles, setCalles] = useState<HojasRutaStreetMapFeature[]>([]);
  const clave = ubigeos.join("|");
  useEffect(() => {
    let cancelado = false;
    Promise.allSettled(clave.split("|").filter(Boolean).map((u) => loadTerritorialRouteCartography(u, { includeRichLayers: true })))
      .then((res) => {
        if (cancelado) return;
        setCalles(res.flatMap((r) => (r.status === "fulfilled" ? r.value.streetMap?.geojson?.features ?? [] : [])));
      });
    return () => { cancelado = true; };
  }, [clave]);
  return calles;
}

/**
 * Avance › Mapa con un envío por cuotas (ADR 0125 A1). No hay manzanas
 * sorteadas: el mapa muestra los casos del corte sobre las zonas, con su
 * contorno real, las calles principales y los distritos vecinos. Barra arriba,
 * leyenda con interruptores abajo y el lateral con los conteos, como el Mapa
 * por UMP.
 */
export function MapaDeCasos({ cuotas, validacion }: { cuotas: AvancePorZona; validacion: MonitoreoTerritorialDashboard | null }) {
  const ubigeos = useMemo(() => cuotas.zonas.map((z) => z.idZona), [cuotas.zonas]);
  const mapa = useMemo(() => construirMapaDeZonas(LIMA_DISTRICT_FEATURES, ubigeos, ANCHO, ALTO, 0.04), [ubigeos]);
  const datos = useMemo(() => construirCasosDelMapa(validacion?.response_audit, ubigeos), [validacion, ubigeos]);
  const calles = useCallesDeZonas(ubigeos);
  const [ocultos, setOcultos] = useState<ReadonlySet<EstadoDeCaso>>(new Set());

  const trazos = useMemo(() => {
    if (!mapa) return null;
    const puntos: Record<EstadoDeCaso, string> = { cuenta: "", observacion: "", "no-cuenta": "" };
    for (const c of datos.casos) {
      const p = mapa.proyectar(c.lon, c.lat);
      if (p.x < 0 || p.y < 0 || p.x > ANCHO || p.y > ALTO) continue;
      puntos[c.estado] += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}h0`;
    }
    const vias = { mayor: "", media: "", menor: "" };
    for (const f of calles) {
      const nivel = JERARQUIA[String(f.properties?.highway ?? "")];
      if (!nivel || !f.geometry) continue;
      const lineas = (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][];
      for (const linea of lineas) {
        vias[nivel] += linea.map(([lon, lat], i) => {
          const p = mapa.proyectar(lon, lat);
          return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        }).join("");
      }
    }
    // Escala gráfica: cuántos píxeles mide un kilómetro de latitud en el encuadre.
    const a = mapa.proyectar(-77, -12);
    const b = mapa.proyectar(-77, -12 + 1 / 111.32);
    return { puntos, vias, km: Math.abs(a.y - b.y) };
  }, [mapa, datos.casos, calles]);

  const avancePorZona = new Map(cuotas.zonas.map((z) => [z.idZona, { ...z, nombre: nombreDeDistrito(z.nombre) }]));
  // Rótulos que se pisan: el de más abajo baja lo necesario para no montarse.
  const rotulos = useMemo(() => {
    const lista = (mapa?.zonas ?? []).map((z) => ({ clave: z.clave, x: z.rotulo.x, y: z.rotulo.y })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < lista.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (Math.abs(lista[i].x - lista[j].x) < 150 && lista[i].y - lista[j].y < 32) lista[i].y = lista[j].y + 32;
      }
    }
    return new Map(lista.map((r) => [r.clave, r]));
  }, [mapa]);
  const listo = mapa ? "monitoreo-territorial-avance-mapa-cuotas" : "vacio:sin-cartografia";
  const alternar = (estado: EstadoDeCaso) => setOcultos((previo) => {
    const siguiente = new Set(previo);
    if (siguiente.has(estado)) siguiente.delete(estado);
    else siguiente.add(estado);
    return siguiente;
  });
  const conGps = datos.casos.length;
  const enCorte = datos.total.cuentan + datos.total.noCuentan;
  const maxZona = Math.max(1, ...datos.porZona.map((z) => z.conGps));

  return (
    <section className="mon-mapa" aria-label="Mapa de casos por zona" data-audit-ready={listo} data-qa-geometry-group="territorial-mapa" data-qa-geometry-contract="intrinsic">
      <div className="mon-mapa-lienzo-panel" data-qa-geometry-member="mapa">
        <header className="mon-mapa-barra">
          <RotuloDePestana />
          <span className="mon-mapa-titulo">Casos geolocalizados</span>
          <span className="mon-mc-base">{fmt(conGps)} con GPS en {fmt(cuotas.zonas.length)} zonas</span>
        </header>
        <div className="mon-mapa-lienzo">
          {mapa && trazos ? (
            <svg className="mon-mc-svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Casos del corte sobre las ${cuotas.zonas.length} zonas del envío`}>
              <path className="mon-mc-vecinos" d={mapa.vecinos} />
              {mapa.zonas.map((z) => <path key={`f-${z.clave}`} className="mon-mc-zona" d={z.trazo} />)}
              <path className="mon-mc-via is-menor" d={trazos.vias.menor} />
              <path className="mon-mc-via is-media" d={trazos.vias.media} />
              <path className="mon-mc-via is-mayor" d={trazos.vias.mayor} />
              {mapa.zonas.map((z) => <path key={`b-${z.clave}`} className="mon-mc-borde" d={z.trazo} />)}
              {(["no-cuenta", "cuenta", "observacion"] as const).map((estado) => (ocultos.has(estado) ? null : (
                <g key={estado}>
                  <path className={`mon-mc-halo is-${estado}`} d={trazos.puntos[estado]} />
                  <path className={`mon-mc-punto is-${estado}`} d={trazos.puntos[estado]} />
                </g>
              )))}
              <g className="mon-mc-rotulos">
                {mapa.zonas.map((z) => {
                  const zona = avancePorZona.get(z.clave);
                  if (!zona) return null;
                  const avance = zona.meta > 0 ? Math.round((100 * zona.efectivas) / zona.meta) : 0;
                  const r = rotulos.get(z.clave) ?? { x: z.rotulo.x, y: z.rotulo.y };
                  return (
                    <g key={`r-${z.clave}`}>
                      <text x={r.x} y={r.y} className="is-nombre">{zona.nombre.toUpperCase()}</text>
                      <text x={r.x} y={r.y + 14} className="is-avance">{avance} % de la meta</text>
                    </g>
                  );
                })}
              </g>
              <g className="mon-mc-norte" transform="translate(28 28)">
                <path d="M0 -14 L7 6 L0 2 L-7 6 Z" />
                <text y={20}>N</text>
              </g>
              <g className="mon-mc-escala" transform={`translate(18 ${ALTO - 34})`}>
                <rect className="is-caja" x={0} y={0} width={trazos.km * 5 + 28} height={26} rx={6} />
                <rect className="is-lleno" x={8} y={7} width={trazos.km * 2.5} height={4} />
                <rect className="is-vacio" x={8 + trazos.km * 2.5} y={7} width={trazos.km * 2.5} height={4} />
                <text x={8} y={21}>0</text>
                <text x={8 + trazos.km * 5} y={21} className="is-fin">5 km</text>
              </g>
            </svg>
          ) : <EstadoVacio tamano="normal" icono={<MapPin size={18} />} titulo="Las zonas del envío no están en la cartografía de distritos." />}
        </div>
        <footer className="mon-mapa-pie">
          <span className="mon-mc-capas" role="group" aria-label="Mostrar u ocultar casos por estado">
            {(["cuenta", "observacion", "no-cuenta"] as const).map((estado) => (
              <button key={estado} type="button" aria-pressed={!ocultos.has(estado)} className={`mon-mc-capa is-${estado}`} onClick={() => alternar(estado)}>
                <i aria-hidden="true" />{ROTULO[estado]}<b>{fmt(datos.conGps[estado])}</b>
              </button>
            ))}
          </span>
          <span>Límites: IMP PlanMet 2040. Vías: OpenStreetMap.</span>
        </footer>
      </div>

      <div className="mon-mapa-lateral" data-qa-geometry-member="lateral">
        <aside className="mon-mapa-resumen" aria-label="Casos del corte">
          <dl className="mon-mapa-conteos" data-qa-geometry-group="territorial-mapa-conteos" data-qa-geometry-contract="equal">
            <div><dt>Cuentan</dt><dd>{fmt(datos.total.cuentan - datos.total.observacion)}</dd></div>
            <div className="is-pendiente"><dt>En observación</dt><dd>{fmt(datos.total.observacion)}</dd></div>
            <div><dt>No cuentan</dt><dd>{fmt(datos.total.noCuentan)}</dd></div>
          </dl>
          <div className="mon-mc-gps">
            <span className="mon-mc-linea"><span>Con GPS</span><span><b>{fmt(conGps)}</b> de {fmt(enCorte)} ({enCorte ? Math.round((100 * conGps) / enCorte) : 0} %)</span></span>
            <span className="mon-mc-barra" aria-hidden="true"><i style={{ flexGrow: conGps }} /><i className="is-sin" style={{ flexGrow: datos.sinGps.total }} /></span>
            {datos.sinGps.total ? (
              <p className="mon-mapa-base">
                Los {fmt(datos.sinGps.total)} casos sin GPS no se dibujan. De ellos, {fmt(datos.sinGps.observacion)} están en observación y {fmt(datos.sinGps.noCuenta)} no {datos.sinGps.noCuenta === 1 ? "cuenta" : "cuentan"}.
              </p>
            ) : null}
          </div>
          <h3 className="mon-mapa-subtitulo">Casos por zona</h3>
          <ul className="mon-mc-zonas">
            {datos.porZona.map((z) => {
              const zona = avancePorZona.get(z.ubigeo);
              return (
                <li key={z.ubigeo}>
                  <SiluetaDeDistrito distrito={zona?.nombre ?? z.ubigeo} lado={30} />
                  <span className="mon-mc-zona-texto">
                    <span>{zona?.nombre ?? z.ubigeo}</span>
                    <span className="mon-mc-barra" aria-hidden="true">
                      <i style={{ width: `${(100 * (z.conGps - z.enObservacion)) / maxZona}%` }} />
                      <i className="is-obs" style={{ width: `${(100 * z.enObservacion) / maxZona}%` }} />
                    </span>
                  </span>
                  <b title="Casos con GPS">{fmt(z.conGps)}</b>
                  <span className={z.enObservacion ? "is-obs" : ""} title="En observación con GPS">{fmt(z.enObservacion)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mon-mapa-base">En un envío por cuotas no hay manzanas sorteadas, por eso el mapa muestra casos y zonas en lugar de UMP.</p>
        </aside>
      </div>
    </section>
  );
}
