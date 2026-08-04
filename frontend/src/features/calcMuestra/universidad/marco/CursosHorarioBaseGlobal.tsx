/**
 * Cierre común del bloque de facultad en la vista de «Cursos-horario»: hoy sólo
 * la composición del curso-horario, que el motor aplica igual para todas.
 *
 * G40 · Aquí vivían las tarjetas de criterio «global» —una por variable de
 * scope aula sin control equivalente por facultad, «Matriculados / población»
 * entre ellas— y el mínimo general de elegibles. Ambas cosas presentaban una
 * decisión que se toma una vez para las 17 facultades, que es exactamente lo
 * que el ADR 0057 (regla 1) niega y lo que Gonzalo pidió retirar: «todos los
 * criterios son por facultad, ninguno es general». El mínimo ya se había ido en
 * G33 por duplicar el control propio de cada facultad; las variables se van
 * ahora por lo mismo.
 *
 * El motor no cambia: conserva los umbrales guardados y sus filas en la
 * cascada. Lo que se retira es la superficie que pedía decidirlos en general.
 */
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import type { AporteCategoria } from "../criterios/controles";
import { CriterioComposicionCard } from "../criterios/CriterioComposicionCard";

export function CursosHorarioBaseGlobal({
  config,
  onPatchConfig,
  evidenciaComposicion,
}: {
  config: CalcMuestraWorkspaceAulasConfig;
  onPatchConfig: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
  /**
   * G38 · Aporte del motor para cada paso de composición, para que su tarjeta
   * enseñe sobre qué corta. Opcional: sin él los pasos se dibujan igual y sin
   * evidencia — la superficie no fabrica la distribución que falte.
   */
  evidenciaComposicion?: (criterioId: string) => AporteCategoria | null;
}) {
  return (
    <div
      /* G23 · El ancla que «Ajustar la regla común» buscaba y no existía.
         El enlace de la tarjeta de composición apuntaba a
         `#cmv2-chfp-global-adjustments` y ese id no estaba en ninguna parte del
         módulo: el único camino a editar una regla común no llevaba a ningún
         sitio. C4 del Contrato de Superficie — todo alcanzable. */
      id="cmv2-chfp-global-adjustments"
      className="cmv2-crit-grid cmv2-chfp-global-grid"
      data-qa-geometry-group="calc-muestra/criterios-ch-globales"
      data-qa-geometry-contract="intrinsic"
    >
      <CriterioComposicionCard
        config={config}
        onPatch={onPatchConfig}
        evidenciaDe={evidenciaComposicion}
      />
    </div>
  );
}
