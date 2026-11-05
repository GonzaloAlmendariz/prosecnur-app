import type { ReactNode } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";

/** Controles del panel de muestra, compartidos por el inspector de Muestra y «Ajustes del diseño». */
export const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
export const pct = (m: number | null, d = 1) => (m == null ? "—" : `±${(m * 100).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`);

export function Opciones<V extends string | number>({ etiqueta, valor, opciones, onCambio, deshabilitado }: { etiqueta: string; valor: V; opciones: ReadonlyArray<readonly [V, string]>; onCambio: (v: V) => void; deshabilitado?: boolean }) {
  return (
    <div className="hr-muestra-campo">
      <small>{etiqueta}</small>
      <GlidingRadioGroup value={valor} options={opciones} getOptionValue={(o) => o[0]} onValueChange={onCambio} className="hr-muestra-opciones" aria-label={etiqueta} getOptionProps={() => ({ disabled: deshabilitado })}>
        {(o) => <span>{o[1]}</span>}
      </GlidingRadioGroup>
    </div>
  );
}

export const DEFF_TIPICOS = [[1, "Sin ajuste"], [1.2, "Ligero"], [1.5, "Territorial"], [2, "Conservador"]] as const;

/** Atajos de margen (B33): valores usuales en un clic; el campo de arriba sigue aceptando cualquiera. */
export function Atajos({ valores, actual, etiqueta, onElegir, deshabilitado }: { valores: readonly number[]; actual: number; etiqueta: string; onElegir: (v: number) => void; deshabilitado?: boolean }) {
  return (
    <div className="hr-mapa-chips hr-muestra-atajos" role="group" aria-label={`Atajos de ${etiqueta.toLowerCase()}`}>
      {valores.map((v) => {
        const activo = Math.abs(actual * 100 - v) < 1e-6;
        return (
          <button key={v} type="button" className="hr-mapa-zona" aria-pressed={activo} data-estado={activo ? "todo" : undefined} disabled={deshabilitado} onClick={() => onElegir(v / 100)}>
            <span>±{v} %</span>
          </button>
        );
      })}
    </div>
  );
}

export function Numero({ etiqueta, valor, sufijo, min, max, paso, onCambio, ayuda, deshabilitado }: { etiqueta: string; valor: number; sufijo?: string; min?: number; max?: number; paso?: number; onCambio: (v: number) => void; ayuda?: ReactNode; deshabilitado?: boolean }) {
  return (
    <label className="hr-muestra-campo">
      <small>{etiqueta}</small>
      <span className="hr-muestra-numero">
        <input type="number" value={valor} min={min} max={max} step={paso} disabled={deshabilitado} onChange={(e) => e.target.value !== "" && Number.isFinite(Number(e.target.value)) && onCambio(Number(e.target.value))} />
        {sufijo ? <span>{sufijo}</span> : null}
      </span>
      {ayuda ? <span className="hr-mapa-nota">{ayuda}</span> : null}
    </label>
  );
}

