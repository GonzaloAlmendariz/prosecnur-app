// Los editores propios de Inspector › Lámina › Textos (A10 W-B, C38): filas de la ficha técnica, actores del objetivo e
// ícono subido de una lámina de población u objetivo. Los ajustes de «Hallazgos clave» y «Resumen de diferencias» van en
// sus propias secciones (PestanaLamina, H4). Cada cambio es un `updateSlidePayload` (un paso de deshacer) sobre su arg.

import { ActoresObjetivo } from "./ActoresObjetivo";
import type { Slide } from "../../../../api/graficos";
import { usePlanStore } from "../../store";
import { FilasFichaTecnica } from "./FilasFichaTecnica";
import { SelectorIconoSubido } from "./SelectorIconoSubido";
import type { ContenidoEspecial } from "./modeloContenidoEspecial";

export function ContenidoEspecialLamina({ slide, especial }: { slide: Slide; especial: ContenidoEspecial }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const iconos = usePlanStore((s) => s.iconos);
  const payload = slide.payload as Record<string, unknown>;
  return (
    <>
      {especial.filas.map((a) => (
        <FilasFichaTecnica key={a.name} arg={a} valor={payload[a.name]} onCambio={(filas) => updatePayload(slide.id, { [a.name]: filas })} />
      ))}
      {slide.tipo === "p_slide_objetivo_icono" && <ActoresObjetivo slide={slide} />}
      {especial.iconos.map((a) => (
        <SelectorIconoSubido key={a.name} arg={a} valor={payload[a.name]} iconos={iconos}
          onCambio={(id) => updatePayload(slide.id, { [a.name]: id })} />
      ))}
    </>
  );
}
