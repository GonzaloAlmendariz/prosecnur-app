// «Disposición» de la lámina de cinco gráficos (ítem 1 del checklist del catálogo): «Tres arriba y dos abajo» o «Dos
// arriba y tres abajo». La elige el analista; se guarda en la meta de la lámina y la maqueta, el dibujo de la
// composición y los nombres de las ranuras se acomodan a ella. Los tipos sin disposición no la muestran.

import { useId } from "react";
import type { Slide } from "../../../../api/graficos";
import { usePlanStore } from "../../store";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { cambioDeDisposicion, disposicionDe, disposicionesDe } from "./modeloDisposicion";
import "./disposicionLamina.css";

export function DisposicionLamina({ slide }: { slide: Slide }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const id = useId();
  const d = disposicionesDe(slide.tipo);
  const valor = disposicionDe(slide);
  if (!d || !valor) return null;
  return (
    <div className="pulso-f6-disposicion" role="group" aria-labelledby={id}
      data-qa-geometry-group="graficos/f6-disposicion" data-qa-geometry-contract="intrinsic">
      <span id={id} className="pulso-f6-disposicion-rotulo">Disposición</span>
      <RadioSegmentado
        etiqueta="Disposición de los gráficos"
        valor={valor}
        opciones={d.valores.map((v) => ({ clave: v.value, rotulo: v.label }))}
        onCambiar={(v) => updatePayload(slide.id, cambioDeDisposicion(slide, v))}
        ancho
        multilinea
        qaGrupo="graficos/f6-disposicion-opciones"
      />
    </div>
  );
}
