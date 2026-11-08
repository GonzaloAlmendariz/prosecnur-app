// «Dependencia» en la lámina de tres gráficos en fila: el filtro y, para cada uno de los otros dos, las respuestas que lo
// habilitan (dependenciaTres.ts). El formulario lo propone desde su `relevant`, como en la lámina de dos gráficos; quien
// arma la lámina decide.

import { useId } from "react";
import { Switch } from "../../../components/Switch";
import type { GraficadorRef, Slide } from "../../../api/graficos";
import { leerSlideMeta } from "../slideMeta";
import { usePlanStore } from "../store";
import { parseVarRef, useVariables } from "../useVariables";
import {
  alternarRespuesta, conDependiente, dependenciaTresDe, dependientesPosibles, LAMINAS_CON_DEPENDENCIA_TRES, NOMBRE_RANURA,
  type DependenciaTres,
} from "./dependenciaTres";
import { proponerDependencia } from "./propuestaDependencia";
import { PulsoButton } from "../../../components/PulsoButton";
import { ChipSeleccion } from "../../../components/ChipSeleccion";

export function DependenciaTresLamina({ slide }: { slide: Slide }) {
  const id = useId();
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const { variables } = useVariables();
  const ranuras = LAMINAS_CON_DEPENDENCIA_TRES[slide.tipo];
  if (!ranuras) return null;
  const dep = dependenciaTresDe(slide);
  const guardar = (d: DependenciaTres | null) => {
    const meta = { ...(leerSlideMeta(slide) as Record<string, unknown>) };
    if (d) meta.dependencia = d; else delete meta.dependencia;
    updatePayload(slide.id, { meta });
  };
  const grafico = (slot: string) => (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
  const filtro = dep ? grafico(dep.de) : undefined;
  const ref = typeof filtro?.args?.var === "string" ? parseVarRef(filtro.args.var as string) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  // Lo que el formulario dice de cada dependiente posible respecto del filtro elegido.
  const propuesta: DependenciaTres | null = dep ? (() => {
    const habilita: Record<string, string[]> = {};
    for (const r of dependientesPosibles(slide.tipo, dep.de)) {
      const p = proponerDependencia([dep.de, r], grafico, variables);
      if (p && p.de === dep.de) habilita[r] = p.habilita;
    }
    return Object.keys(habilita).length ? { de: dep.de, habilita } : null;
  })() : null;
  const igual = (a: DependenciaTres, b: DependenciaTres) => JSON.stringify(a) === JSON.stringify(b);
  return (
    <section data-qa="dependencia-lamina" aria-labelledby={id}>
      <h3 className="pulso-f6-subtitulo pulso-f6-inspector-apartado" id={id}>Dependencia</h3>
      <div className="pulso-f6-dato">
        <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-sel`}>Pregunta filtro</label>
        <select id={`${id}-sel`} className="pulso-f6-input pulso-f6-dato-select" value={dep?.de ?? ""}
          onChange={(e) => guardar(e.target.value ? { de: e.target.value, habilita: {} } : null)}>
          <option value="">Ninguna</option>
          {ranuras.map((r) => <option key={r} value={r}>El gráfico {NOMBRE_RANURA[r]}</option>)}
        </select>
      </div>
      {propuesta && dep && !igual(propuesta, dep) && (
        <div className="pulso-f6-dato is-apilado" data-qa="dependencia-propuesta">
          <span className="pulso-f6-dato-ayuda" role="note">
            {Object.entries(propuesta.habilita).map(([r, h]) =>
              `El gráfico ${NOMBRE_RANURA[r]} sólo lo responden quienes eligieron ${h.map((x) => `“${x}”`).join(", ")}.`).join(" ")}
          </span>
          <PulsoButton variant="ghost" size="sm" onClick={() => guardar(propuesta)}>Usar</PulsoButton>
        </div>
      )}
      {dep && !ref && <span className="pulso-f6-dato-ayuda" role="note">El gráfico filtro necesita una sola pregunta.</span>}
      {dep && ref && dependientesPosibles(slide.tipo, dep.de).map((r) => {
        const depende = Object.hasOwn(dep.habilita, r);
        const elegidas = new Set(dep.habilita[r] ?? []);
        const idR = `${id}-${r}`;
        return (
          <div key={r} className="pulso-f6-dato is-apilado" data-qa={`dependencia-${r}`}>
            <div className="pulso-f6-dato">
              <span className="pulso-f6-dato-rotulo" id={idR}>Depende el gráfico {NOMBRE_RANURA[r]}</span>
              <Switch checked={depende} ariaLabel={`Depende el gráfico ${NOMBRE_RANURA[r]}`} onToggle={() => guardar(conDependiente(dep, r, !depende))} />
            </div>
            {depende && respuestas.length > 0 && (
              <div className="pulso-f6-destacar" role="group" aria-labelledby={idR}>
                {respuestas.map((x) => (
                  <ChipSeleccion key={x} etiqueta={x} activo={elegidas.has(x)}
                    onAlternar={() => guardar(alternarRespuesta(dep, r, x, respuestas))} />
                ))}
              </div>
            )}
            {depende && elegidas.size === 0 && (
              <span className="pulso-f6-dato-ayuda" role="note">Elige al menos una respuesta: sin ella este gráfico no tiene base.</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
