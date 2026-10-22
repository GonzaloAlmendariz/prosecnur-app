import { PulsoButton } from "../../../components/PulsoButton";
import { Pipette } from "../../../vendor/lucide-react";
import "./correosEstilo.css";

// Declaración mínima de la API EyeDropper (Chromium/Electron); TS aún no la trae.
type ResultadoDelCuentagotas = { sRGBHex: string };
type InstanciaDelCuentagotas = { open: (opciones?: { signal?: AbortSignal }) => Promise<ResultadoDelCuentagotas> };
export type ConstructorDelCuentagotas = new () => InstanciaDelCuentagotas;

/** El constructor del navegador, o `null` si no hay (Safari, Firefox, SSR). */
export function cuentagotasDisponible(ambito: unknown = typeof window === "undefined" ? undefined : window): ConstructorDelCuentagotas | null {
  if (typeof ambito !== "object" || ambito === null || !("EyeDropper" in ambito)) return null;
  const ctor = (ambito as { EyeDropper: unknown }).EyeDropper;
  return typeof ctor === "function" ? (ctor as ConstructorDelCuentagotas) : null;
}

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i;

/** `#rrggbb` en minúsculas; acepta `#rgb` y `rgb(...)` (versiones viejas de Chromium). `null` si no es un color. */
export function normalizarHex(color: string): string | null {
  const c = color.trim();
  const seis = c.match(HEX6);
  if (seis) return `#${seis[1].toLowerCase()}`;
  const tres = c.match(HEX3);
  if (tres) return `#${tres[1].split("").map((x) => x + x).join("").toLowerCase()}`;
  const rgb = c.match(RGB);
  if (rgb) {
    const partes = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (partes.some((n) => n > 255)) return null;
    return `#${partes.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

/** Abre el cuentagotas y entrega el color normalizado. Esc (AbortError) o un color ilegible no hacen nada. */
export async function tomarColor(Ctor: ConstructorDelCuentagotas, onChange: (color: string) => void): Promise<void> {
  let resultado: ResultadoDelCuentagotas;
  try {
    resultado = await new Ctor().open();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return;
    throw error;
  }
  const hex = normalizarHex(resultado.sRGBHex);
  if (hex) onChange(hex);
}

type Props = {
  /** Qué color se toma, para el nombre accesible: «el acento», «el fondo de la página». */
  nombre: string;
  /** El mismo onChange del selector de color de al lado. */
  onChange: (color: string) => void;
  disabled?: boolean;
};

/** Botón de ícono que toma un color de la pantalla. Sin EyeDropper no se muestra: no deja un botón muerto. */
export function Cuentagotas({ nombre, onChange, disabled }: Props) {
  const Ctor = cuentagotasDisponible();
  if (!Ctor) return null;
  return (
    <PulsoButton
      variant="icon"
      size="sm"
      className="rec-mail-cuentagotas"
      aria-label={`Tomar el color de la pantalla para ${nombre}`}
      title="Tomar el color de la pantalla"
      disabled={disabled}
      onClick={() => {
        void tomarColor(Ctor, onChange).catch(() => undefined);
      }}
    >
      <Pipette size={14} aria-hidden />
    </PulsoButton>
  );
}
