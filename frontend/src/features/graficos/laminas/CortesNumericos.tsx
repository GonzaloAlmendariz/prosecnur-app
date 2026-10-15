// Cortes numéricos de la tarjeta (las clases del mapa por distrito, el semáforo): antes un texto «55, 65, 75» separado
// por comas (pasada final 2026-10-15: «no le pidas al analista escribir en comas»). Ahora un campo por corte, con el
// valor por defecto de cada uno a la vista. Emite la misma lista de textos que el campo anterior; vacíos, el motor usa
// sus cortes por defecto.

import type { ReactNode } from "react";
import { codigosATexto, textoACodigos } from "./argsDatosGrafico";

type Props = { id: string; etiqueta: ReactNode; nota: ReactNode; describe?: string; defectos: readonly string[]; valor: unknown; onCambio: (v: string[]) => void };

export function CortesNumericos({ id, etiqueta, nota, describe, defectos, valor, onCambio }: Props) {
  const actuales = textoACodigos(codigosATexto(valor));
  const celdas = defectos.map((_, i) => actuales[i] ?? "");
  const cambiar = (i: number, t: string) => {
    const siguiente = celdas.map((c, k) => (k === i ? t.trim() : c));
    onCambio(siguiente.every((c) => c === "") ? [] : siguiente.map((c, k) => c || defectos[k]));
  };
  return (
    <div className="pulso-f6-dato is-apilado">
      {etiqueta}
      <div id={id} className="pulso-f6-cortes" role="group">
        {defectos.map((d, i) => (
          <input key={i} type="number" inputMode="decimal" min={0} max={100} className="pulso-f6-input pulso-f6-cortes-campo"
            aria-label={`Corte ${i + 1}`} aria-describedby={describe} placeholder={d} value={celdas[i]} onChange={(e) => cambiar(i, e.target.value)} />
        ))}
      </div>
      {nota}
    </div>
  );
}
