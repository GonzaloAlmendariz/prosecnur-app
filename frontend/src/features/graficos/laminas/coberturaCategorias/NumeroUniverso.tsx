// Un número del universo (una categoría o el total). Guarda un borrador mientras se teclea ("12." de camino a "12.5")
// y escribe al plan cada valor que ya es un número; vacío escribe `null`. Al salir del campo vuelve a lo guardado.

import { useEffect, useState } from "react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { numeroUniverso } from "./modeloUniversoCategorias";

type Props = {
  id?: string;
  valor: number | null;
  ariaLabel: string;
  placeholder?: string;
  onCambio: (v: number | null) => void;
};

export function NumeroUniverso({ id, valor, ariaLabel, placeholder, onCambio }: Props) {
  const [borrador, setBorrador] = useState<string | null>(null);
  useEffect(() => {
    setBorrador((b) => (b !== null && numeroUniverso(b) === valor ? b : null));
  }, [valor]);
  return (
    <PulsoInput id={id} size="sm" numeric inputMode="decimal" autoComplete="off" aria-label={ariaLabel}
      value={borrador ?? (valor === null ? "" : String(valor))} placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value;
        setBorrador(t);
        if (t.trim() === "") { onCambio(null); return; }
        const n = numeroUniverso(t);
        if (n !== null) onCambio(n);
      }}
      onBlur={() => setBorrador(null)} />
  );
}
