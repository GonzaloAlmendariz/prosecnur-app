// El «?» junto a un ajuste de la tarjeta del gráfico. Antes era sólo un `title` nativo, que tarda en salir y en la app
// de escritorio a veces ni aparece («los signos de interrogación no están funcionando»). Ahora es un botón y el globo
// se abre SÓLO con clic (Gonzalo: «debe ser sólo al click»); se cierra con otro clic, con Escape o al hacer clic fuera.

import { useId, useState } from "react";
import { HelpCircle } from "../../../vendor/lucide-react";

export function AyudaGlobo({ rotulo, detalle }: { rotulo: string; detalle: string }) {
  const id = useId();
  const [fijo, setFijo] = useState(false);
  if (!detalle) return null;
  return (
    <span className={fijo ? "pulso-f6-ayuda is-abierta" : "pulso-f6-ayuda"}>
      <button
        type="button"
        className="pulso-f6-ayuda-boton"
        aria-label={`Qué es «${rotulo}»`}
        aria-describedby={id}
        aria-expanded={fijo}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFijo((v) => !v); }}
        onBlur={() => setFijo(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setFijo(false); }}
      >
        <HelpCircle size={13} aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className="pulso-f6-ayuda-globo">{detalle}</span>
    </span>
  );
}
