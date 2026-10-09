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
import type { ReactNode } from "react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/client";
import type { AporteCategoria } from "../criterios/controles";
import { CriterioComposicionCard } from "../criterios/CriterioComposicionCard";

export function CursosHorarioBaseGlobal({
  config,
  onPatchConfig,
  evidenciaComposicion,
  recorteComposicion,
  sinSenalComposicion,
  confirmador,
  ordenJerarquia,
}: {
  config: CalcMuestraWorkspaceAulasConfig;
  onPatchConfig: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
  /**
   * G38 · Aporte del motor para cada paso de composición, para que su tarjeta
   * enseñe sobre qué corta. Opcional: sin él los pasos se dibujan igual y sin
   * evidencia — la superficie no fabrica la distribución que falte.
   */
  evidenciaComposicion?: (criterioId: string) => AporteCategoria | null;
  /**
   * G41 · Cuántos cursos-horario llegan a cada paso de composición y cuántos
   * quedan tras él, en la facultad abierta.
   */
  recorteComposicion?: (
    criterioId: string,
  ) => {
    llegan: number; quedan: number; aplicado: boolean;
    recalculando?: boolean; sinRecorridoVivo?: boolean;
  } | null;
  /**
   * D6 · Cuántas aulas pasaron cada gate de composición sin señal medible.
   * Opcional, igual que la evidencia: sin él la tarjeta se dibuja sin la línea.
   */
  sinSenalComposicion?: (criterioId: string) => number | null;
  /** G41 · El confirmador de la composición, como el de cualquier criterio. */
  confirmador?: ReactNode;
  /**
   * Orden de jerarquía del tipo de docente. NO es un criterio —no incluye ni
   * excluye a nadie—: es la regla con la que el motor elige el docente de mayor
   * rango de cada curso-horario (`teacher_type_top`), y la aplica igual a todas
   * las facultades. Por eso vive en este cierre y no en el bloque de una.
   *
   * Llegó aquí al retirarse el bloque de criterios generales: era su único
   * punto de montaje en toda la app y, sin él, ninguna superficie escribía
   * `aulas_config.teacher_type_orden`, que el motor sí lee.
   */
  ordenJerarquia?: ReactNode;
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
        recorteDe={recorteComposicion}
        sinSenalDe={sinSenalComposicion}
        confirmador={confirmador}
      />
      {ordenJerarquia}
    </div>
  );
}
