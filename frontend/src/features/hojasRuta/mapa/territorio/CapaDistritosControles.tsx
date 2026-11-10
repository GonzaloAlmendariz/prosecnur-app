import type { ReactNode } from "react";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { leyendaLienzo } from "../lienzo/flotantes";
import "./capaDistritos.css";
import { CAPAS_DISTRITOS, CAPAS_MANZANAS_DISTRITO, capaMarcada, NOMBRE_NSE, type CapaDistritos, type EscalaDistritos } from "./capaDistritos";

/** El valor de un distrito en la capa que se ve, para el rótulo del cursor: «13,995 habitantes por km²», «NSE predominante: medio». */
export function valorDeCapa(capa: CapaDistritos, t: HojasRutaTerritory, areaKm2: number | null): string {
  const por = (n: number, que: string) => (areaKm2 && areaKm2 > 0 ? `${formatoConteo(Math.round(n / areaKm2))} ${que} por km²` : "sin área");
  if (capa === "poblacion") return por(t.poblacion, "habitantes");
  if (capa === "viviendas") return por(t.viviendas, "viviendas");
  if (capa === "nse") {
    const n = t.nse_predominante;
    return typeof n === "number" && n >= 1 && n <= 5 ? `NSE predominante: ${NOMBRE_NSE[n].toLowerCase()}` : "NSE sin dato";
  }
  return `${formatoConteo(t.poblacion)} habitantes, ${formatoConteo(t.viviendas)} viviendas`;
}

/**
 * Selector de la capa de la ciudad abierta en el atlas (mismo control que el de manzanas). Dentro de un distrito ofrece
 * las capas de sus manzanas.
 */
export function SelectorCapaDistritos({ capa, onCapa, adentro = false }: { capa: CapaDistritos; onCapa: (c: CapaDistritos) => void; adentro?: boolean }) {
  const marcada = capaMarcada(capa, adentro);
  return (
    <div className="hr-lienzo-capas" role="group" aria-label={adentro ? "Capa de las manzanas" : "Capa de los distritos"}>
      {(adentro ? CAPAS_MANZANAS_DISTRITO : CAPAS_DISTRITOS).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={marcada === id} onClick={() => onCapa(id)}>{label}</button>
      ))}
    </div>
  );
}

/**
 * Leyenda de las manzanas de un distrito sin capa de color: la manzana y el límite del distrito. Antes quedaba la del
 * atlas («Con cartografía», «En el estudio»), que habla de ciudades.
 */
export function leyendaManzanasDistrito(): ReactNode {
  return (
    <>
      <span><i style={{ background: "var(--pulso-mapa-manzana)", border: "1px solid var(--pulso-mapa-manzana-borde)" }} />Manzana</span>
      <span><i style={{ background: "transparent", border: "2px solid var(--pulso-module-routes)" }} />Límite del distrito</span>
    </>
  );
}

// Las cinco clases toman los cinco escalones más oscuros de la rampa (el primero no llega a 2:1 contra el fondo
// del mapa). Nombres literales: el contrato de tokens no lee nombres armados.
export const RAMPA_DENSIDAD = ["--pulso-mapa-viv-2", "--pulso-mapa-viv-3", "--pulso-mapa-viv-4", "--pulso-mapa-viv-5", "--pulso-mapa-viv-6"] as const;

const cifra = (v: number) => formatoConteo(Math.round(v));

/** Rango de cada clase de densidad, como en las leyendas de la ONS: «menos de 4,120», «4,120 a 9,800», «22,000 o más». */
export function rangosDensidad(cortes: readonly number[]): string[] {
  if (!cortes.length) return [];
  return [`menos de ${cifra(cortes[0])}`, ...cortes.slice(1).map((c, i) => `${cifra(cortes[i])} a ${cifra(c)}`), `${cifra(cortes[cortes.length - 1])} o más`];
}

/** Un corte de la leyenda en corto: «950», «8.2 mil», «18 mil» (es-PE usa punto decimal). */
export function corteCorto(v: number): string {
  if (v < 1000) return formatoConteo(Math.round(v / 10) * 10);
  const miles = v / 1000;
  return `${(miles < 10 ? miles.toFixed(1) : Math.round(miles).toString()).replace(/\.0$/, "")} mil`;
}

/**
 * Leyenda de la coropleta en una línea, escalonada como las de la ONS: los cinco colores en fila y, entre ellos, el
 * corte que los separa. Con un rango por color no cabía en un renglón (revisión del 7 nov 2026). Los rangos completos
 * van en el texto accesible.
 */
export function leyendaCapaDistritos(escala: EscalaDistritos): ReactNode {
  if (escala.capa === "nse") return <><span>NSE predominante</span>{leyendaLienzo("territorio", { capa: "nse" })}</>;
  const titulo = escala.capa === "poblacion" ? "Habitantes por km²" : "Viviendas por km²";
  const rangos = rangosDensidad(escala.cortes);
  return (
    <>
      <span>{titulo}</span>
      <span className="hr-capa-escalones" role="img" aria-label={`${titulo}: ${rangos.join("; ")}`} title={rangos.join("\n")}>
        {RAMPA_DENSIDAD.slice(0, Math.max(1, escala.cortes.length + 1)).map((t, i) => (
          <span key={t}>
            <i style={{ background: `var(${t})` }} />
            {i < escala.cortes.length ? <small>{corteCorto(escala.cortes[i])}</small> : null}
          </span>
        ))}
      </span>
    </>
  );
}
