import type { ReactNode } from "react";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { leyendaLienzo } from "../lienzo/flotantes";
import { FichaDistritoNacional } from "../nacional/FichaDistritoNacional";
import { CAPAS_DISTRITOS, NOMBRE_NSE, type CapaDistritos, type EscalaDistritos } from "./capaDistritos";

// Nombres literales: el contrato de tokens no lee nombres armados.
const NSE_TOKEN = ["--pulso-nse-0", "--pulso-nse-1", "--pulso-nse-2", "--pulso-nse-3", "--pulso-nse-4", "--pulso-nse-5"] as const;

/**
 * Ficha del distrito al que se hace clic con una ciudad abierta en el atlas. Antes ese clic caía en «fuera de
 * una ciudad» y devolvía al Perú (revisión del 7 nov 2026); ahora la ciudad sigue abierta y el distrito se lee.
 */
export function FichaDistritoAtlas({ territorio, ciudad, onCerrar }: { territorio: HojasRutaTerritory; ciudad: string; onCerrar: () => void }) {
  const nse = territorio.nse_predominante;
  const conNse = typeof nse === "number" && nse >= 1 && nse <= 5;
  const linea = conNse ? `NSE predominante: ${NOMBRE_NSE[nse].toLowerCase()}` : null;
  return <FichaDistritoNacional territorio={territorio} ciudad={ciudad} linea={linea} marca={conNse ? `var(${NSE_TOKEN[nse]})` : undefined} onCerrar={onCerrar} />;
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

export function leyendaCapaDistritos(escala: EscalaDistritos): ReactNode {
  if (escala.capa === "nse") return <><span>NSE predominante</span>{leyendaLienzo("territorio", { capa: "nse" })}</>;
  const rangos = rangosDensidad(escala.cortes);
  return (
    <>
      <span>{escala.capa === "poblacion" ? "Habitantes por km²" : "Viviendas por km²"}</span>
      {rangos.map((r, i) => (
        <span key={RAMPA_DENSIDAD[i]}><i style={{ background: `var(${RAMPA_DENSIDAD[i]})` }} />{r}</span>
      ))}
    </>
  );
}
