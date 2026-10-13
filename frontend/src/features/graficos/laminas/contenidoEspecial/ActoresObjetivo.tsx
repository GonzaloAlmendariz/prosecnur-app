// «Actores consultados» de la lámina de objetivo (G6, Gonzalo 2026-10-13: «había uno que te permitía poder poner
// perfiles o actores… la UI no refleja esas posibilidades»). El motor ya los dibuja con su ícono
// (`.lam_laminas_objetivo`, api/R/lamina_identidad.R) desde `meta.actores`; faltaba dónde escribirlos.
import { useId } from "react";
import type { Slide } from "../../../../api/graficos";
import { usePlanStore } from "../../store";
import { conSlideMeta, leerSlideMeta } from "../../slideMeta";
import { actoresDesdeTexto, textoDeActores } from "./modeloActoresObjetivo";

export function ActoresObjetivo({ slide }: { slide: Slide }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const id = useId();
  const actores = leerSlideMeta(slide).actores;
  return (
    <div className="pulso-f6-campo">
      <label htmlFor={id}>Actores consultados</label>
      <textarea id={id} data-campo="actores" className="pulso-f6-input" rows={4} value={textoDeActores(actores)}
        placeholder={"Estudiantes\nDocentes\nEgresados"}
        aria-describedby={`${id}-ayuda`}
        onChange={(e) => updatePayload(slide.id, { meta: conSlideMeta(slide, { actores: actoresDesdeTexto(e.target.value) }).payload.meta })} />
      <span id={`${id}-ayuda`} className="pulso-f6-ayuda">Uno por línea, hasta seis. Cada uno sale con su ícono bajo el objetivo; vacío, la lámina va sin actores.</span>
    </div>
  );
}
