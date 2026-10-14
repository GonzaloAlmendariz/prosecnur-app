// G17 (Gonzalo, 2026-10-13): la tarjeta de la brecha. Entre dos grupos de una base se elige aquí: la pregunta que define
// los grupos, los dos grupos, las preguntas y el indicador. P21 (enmienda al ADR 0103): entre dos bases ya no sale sólo
// de la matriz de equivalencias; se arma con los temas por público (EditorTemasEquivalentes), que la matriz sugiere.

import { useId } from "react";
import { Plus, X } from "../../../../vendor/lucide-react";
import VariablePicker from "../../VariablePicker";
import { EditorTemasEquivalentes } from "../../temasEquivalentes/EditorTemasEquivalentes";
import { useVariables } from "../../useVariables";
import {
  aEntreBases, aEntreGrupos, conCorte, conCruce, conGrupo, conPreguntas, corteDe, esEntreGrupos, faltaEnBrecha, gruposDe,
  mismaBase, opcionesDe, preguntasDe,
} from "./modeloBrechaGrupos";
import "./brechaEntreGrupos.css";

type Props = { args: Readonly<Record<string, unknown>>; onCambio: (patch: Record<string, unknown>) => void };

const esSelectOne = (tipo: string) => /^select_one/.test(tipo) || tipo === "so";

export function BrechaEntreGrupos({ args, onCambio }: Props) {
  const id = useId();
  const { variables } = useVariables();
  const grupos = esEntreGrupos(args);
  const cruce = typeof args.cruce === "string" ? args.cruce : "";
  const preguntas = preguntasDe(args);
  const opcionesCruce = cruce ? opcionesDe(variables, cruce) : [];
  const [g1, g2] = gruposDe(args);
  const escala = grupos && preguntas.length ? opcionesDe(variables, preguntas[0]) : [];
  const corte = new Set(corteDe(args));
  const falta = grupos ? faltaEnBrecha(args) : null;

  return (
    <div className="pulso-f6-brecha" data-qa-geometry-group="graficos/f6-brecha" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo" id={`${id}-modo`}>Comparar</span>
        <div className="pulso-f6-brecha-modo" role="group" aria-labelledby={`${id}-modo`}>
          <button type="button" className="pulso-f6-boton" aria-pressed={!grupos} onClick={() => grupos && onCambio(aEntreBases())}>Dos bases</button>
          <button type="button" className="pulso-f6-boton" aria-pressed={grupos} onClick={() => !grupos && onCambio(aEntreGrupos())}>Dos grupos de una base</button>
        </div>
      </div>

      {!grupos && <EditorTemasEquivalentes tipo="brecha" args={args} onCambio={onCambio} />}

      {grupos && (
        <>
          <div className="pulso-f6-dato is-apilado">
            <span className="pulso-f6-dato-rotulo">Grupos de</span>
            <div className="pulso-f6-dato-control">
              <VariablePicker value={cruce || null} allowEmpty filter={esSelectOne} placeholder="Elige la pregunta (ej. sexo)…"
                              onChange={(v) => onCambio(conCruce(variables, v))} />
            </div>
          </div>
          {cruce && (
            <div className="pulso-f6-dato is-apilado">
              <span className="pulso-f6-dato-rotulo">Los dos grupos</span>
              <div className="pulso-f6-brecha-grupos">
                {([0, 1] as const).map((k) => (
                  <select key={k} className="pulso-f6-dato-select" aria-label={k === 0 ? "Primer grupo" : "Segundo grupo"}
                          value={k === 0 ? g1 : g2} onChange={(e) => onCambio(conGrupo(args, k, e.target.value))}>
                    <option value="">{k === 0 ? "Primer grupo…" : "Segundo grupo…"}</option>
                    {opcionesCruce.filter((o) => k === 0 || o.codigo !== g1).map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}
                  </select>
                ))}
              </div>
              <span className="pulso-f6-dato-ayuda">La brecha es el primero menos el segundo.</span>
            </div>
          )}
          <div className="pulso-f6-dato is-apilado">
            <span className="pulso-f6-dato-rotulo">Preguntas</span>
            <ul className="pulso-f6-brecha-preguntas">
              {preguntas.map((ref, i) => (
                <li key={`${ref}-${i}`} className="pulso-f6-brecha-pregunta">
                  <div className="pulso-f6-dato-control">
                    <VariablePicker value={ref} filter={esSelectOne}
                                    onChange={(v) => onCambio(conPreguntas(variables, preguntas.map((p, j) => (j === i ? v ?? "" : p))))} />
                  </div>
                  <button type="button" className="pulso-f6-icono-boton" aria-label="Quitar la pregunta"
                          onClick={() => onCambio(conPreguntas(variables, preguntas.filter((_, j) => j !== i)))}>
                    <X size={14} aria-hidden="true" />
                  </button>
                  {cruce && !mismaBase(variables, cruce, ref) && <span className="pulso-f6-dato-ayuda is-aviso">Está en otra base que el cruce.</span>}
                </li>
              ))}
            </ul>
            <div className="pulso-f6-dato-control">
              <VariablePicker value={null} allowEmpty filter={esSelectOne} placeholder="Agregar pregunta…"
                              onChange={(v) => v && onCambio(conPreguntas(variables, [...preguntas, v]))} />
            </div>
            {!preguntas.length && <span className="pulso-f6-dato-ayuda"><Plus size={12} aria-hidden="true" /> Preguntas con la misma escala, de la base del cruce.</span>}
          </div>
          {falta && <p className="pulso-f6-dato-ayuda is-aviso" role="status">{falta}</p>}
        </>
      )}
      {escala.length > 0 && (
        <fieldset className="pulso-f6-dato is-apilado pulso-f6-brecha-corte">
          <legend className="pulso-f6-dato-rotulo">Respuestas que suman el indicador</legend>
          {escala.map((o) => (
            <label key={o.codigo} className="pulso-f6-brecha-opcion">
              <input type="checkbox" checked={corte.has(o.codigo)} onChange={(e) => onCambio(conCorte(args, o.codigo, e.target.checked))} />
              {o.etiqueta}
            </label>
          ))}
        </fieldset>
      )}

    </div>
  );
}
