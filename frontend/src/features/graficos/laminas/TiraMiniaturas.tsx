// Tira de miniaturas bajo el lienzo (F6.1; dirección F6 §4.1 «Visor»), como el panel de diapositivas de PowerPoint o
// Canva pero horizontal, agrupada por capítulo. Miniaturas reales de TODAS las láminas (F6 §5.3): un lote en segundo
// plano (`useMiniaturasLote`, nunca un render masivo síncrono) que pinta cada lámina conforme llega; mientras tanto, un
// esqueleto en la misma caja (C2). Sin lote (base sin preparar) cae a la imagen de las ya vistas o a la ficha de tipo.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RotateCw } from "../../../vendor/lucide-react";
import { usePlanStore } from "../store";
import type { EstructuraInforme, LaminaEnEstructura } from "./modeloEstructura";
import { useLaminasUi } from "./laminasStore";
import { ContenidoMiniatura } from "./miniaturas/ContenidoMiniatura";
import { ANUNCIO_INICIAL, siguienteAnuncio } from "./miniaturas/anuncioTira";
import { avisoVacios } from "./miniaturas/loteMiniaturas";
import { useMiniaturasLoteStore } from "./miniaturas/miniaturasStore";
import { reintentarConFoco } from "./miniaturas/reintentarConFoco";
import { rotuloEstado, vistaDeMiniatura } from "./miniaturas/vistaMiniatura";
import { useMiniaturasLote } from "./miniaturas/useMiniaturasLote";
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
  const slides = usePlanStore((s) => s.plan.slides);
  const grupos = useMemo(() => gruposDeTira(estructura), [estructura]);
  const ref = useRef<HTMLElement>(null);
  // En el marco compacto la tira se pliega por CSS: no se dibuja un lote que nadie mira.
  const [visible, setVisible] = useState(true);
  const { entradas, avance, reintentar } = useMiniaturasLote(estructura.laminas, visible);
  const porId = useMemo(() => new Map(slides.map((s) => [s.id, s])), [slides]);
  // Un anuncio por lote, no por lámina; recuerda el último lote para decir cómo terminó (anuncioTira.ts).
  const vigente = useMiniaturasLoteStore((s) => s.vigente);
  const anuncio = useRef(ANUNCIO_INICIAL);
  anuncio.current = siguienteAnuncio(anuncio.current, vigente, entradas);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setVisible(el.getClientRects().length > 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-miniatura="${posicionActiva}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [posicionActiva]);

  return (
    <>
      {/* La región viva va FUERA del nav con aria-busy: varios lectores callan las regiones bajo un ancestro ocupado. */}
      <span className="pulso-sr-only" role="status">{visible ? anuncio.current.texto : ""}</span>
      <nav
        ref={ref}
        className="pulso-f6-tira"
        aria-label="Miniaturas de las láminas"
        aria-busy={avance ? avance.listas < avance.total : undefined}
        data-avance={avance ? "" : undefined}
        style={avance ? ({ "--pulso-f6-tira-avance": `${Math.round((avance.listas / Math.max(1, avance.total)) * 100)}%` } as CSSProperties) : undefined}
      >
        {grupos.map((g) => (
          <section
            key={g.id}
            className={`pulso-f6-tira-grupo${g.laminas.some((l) => l.posicion === posicionActiva) ? " is-actual" : ""}`}
            aria-label={`${g.rotulo}, ${g.laminas.length} ${g.laminas.length === 1 ? "lámina" : "láminas"}`}
          >
            <span className="pulso-f6-tira-cabeza">
              <span className="pulso-f6-tira-rotulo" title={g.rotulo}>{g.rotulo}</span>
              <span className="pulso-f6-tira-cuenta" aria-hidden="true">{g.laminas.length}</span>
            </span>
            <ul className="pulso-f6-tira-fila" data-qa-geometry-group="graficos/f6-tira" data-qa-geometry-contract="equal">
              {g.laminas.map((l) => {
                const entrada = entradas[l.id];
                const { vista, src } = vistaDeMiniatura(entrada, miniaturas[l.id]);
                const activa = l.posicion === posicionActiva;
                const parcial = avisoVacios(entrada);
                const motivo = parcial && entrada?.vacios?.motivo ? ` (${entrada.vacios.motivo})` : "";
                return (
                  <li key={l.id} className="pulso-f6-tira-item">
                    <button
                      type="button"
                      className={`pulso-f6-miniatura is-${vista}${activa ? " is-activa" : ""}`}
                      aria-current={activa ? "true" : undefined}
                      aria-label={`Lámina ${l.posicion}: ${l.titulo}${rotuloEstado(vista)}${vista === "error" && entrada?.error ? `: ${entrada.error}` : ""}${parcial ? ` · ${parcial}${motivo}` : ""}`}
                      title={vista === "error" && entrada?.error ? entrada.error : parcial ? `${parcial}${motivo}` : undefined}
                      data-miniatura={l.posicion}
                      data-miniatura-estado={entrada?.estado ?? "sin_lote"}
                      onClick={() => onIr(l.posicion)}
                    >
                      <ContenidoMiniatura vista={vista} src={src} slide={porId.get(l.id)} lamina={l} />
                      {parcial && entrada?.vacios && (
                        <span className="pulso-f6-miniatura-parcial" aria-hidden="true">{entrada.vacios.vacios} de {entrada.vacios.pedidos} sin datos</span>
                      )}
                      <span className="pulso-f6-miniatura-num" aria-hidden="true">{l.posicion}</span>
                    </button>
                    {vista === "error" && (
                      <button
                        type="button"
                        className="pulso-f6-miniatura-reintentar"
                        aria-label={`Reintentar la miniatura de la lámina ${l.posicion}`}
                        title={entrada?.error ? `${entrada.error} Reintentar.` : "Reintentar"}
                        onClick={(e) => reintentarConFoco(e.currentTarget.parentElement, () => reintentar(l.id))}
                      >
                        <RotateCw size={12} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </>
  );
}
