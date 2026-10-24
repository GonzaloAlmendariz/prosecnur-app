// Número de la tarjeta con rango declarado en la metadata: «−»/«+» que se deshabilitan en los límites, escritura que no
// admite lo que saca del rango y un valor guardado fuera de rango que se muestra ya ajustado (con nota) y se reescribe
// dentro de rango al primer cambio. Nunca entrega al plan un valor fuera de [min, max] ni no finito.

import { useEffect, useState } from "react";
import type { ArgMetadata } from "../../../api/graficos";
import { ajustarNumeroAcotado, borradorNumeroAcotado, limitesDeNumero } from "./modeloNumeroAcotado";

type Props = {
  id: string;
  rotulo: string;
  arg: ArgMetadata;
  valor: unknown;
  placeholder: string;
  describe?: string;
  onCambio: (v: number | null) => void;
};

export function tieneRango(arg: Pick<ArgMetadata, "min" | "max">): boolean {
  return Number.isFinite(arg.min) || Number.isFinite(arg.max);
}

export function NumeroAcotado({ id, rotulo, arg, valor, placeholder, describe, onCambio }: Props) {
  const l = limitesDeNumero(arg);
  const guardado = ajustarNumeroAcotado(valor, l);
  const [borrador, setBorrador] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const actual = guardado.valor;
  const paso = l.paso ?? 1;
  const idNota = `${id}-ajuste`;

  useEffect(() => { setBorrador(null); }, [valor]);

  const textoAjuste = (ajustado: number, antes: unknown) =>
    `Ajustado a ${ajustado}${typeof antes === "number" ? ` (estaba en ${antes})` : ""}. ${rotulo} va de ${l.min ?? "…"} a ${l.max ?? "…"}.`;

  const escribir = (crudo: unknown) => {
    const r = ajustarNumeroAcotado(crudo, l);
    setNota(r.ajustado && r.valor !== null ? textoAjuste(r.valor, crudo) : null);
    setBorrador(null);
    onCambio(r.valor);
  };
  const mover = (delta: number) => escribir((actual ?? (typeof arg.default === "number" ? arg.default : l.min ?? 0)) + delta);

  const sinGuardarAjustado = guardado.ajustado && actual !== null
    ? `Estaba en ${String(valor)}, fuera del rango; se muestra ${actual}. Se guarda al cambiarlo.`
    : null;
  const aviso = nota ?? sinGuardarAjustado;

  return (
    <>
      <div className="pulso-f6-numero-fila">
        <button type="button" className="pulso-f6-boton pulso-f6-numero-paso" aria-label={`Disminuir ${rotulo}`}
          disabled={actual !== null && l.min !== undefined && actual <= l.min} onClick={() => mover(-paso)}>−</button>
        <input id={id} type="text" inputMode={l.entero ? "numeric" : "decimal"} autoComplete="off"
          className="pulso-f6-input pulso-f6-dato-numero" aria-describedby={[describe, aviso ? idNota : undefined].filter(Boolean).join(" ") || undefined}
          value={borrador ?? (actual === null ? "" : String(actual))} placeholder={placeholder}
          onChange={(e) => {
            const texto = borradorNumeroAcotado(e.target.value, l);
            if (texto === "") { setNota(null); setBorrador(""); onCambio(null); return; }
            const n = Number(texto.replace(",", "."));
            if (!Number.isFinite(n)) return;
            // Bajo el mínimo (p. ej. el «1» de camino a «12») el campo espera; no pasa nada al plan hasta salir.
            if (l.min !== undefined && n < l.min) { setBorrador(texto); return; }
            escribir(texto);
          }}
          onBlur={() => { if (borrador !== null && borrador !== "") escribir(borrador); else setBorrador(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && borrador) escribir(borrador); }} />
        <button type="button" className="pulso-f6-boton pulso-f6-numero-paso" aria-label={`Aumentar ${rotulo}`}
          disabled={actual !== null && l.max !== undefined && actual >= l.max} onClick={() => mover(paso)}>+</button>
      </div>
      {aviso && <span id={idNota} className="pulso-f6-dato-ayuda pulso-f6-numero-aviso" role="status">{aviso}</span>}
    </>
  );
}
