// Contenido de una miniatura de la tira según el estado del lote (contrato §2.4 y §6.3). Toda variante ocupa la MISMA
// caja 16:9 que fija la tira (C2): el esqueleto de `pendiente`, el PNG de `ok`, la composición SVG de `sin_imagen`, la
// marca «Sin datos» y el aviso de `error` no cambian el tamaño de la miniatura ni el de la fila.

import type { Slide } from "../../../../api/graficos";
import { ImageOff } from "../../../../vendor/lucide-react";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { IconoTipo } from "../../iconos/IconoTipo";
import { SLIDE_GRAF_SLOTS } from "../../store";
import type { LaminaEnEstructura } from "../modeloEstructura";
import { opcionesDeComposicion } from "../opcionesComposicion";
import { graficosDeLamina } from "../selectores/cambioTipoLamina";
import { varianteDe } from "../selectores/tiposLamina";
import type { VistaMiniatura } from "./vistaMiniatura";

function Composicion({ slide }: { slide: Slide }) {
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const graficos = Object.fromEntries(graficosDeLamina(slide).map((g) => [g.slot, g.grafico.graficador]));
  return <ComposicionLamina tipo={slide.tipo} slots={slots} graficos={graficos} opciones={opcionesDeComposicion(slide)} variante={varianteDe(slide)} className="pulso-f6-miniatura-composicion" />;
}

type Props = { vista: VistaMiniatura; src: string | null; slide: Slide | undefined; lamina: LaminaEnEstructura };

export function ContenidoMiniatura({ vista, src, slide, lamina }: Props) {
  // La tira muestra el dibujo de la composición (tipo de lámina y glifo de cada gráfico), no la imagen reducida: a ese
  // tamaño se lee mejor y no depende de que el motor haya dibujado nada. La imagen real vive en el visor.
  if (slide && vista !== "error" && vista !== "sin_datos") return <Composicion slide={slide} />;
  if (vista === "imagen" || vista === "actualizando") {
    return <img src={src ?? undefined} alt="" draggable={false} className={vista === "actualizando" ? "is-actualizando" : undefined} />;
  }
  if (vista === "esqueleto") {
    return (
      <span className="pulso-f6-miniatura-esqueleto" aria-hidden="true">
        <span />
        <span />
      </span>
    );
  }
  if (vista === "composicion" && slide) return <Composicion slide={slide} />;
  if (vista === "sin_datos") {
    return (
      <>
        {src ? <img src={src} alt="" draggable={false} className="is-sin-datos" /> : slide ? <Composicion slide={slide} /> : null}
        <span className="pulso-f6-miniatura-marca" aria-hidden="true">Sin datos</span>
      </>
    );
  }
  if (vista === "error") {
    return (
      <span className="pulso-f6-miniatura-error" aria-hidden="true">
        <ImageOff size={14} />
        <span>No se pudo dibujar</span>
      </span>
    );
  }
  return (
    <span className="pulso-f6-miniatura-ficha" aria-hidden="true">
      <IconoTipo clase="lamina" tipo={lamina.tipo} size={16} />
      <span>{lamina.titulo}</span>
    </span>
  );
}
