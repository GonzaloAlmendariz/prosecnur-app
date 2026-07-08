/**
 * Sliders exploratorios del paso 3: confianza, p, e, deff y sobremuestra.
 *
 * Este módulo es deliberadamente "tonto": expone el estado de la perilla
 * (usePerillaParametros) y el bloque de sliders (ParametrosSliders). Quién
 * calcula es la pestaña Parámetros (universidad/calculo/CalculoParametrosTab):
 * ahí vive el ÚNICO useMemoriaCalculo que alimenta fórmulas encadenadas y
 * memoria de cálculo. "Aplicar al estudio" lleva los parámetros explorados al
 * componente real y recalcula.
 */
import { useMemo, useState } from "react";
import { RotateCcw, Wand2 } from "lucide-react";
import type { CalcMuestraParametros } from "../../../api/client";
import { zFromConfidence } from "./motorPreview";

const CONFIANZAS = [0.9, 0.95, 0.99] as const;

function confianzaDesdeZ(z: number): number {
  if (Math.abs(z - zFromConfidence(0.9)) < 0.01) return 0.9;
  if (Math.abs(z - zFromConfidence(0.99)) < 0.01) return 0.99;
  return 0.95;
}

export type PerillaParametros = {
  confianza: number;
  p: number;
  e: number;
  deff: number;
  oversample: number;
};

/**
 * Estado de la perilla exploratoria: parte de los parámetros aplicados del
 * estudio y recuerda si el usuario ya la tocó (mientras no la toque, sigue a
 * los parámetros reales).
 */
export function usePerillaParametros(parametros: CalcMuestraParametros) {
  const inicial = useMemo<PerillaParametros>(
    () => ({
      confianza: confianzaDesdeZ(parametros.z),
      p: parametros.p,
      e: parametros.e,
      deff: parametros.deff,
      oversample: parametros.oversample_pct,
    }),
    [parametros.z, parametros.p, parametros.e, parametros.deff, parametros.oversample_pct],
  );
  const [perilla, setPerilla] = useState<PerillaParametros>(inicial);
  const [tocado, setTocado] = useState(false);
  const activa = tocado ? perilla : inicial;

  const set = (patch: Partial<PerillaParametros>) => {
    setTocado(true);
    setPerilla((prev) => ({ ...(tocado ? prev : inicial), ...patch }));
  };

  const reset = () => {
    setTocado(false);
    setPerilla(inicial);
  };

  return { activa, tocado, set, reset };
}

/** Bloque de sliders + acciones del explorador (Aplicar / Volver a lo aplicado). */
export function ParametrosSliders({
  activa,
  tocado,
  onSet,
  onReset,
  onAplicar,
  calculando,
}: {
  activa: PerillaParametros;
  tocado: boolean;
  onSet: (patch: Partial<PerillaParametros>) => void;
  onReset: () => void;
  onAplicar?: (patch: Partial<CalcMuestraParametros>) => void;
  calculando?: boolean;
}) {
  return (
    <div className="cmv2-did-sliders">
      <div className="cmv2-did-slider">
        <div className="cmv2-did-slider-head">
          <span>Nivel de confianza</span>
          <output>{Math.round(activa.confianza * 100)}%</output>
        </div>
        <div className="cmv2-did-segment" role="group" aria-label="Nivel de confianza">
          {CONFIANZAS.map((c) => (
            <button
              key={c}
              type="button"
              data-active={Math.abs(activa.confianza - c) < 0.001}
              onClick={() => onSet({ confianza: c })}
            >
              {Math.round(c * 100)}%
            </button>
          ))}
        </div>
      </div>
      <label className="cmv2-did-slider">
        <div className="cmv2-did-slider-head">
          <span>Proporción esperada (p)</span>
          <output>{activa.p.toLocaleString("es-PE", { maximumFractionDigits: 2 })}</output>
        </div>
        <input
          type="range"
          min={0.1}
          max={0.9}
          step={0.05}
          value={activa.p}
          onChange={(ev) => onSet({ p: Number(ev.target.value) })}
        />
      </label>
      <label className="cmv2-did-slider">
        <div className="cmv2-did-slider-head">
          <span>Margen de error (e)</span>
          <output>±{(activa.e * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })}%</output>
        </div>
        <input
          type="range"
          min={0.01}
          max={0.1}
          step={0.005}
          value={activa.e}
          onChange={(ev) => onSet({ e: Number(ev.target.value) })}
        />
      </label>
      <label className="cmv2-did-slider">
        <div className="cmv2-did-slider-head">
          <span>Efecto de diseño (deff)</span>
          <output>{activa.deff.toLocaleString("es-PE", { maximumFractionDigits: 2 })}</output>
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={activa.deff}
          onChange={(ev) => onSet({ deff: Number(ev.target.value) })}
        />
      </label>
      <label className="cmv2-did-slider">
        <div className="cmv2-did-slider-head">
          <span>Sobremuestra</span>
          <output>{Math.round(activa.oversample * 100)}%</output>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={activa.oversample}
          onChange={(ev) => onSet({ oversample: Number(ev.target.value) })}
        />
      </label>
      {onAplicar && (
        <div className="cmv2-inline-actions">
          <button
            type="button"
            className="cmv2-primary"
            disabled={!tocado || Boolean(calculando)}
            onClick={() =>
              onAplicar({
                z: zFromConfidence(activa.confianza),
                p: activa.p,
                e: activa.e,
                deff: activa.deff,
                oversample_pct: activa.oversample,
              })
            }
          >
            <Wand2 size={13} aria-hidden="true" /> Aplicar al estudio
          </button>
          <button type="button" className="cmv2-ghost" disabled={!tocado} onClick={onReset}>
            <RotateCcw size={13} aria-hidden="true" /> Volver a lo aplicado
          </button>
        </div>
      )}
    </div>
  );
}
