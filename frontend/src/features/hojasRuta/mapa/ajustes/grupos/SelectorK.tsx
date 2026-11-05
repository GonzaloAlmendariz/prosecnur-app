import { useState } from "react";

import { divisoresEntre } from "./tamanoN";

/**
 * Encuestas por ruta (k) entre los divisores de N de 4 a 12 (maqueta aprobada): cada botón deja rutas
 * completas. «Otro» abre un campo para cualquier k; si el k vigente no es divisor, aparece igual marcado.
 */
export function SelectorK({ n, k, deshabilitado, onCambio }: { n: number; k: number; deshabilitado?: boolean; onCambio: (k: number) => void }) {
  const divisores = divisoresEntre(n);
  const opciones = divisores.includes(k) ? divisores : [...divisores, k].sort((a, b) => a - b);
  const [otro, setOtro] = useState(false);
  const [texto, setTexto] = useState("");
  const aplicarOtro = () => {
    const v = Number(texto.trim());
    if (Number.isInteger(v) && v >= 1 && v <= 50) onCambio(v);
    setOtro(false);
    setTexto("");
  };
  return (
    <div className="hr-muestra-campo">
      <small>Encuestas por ruta (k)</small>
      <div className="hr-mapa-chips hr-selector-k" role="group" aria-label="Encuestas por ruta">
        {opciones.map((v) => (
          <button key={v} type="button" className="hr-mapa-zona" aria-pressed={v === k} data-estado={v === k ? "todo" : undefined} disabled={deshabilitado} onClick={() => onCambio(v)}>
            <span>{v}</span>
          </button>
        ))}
        {otro ? (
          <input className="hr-selector-k-otro" type="text" inputMode="numeric" aria-label="Otro número de encuestas por ruta" value={texto} autoFocus onChange={(e) => setTexto(e.target.value)} onBlur={aplicarOtro} onKeyDown={(e) => e.key === "Enter" && aplicarOtro()} />
        ) : (
          <button type="button" className="hr-mapa-zona" disabled={deshabilitado} onClick={() => setOtro(true)}><span>Otro</span></button>
        )}
      </div>
    </div>
  );
}
