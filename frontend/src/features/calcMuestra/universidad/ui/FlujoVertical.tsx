/**
 * Diagrama de flujo de etapas con cifras vivas y mermas en las aristas
 * (ej. universo → elegibles → población → muestra → aulas). Vertical por
 * defecto; horizontal para cadenas compactas (cuota → titulares → reservas).
 * Cada etapa puede navegar (onEtapaClick) y declarar su estado.
 */
import { Fragment, type CSSProperties } from "react";
import { useValorSwap } from "./useValorSwap";
import "./ui.css";

function ValorEtapa({ valor }: { valor: string }) {
  const cambiando = useValorSwap(valor);
  return (
    <span className="cmv2-uni-flujo-valor cmv2-uni-swap" data-cambiando={cambiando || undefined}>
      {valor}
    </span>
  );
}

export type FlujoEtapa = {
  id: string;
  label: string;
  /** Cifra principal ya formateada (ej. "2,356"). */
  valor?: string;
  detalle?: string;
  /** "alerta" es el paso que dejó el flujo en 0 viniendo de N>0: no es un paso
   *  pendiente, es el que rompió la cadena y tiene que verse distinto. */
  estado?: "ready" | "working" | "pending" | "alerta";
  /** Merma en la arista que llega a la SIGUIENTE etapa (ej. −520 excluidos). */
  merma?: { n: number; label: string };
};

export function FlujoVertical({
  etapas,
  orientacion = "vertical",
  onEtapaClick,
  ariaLabel,
  geometryGroup,
}: {
  etapas: FlujoEtapa[];
  orientacion?: "vertical" | "horizontal" | "adaptive";
  onEtapaClick?: (id: string) => void;
  ariaLabel?: string;
  /** Grupo de geometría (C1) si el llamador lo declara; sin él no cambia nada. */
  geometryGroup?: string;
}) {
  const Etapa = onEtapaClick ? "button" : "div";
  return (
    <div
      className="cmv2-uni-flujo"
      data-orientacion={orientacion}
      data-etapas={etapas.length}
      style={{ "--cmv2-flujo-columnas": Math.min(etapas.length, 6) } as CSSProperties}
      role="list"
      aria-label={ariaLabel}
      data-qa-geometry-group={geometryGroup}
      data-qa-geometry-contract={geometryGroup ? "intrinsic" : undefined}
    >
      {etapas.map((etapa, i) => (
        <Fragment key={etapa.id}>
          {i > 0 && (
            <div className="cmv2-uni-flujo-arista" aria-hidden={etapas[i - 1].merma ? undefined : "true"}>
              <span className="cmv2-uni-flujo-linea" />
              {etapas[i - 1].merma && (
                <span className="cmv2-uni-flujo-merma">
                  −{etapas[i - 1].merma!.n.toLocaleString("es-PE")} {etapas[i - 1].merma!.label}
                </span>
              )}
            </div>
          )}
          <Etapa
            type={onEtapaClick ? "button" : undefined}
            className="cmv2-uni-flujo-etapa"
            style={{ "--cmv2-flujo-index": i } as CSSProperties}
            data-estado={etapa.estado ?? "pending"}
            // Con grupo declarado, sólo las etapas se miden: las aristas son
            // conectores decorativos que estiran al alto de la fila.
            data-qa-geometry-member={geometryGroup ? true : undefined}
            role="listitem"
            onClick={onEtapaClick ? () => onEtapaClick(etapa.id) : undefined}
          >
            <span className="cmv2-uni-flujo-dot" aria-hidden="true" />
            <span className="cmv2-uni-flujo-copy">
              <span className="cmv2-uni-flujo-label">{etapa.label}</span>
              {etapa.valor != null && <ValorEtapa valor={etapa.valor} />}
              {orientacion === "adaptive" && i > 0 && etapas[i - 1].merma && (
                <span className="cmv2-uni-flujo-merma-inline">
                  −{etapas[i - 1].merma!.n.toLocaleString("es-PE")} {etapas[i - 1].merma!.label}
                </span>
              )}
              {etapa.detalle && <span className="cmv2-uni-flujo-detalle">{etapa.detalle}</span>}
            </span>
          </Etapa>
        </Fragment>
      ))}
    </div>
  );
}
