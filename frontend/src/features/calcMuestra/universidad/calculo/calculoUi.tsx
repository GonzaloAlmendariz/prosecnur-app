/**
 * Utilitarios compartidos de la sección Cálculo: formateo de cifras para
 * KaTeX (misma convención es-PE que el resto del desk, con separador de miles
 * escapado como {,}), el campo numérico compacto de los supuestos/objetivos y
 * el contenedor SwapValor que funde bloques enteros cuando cambian sus cifras.
 */
import { fmtInt, safeNumber } from "../../sharedCore";
import { useValorSwap } from "../ui/useValorSwap";

/**
 * Contenedor con crossfade blur (.cmv2-uni-swap) disparado por una "firma":
 * cuando la cadena cambia, el bloque entero (ej. una FormulaLatex re-renderizada
 * por KaTeX) se funde en vez de swapear en seco. Pensado para cifras validadas
 * del motor — las exploraciones continuas (sliders) deben mantener la firma
 * estable para no animar por tick.
 */
export function SwapValor({
  firma,
  className,
  children,
}: {
  firma: string;
  className?: string;
  children: React.ReactNode;
}) {
  const cambiando = useValorSwap(firma);
  return (
    <div
      className={className ? `cmv2-uni-swap ${className}` : "cmv2-uni-swap"}
      data-cambiando={cambiando || undefined}
    >
      {children}
    </div>
  );
}

/** Entero formateado como fmtInt pero seguro dentro de una expresión KaTeX. */
export function ltxInt(value: number | null | undefined) {
  return fmtInt(value).replace(/,/g, "{,}").replace(/ /g, "\\,");
}

/** Decimal corto (sin ceros colgantes) para sustituciones numéricas en KaTeX. */
export function ltxNum(value: number | null | undefined, digits = 3) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Decimal corto para chips y textos (misma poda de ceros que ltxNum). */
export function fmtNum(value: number | null | undefined, digits = 3) {
  return ltxNum(value, digits);
}

/** Campo numérico etiquetado (reutiliza las clases cmv2-param/cmv2-number-cell). */
export function CampoNumero({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="cmv2-param">
      <span>{label}</span>
      <span className="cmv2-number-cell">
        <input
          type="number"
          min={min}
          step={step}
          value={value == null || !Number.isFinite(value) ? "" : value}
          onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0))}
        />
        {suffix && <span>{suffix}</span>}
      </span>
    </label>
  );
}
