// Tira de miniaturas bajo el lienzo (F6.1; dirección F6 §4.1 «Visor»), como el panel de diapositivas de PowerPoint o
// Canva pero horizontal, agrupada por capítulo. NUNCA pide renders: muestra la imagen de las láminas ya vistas y, para
// las demás, una ficha esquemática con su tipo y título (la miniatura dibujada desde las ranuras llega en F6.3).

import { useEffect, useMemo, useRef } from "react";
import { IconoTipo } from "../iconos/IconoTipo";
import type { EstructuraInforme, LaminaEnEstructura } from "./modeloEstructura";
import { useLaminasUi } from "./laminasStore";
import "./tiraMiniaturas.css";

type Grupo = { id: string; rotulo: string; laminas: LaminaEnEstructura[] };

export function gruposDeTira(estructura: EstructuraInforme): Grupo[] {
  return estructura.nodos.map((n) => n.clase === "bloque"
    ? { id: n.id, rotulo: n.titulo, laminas: n.laminas }
    : {
        id: n.id,
        rotulo: `${n.numero}. ${n.titulo}`,
        laminas: [n.separador, ...n.laminas, ...n.subcapitulos.flatMap((s) => [s.separador, ...s.laminas])],
      });
}

type Props = { estructura: EstructuraInforme; posicionActiva: number; onIr: (posicion: number) => void };

export function TiraMiniaturas({ estructura, posicionActiva, onIr }: Props) {
  const miniaturas = useLaminasUi((s) => s.miniaturas);
  const grupos = useMemo(() => gruposDeTira(estructura), [estructura]);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-miniatura="${posicionActiva}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [posicionActiva]);

  return (
    <nav ref={ref} className="pulso-f6-tira" aria-label="Miniaturas de las láminas">
      {grupos.map((g) => (
        <section key={g.id} className="pulso-f6-tira-grupo" aria-label={g.rotulo}>
          <span className="pulso-f6-tira-rotulo" title={g.rotulo}>{g.rotulo}</span>
          <ul className="pulso-f6-tira-fila" data-qa-geometry-group="graficos/f6-tira" data-qa-geometry-contract="equal">
            {g.laminas.map((l) => {
              const img = miniaturas[l.id];
              const activa = l.posicion === posicionActiva;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`pulso-f6-miniatura${activa ? " is-activa" : ""}`}
                    aria-current={activa ? "true" : undefined}
                    aria-label={`Lámina ${l.posicion}: ${l.titulo}`}
                    data-miniatura={l.posicion}
                    onClick={() => onIr(l.posicion)}
                  >
                    {img ? (
                      <img src={img} alt="" draggable={false} />
                    ) : (
                      <span className="pulso-f6-miniatura-ficha" aria-hidden="true">
                        <IconoTipo clase="lamina" tipo={l.tipo} size={16} />
                        <span>{l.titulo}</span>
                      </span>
                    )}
                    <span className="pulso-f6-miniatura-num" aria-hidden="true">{l.posicion}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
