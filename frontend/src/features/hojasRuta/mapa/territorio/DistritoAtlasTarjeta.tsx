import { ChevronLeft, ChevronRight, MapPinned } from "../../../../vendor/lucide-react";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { InspectorCabecera } from "../InspectorCabecera";
import { nombreDistrito } from "../nombres";
import { NOMBRE_NSE } from "./capaDistritos";
import "./atlas.css";

// Nombres literales: el contrato de tokens no lee nombres armados.
const NSE_TOKEN = ["--pulso-nse-0", "--pulso-nse-1", "--pulso-nse-2", "--pulso-nse-3", "--pulso-nse-4", "--pulso-nse-5"] as const;

export type DistritoAtlas = { territorio: HojasRutaTerritory; areaKm2: number | null; enEstudio: boolean };

/** Proporción de hogares de un distrito en cada nivel NSE (1 = Alto … 5 = Bajo); null sin NSE. */
export function repartoNse(t: HojasRutaTerritory): number[] | null {
  const r = [t.nse_pct_1, t.nse_pct_2, t.nse_pct_3, t.nse_pct_4, t.nse_pct_5].map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  return r.every((v) => v !== null) && (r as number[]).reduce((a, v) => a + v, 0) > 0 ? (r as number[]) : null;
}

// Un nivel con hogares pero bajo el medio punto se rotula «menos de 1 %»: «0 %» contradecía la astilla de la barra.
export const pct = (v: number) => (v > 0 && v < 0.005 ? "menos de 1 %" : `${Math.round(v * 100)} %`);

/**
 * Tarjeta del distrito elegido en el atlas, en el panel lateral (revisión del 7 nov 2026, H21: la ficha flotaba
 * sobre el mapa y lo tapaba). Dice sus cifras, su densidad y el reparto de sus hogares por NSE —el predominante solo
 * escondía la mezcla— y marca la vista siguiente: sus manzanas.
 */
export function DistritoAtlasTarjeta({ ciudad, distrito, adentro, cargandoManzanas, errorManzanas, manzanas, pintadasPor = null, onVerManzanas, onVolver }: {
  ciudad: string;
  distrito: DistritoAtlas;
  /** Si ya se ven sus manzanas (la vista más profunda). */
  adentro: boolean;
  cargandoManzanas: boolean;
  errorManzanas: string | null;
  manzanas: number | null;
  /** Con qué se pintan sus manzanas («viviendas», «NSE»); null si van sin color. */
  pintadasPor?: string | null;
  onVerManzanas: () => void;
  onVolver: () => void;
}) {
  const t = distrito.territorio;
  const reparto = repartoNse(t);
  const densidad = distrito.areaKm2 && distrito.areaKm2 > 0 ? Math.round(t.poblacion / distrito.areaKm2) : null;
  return (
    <>
      <InspectorCabecera icono={MapPinned} sobre={ciudad} titulo={nombreDistrito(t.distrito)} />
      <div className="hr-mapa-ins-cuerpo">
        <div className="hr-atlas-tarjeta">
          <dl className="hr-atlas-cifras">
            <div><dt>Habitantes</dt><dd>{formatoConteo(t.poblacion)}</dd></div>
            <div><dt>Viviendas</dt><dd>{formatoConteo(t.viviendas)}</dd></div>
            <div><dt>Manzanas</dt><dd>{formatoConteo(t.manzanas)}</dd></div>
          </dl>
          <p className="hr-atlas-nota">
            {densidad !== null ? `${formatoConteo(densidad)} habitantes por km²` : null}
            {distrito.enEstudio ? `${densidad !== null ? ", " : ""}en el estudio` : null}
          </p>
          {reparto ? (
            <div className="hr-atlas-nse">
              <p>Hogares por NSE</p>
              <div className="hr-atlas-nse-barra" role="img" aria-label={reparto.map((v, i) => `${NOMBRE_NSE[i + 1]} ${pct(v)}`).join(", ")}>
                {reparto.map((v, i) => (v > 0 ? <i key={i} style={{ flexGrow: v, background: `var(${NSE_TOKEN[i + 1]})` }} /> : null))}
              </div>
              <ul>
                {reparto.map((v, i) => (
                  <li key={i}>
                    <i style={{ background: `var(${NSE_TOKEN[i + 1]})` }} aria-hidden="true" />
                    {NOMBRE_NSE[i + 1]} <b>{pct(v)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="hr-atlas-acciones">
          {adentro ? (
            <p className="hr-atlas-nota" role="status">
              {cargandoManzanas ? "Cargando sus manzanas…" : errorManzanas ? errorManzanas : `Ves sus ${formatoConteo(manzanas ?? 0)} manzanas${pintadasPor ? `, pintadas por ${pintadasPor}` : ""}.`}
            </p>
          ) : (
            <PulsoButton variant="primary" onClick={onVerManzanas}>
              Ver sus manzanas <ChevronRight size={14} aria-hidden="true" />
            </PulsoButton>
          )}
          <PulsoButton variant="secondary" onClick={onVolver}>
            <ChevronLeft size={14} aria-hidden="true" /> Volver a {ciudad}
          </PulsoButton>
        </div>
      </div>
    </>
  );
}
