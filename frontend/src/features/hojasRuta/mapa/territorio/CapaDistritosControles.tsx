import type { ReactNode } from "react";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { leyendaLienzo } from "../lienzo/flotantes";
import { CAPAS_DISTRITOS, type CapaDistritos, type EscalaDistritos } from "./capaDistritos";

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

// Los mismos escalones que la capa de viviendas por manzana (nombres literales: el contrato de tokens no lee nombres armados).
const RAMPA = ["--pulso-mapa-viv-1", "--pulso-mapa-viv-2", "--pulso-mapa-viv-3", "--pulso-mapa-viv-4", "--pulso-mapa-viv-5", "--pulso-mapa-viv-6"];

export function leyendaCapaDistritos(escala: EscalaDistritos): ReactNode {
  if (escala.capa === "nse") return <><span>NSE predominante</span>{leyendaLienzo("territorio", { capa: "nse" })}</>;
  return (
    <>
      <span>{escala.capa === "poblacion" ? "Habitantes por distrito" : "Viviendas por distrito"}</span>
      <span className="hr-lienzo-rampa" aria-hidden="true">
        {RAMPA.map((t) => <i key={t} style={{ background: `var(${t})` }} />)}
      </span>
      <span>{formatoConteo(escala.min)} → {formatoConteo(escala.max)}</span>
    </>
  );
}
