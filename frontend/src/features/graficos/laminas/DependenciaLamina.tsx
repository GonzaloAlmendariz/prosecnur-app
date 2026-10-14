// «Dependencia» entre los dos gráficos de una lámina (Gonzalo, 2026-10-14: «la dependencia no es un tipo de gráfico sino
// que cuando hay dos gráficos en un solo slide se puede establecer dependencia entre gráficos»). Uno es la pregunta filtro y
// el otro sólo lo respondieron quienes dieron ciertas respuestas: su base pasa a ser la de ellos y la lámina los une con la
// llave del recetario (p192–p194). Se guarda en `payload.meta.dependencia = { de, habilita }` (graficos_dependencia.R).

import { useId } from "react";
import type { GraficadorRef, Slide } from "../../../api/graficos";
import { leerSlideMeta } from "../slideMeta";
import { usePlanStore } from "../store";
import { parseVarRef, useVariables } from "../useVariables";

/** Las láminas que admiten dependencia y sus dos ranuras, en el orden en que se leen. */
export const LAMINAS_CON_DEPENDENCIA: Readonly<Record<string, readonly [string, string]>> = {
  p_slide_2_graficos: ["izquierda", "derecha"],
  p_slide_2_graficos_vertical: ["superior", "inferior"],
};
const NOMBRE: Readonly<Record<string, string>> = { izquierda: "izquierda", derecha: "derecha", superior: "de arriba", inferior: "de abajo" };

export type Dependencia = { de: string; habilita: string[] };

/** La dependencia guardada en la lámina (o `null`). */
export function dependenciaDe(slide: Pick<Slide, "tipo" | "payload">): (Dependencia & { a: string }) | null {
  const ranuras = LAMINAS_CON_DEPENDENCIA[slide.tipo];
  const d = leerSlideMeta(slide).dependencia as Record<string, unknown> | undefined;
  if (!ranuras || !d || typeof d.de !== "string" || !ranuras.includes(d.de)) return null;
  const habilita = (Array.isArray(d.habilita) ? d.habilita : []).map(String).filter(Boolean);
  return { de: d.de, a: ranuras.find((r) => r !== d.de) as string, habilita };
}

export function DependenciaLamina({ slide }: { slide: Slide }) {
  const id = useId();
  const idHab = useId();
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const { variables } = useVariables();
  const ranuras = LAMINAS_CON_DEPENDENCIA[slide.tipo];
  if (!ranuras) return null;
  const dep = dependenciaDe(slide);
  const guardar = (d: Dependencia | null) => {
    const meta = { ...(leerSlideMeta(slide) as Record<string, unknown>) };
    if (d) meta.dependencia = d; else delete meta.dependencia;
    updatePayload(slide.id, { meta });
  };
  const grafico = (slot: string) => (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
  const independiente = dep ? grafico(dep.de) : undefined;
  const ref = typeof independiente?.args?.var === "string" ? parseVarRef(independiente.args.var as string) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  const elegidas = new Set(dep?.habilita ?? []);
  const alternar = (r: string) => dep && guardar({ de: dep.de, habilita: respuestas.filter((x) => (x === r ? !elegidas.has(x) : elegidas.has(x))) });
  const [a, b] = ranuras;
  return (
    <section data-qa="dependencia-lamina" aria-labelledby={id}>
      <h3 className="pulso-f6-subtitulo pulso-f6-inspector-apartado" id={id}>Dependencia</h3>
      <div className="pulso-f6-dato">
        <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-sel`}>Un gráfico depende del otro</label>
        <select id={`${id}-sel`} className="pulso-f6-input pulso-f6-dato-select" value={dep?.de ?? ""}
          onChange={(e) => guardar(e.target.value ? { de: e.target.value, habilita: [] } : null)}>
          <option value="">No</option>
          <option value={a}>El {NOMBRE[b]} depende del {NOMBRE[a]}</option>
          <option value={b}>El {NOMBRE[a]} depende del {NOMBRE[b]}</option>
        </select>
      </div>
      {dep && !ref && <span className="pulso-f6-dato-ayuda" role="note">El gráfico del que depende necesita una sola pregunta.</span>}
      {dep && ref && respuestas.length > 0 && (
        <div className="pulso-f6-dato is-apilado">
          <span className="pulso-f6-dato-rotulo" id={idHab}>Respuestas que lo habilitan</span>
          <div className="pulso-f6-destacar" role="group" aria-labelledby={idHab}>
            {respuestas.map((r) => (
              <button key={r} type="button" className="pulso-f6-destacar-opcion is-unica" role="checkbox" aria-checked={elegidas.has(r)} onClick={() => alternar(r)}>{r}</button>
            ))}
          </div>
          {elegidas.size === 0 && <span className="pulso-f6-dato-ayuda" role="note">Elige al menos una: sin ella el gráfico dependiente no tiene base.</span>}
        </div>
      )}
    </section>
  );
}
