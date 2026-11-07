import type { ReactNode } from "react";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { leyendaLienzo } from "../lienzo/flotantes";
import "./capaDistritos.css";
import { FichaDistritoNacional } from "../nacional/FichaDistritoNacional";
import { CAPAS_DISTRITOS, NOMBRE_NSE, type CapaDistritos, type EscalaDistritos } from "./capaDistritos";

// Nombres literales: el contrato de tokens no lee nombres armados.
const NSE_TOKEN = ["--pulso-nse-0", "--pulso-nse-1", "--pulso-nse-2", "--pulso-nse-3", "--pulso-nse-4", "--pulso-nse-5"] as const;

/**
 * Ficha del distrito al que se hace clic con una ciudad abierta en el atlas. Antes ese clic caía en «fuera de
 * una ciudad» y devolvía al Perú (revisión del 7 nov 2026); ahora la ciudad sigue abierta y el distrito se lee.
 */
export function FichaDistritoAtlas({ territorio, ciudad, areaKm2, onCerrar }: { territorio: HojasRutaTerritory; ciudad: string; areaKm2: number | null; onCerrar: () => void }) {
  const nse = territorio.nse_predominante;
  const conNse = typeof nse === "number" && nse >= 1 && nse <= 5;
  const linea = conNse ? `NSE predominante: ${NOMBRE_NSE[nse].toLowerCase()}` : null;
  // La densidad que pinta la capa Población, con la misma área (la del contorno del distrito).
  const densidad = areaKm2 && areaKm2 > 0 ? `${formatoConteo(Math.round(territorio.poblacion / areaKm2))} habitantes por km²` : null;
  return <FichaDistritoNacional territorio={territorio} ciudad={ciudad} previa={densidad} linea={linea} marca={conNse ? `var(${NSE_TOKEN[nse]})` : undefined} onCerrar={onCerrar} />;
}

/** Selector de la capa de distritos de la ciudad abierta en el atlas (mismo control que el de manzanas). */
export function SelectorCapaDistritos({ capa, onCapa }: { capa: CapaDistritos; onCapa: (c: CapaDistritos) => void }) {
  return (
    <div className="hr-lienzo-capas" role="group" aria-label="Capa de los distritos">
      {CAPAS_DISTRITOS.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={capa === id} onClick={() => onCapa(id)}>{label}</button>
      ))}
    </div>
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
