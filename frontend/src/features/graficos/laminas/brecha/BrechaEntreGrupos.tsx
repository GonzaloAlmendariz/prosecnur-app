// G17 (Gonzalo, 2026-10-13): la tarjeta de la brecha. Entre dos grupos de una base se elige aquí: la pregunta que define
// los grupos, los dos grupos, las preguntas y el indicador. P21 (enmienda al ADR 0103): entre dos bases ya no sale sólo
// de la matriz de equivalencias; se arma con los temas por público (EditorTemasEquivalentes), que la matriz sugiere.

import { useId, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Plus, X } from "../../../../vendor/lucide-react";
import { useGraficosReportScope } from "../../reportScope";
import { GruposPadron } from "../gruposPadron/GruposPadron";
import { PadronPublicos } from "../gruposPadron/PadronPublicos";
import { EntradaEmparejado } from "../emparejado/EntradaEmparejado";
import VariablePicker from "../../VariablePicker";
import { EditorTemasEquivalentes } from "../../temasEquivalentes/EditorTemasEquivalentes";
import { useVariables } from "../../useVariables";
import { publicoEnFrase } from "../mazoResumen/modeloMazo";
import { PublicosGrafico } from "../publicosGrafico/PublicosGrafico";
import { usaPublicos } from "../publicosGrafico/modeloPublicos";
import { cargarCategorias } from "../useCategoriasGrafico";
import {
  aEntreBases, aEntreGrupos, baseDelCruce, conCorte, conCruce, conGrupo, conPreguntas, corteDe, esEntreGrupos, faltaEnBrecha,
  gruposDe, gruposPorDefecto, maxGrupos, mismaBase, opcionesDe, opcionesDeGrupo, preguntasDe, preguntasPorRegla,
} from "./modeloBrechaGrupos";
import "./brechaEntreGrupos.css";
import { AyudaGlobo } from "../AyudaGlobo";

type Props = { args: Readonly<Record<string, unknown>>; onCambio: (patch: Record<string, unknown>) => void };

const ORDINAL: readonly string[] = ["Primer", "Segundo", "Tercer", "Cuarto"];

const esSelectOne = (tipo: string) => /^select_one/.test(tipo) || tipo === "so";

export function BrechaEntreGrupos({ args, onCambio }: Props) {
  const id = useId();
  const { variables } = useVariables();
  const grupos = esEntreGrupos(args);
  const cruce = typeof args.cruce === "string" ? args.cruce : "";
  const preguntas = preguntasDe(args);
  const opcionesCruce = cruce ? opcionesDe(variables, cruce) : [];
  const casillas = gruposDe(args);
  const varios = maxGrupos(args) > 2;
  const escala = grupos && preguntas.length ? opcionesDe(variables, preguntas[0]) : [];
  const corte = new Set(corteDe(args));
  const falta = grupos ? faltaEnBrecha(args) : null;
  // ADR 0135 §6: en el contraste del resumen los grupos se eligen con su padrón (GruposPadron) y, entre bases, cada
  // público lleva el suyo con la propuesta de Cálculo de muestra o Monitoreo (PadronPublicos).
  const resumen = args.estilo === "resumen";
  const scope = useGraficosReportScope(useLocation().search);
  const porPublicos = grupos && usaPublicos(args.vars);
  const deLaRegla = grupos && !!cruce && preguntasPorRegla(args);
  const baseCruce = cruce ? baseDelCruce(variables, cruce) : "";
  // Q4-4: en el resumen, al elegir la pregunta que divide arrancan encendidos hasta cuatro grupos con respuestas. Se
  // espera su conteo y se aplica todo en un solo cambio (un Ctrl+Z); una respuesta vieja de otro cruce no pisa la última.
  const pedido = useRef(0);
  const elegirCruce = (v: string | null) => {
    const turno = ++pedido.current;
    const ref = conCruce(variables, v).cruce;
    if (!resumen || !v || typeof ref !== "string" || !ref) { onCambio(conCruce(variables, v)); return; }
    cargarCategorias(ref, scope)
      .then((d) => (d ? new Map(d.categorias.map((c) => [c.codigo, c.n])) : null))
      .catch(() => null)
      .then((conteos) => {
        if (turno !== pedido.current) return;
        onCambio(conCruce(variables, v, gruposPorDefecto(opcionesDe(variables, ref), conteos)));
      });
  };

  return (
    <div className="pulso-f6-brecha" data-qa-geometry-group="graficos/f6-brecha" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo" id={`${id}-modo`}>Comparar</span>
        <div className="pulso-f6-brecha-modo" role="group" aria-labelledby={`${id}-modo`}>
          <button type="button" className="pulso-f6-boton" aria-pressed={!grupos} onClick={() => grupos && onCambio(aEntreBases())}>Dos bases</button>
          <button type="button" className="pulso-f6-boton" aria-pressed={grupos} onClick={() => !grupos && onCambio(aEntreGrupos(args))}>Dos grupos de una base</button>
        </div>
      </div>

      {!grupos && <EditorTemasEquivalentes tipo="brecha" args={args} onCambio={onCambio} />}
      {!grupos && resumen && <EntradaEmparejado args={args} scope={scope} onCambio={onCambio} />}
      {!grupos && resumen && args.base_en === "tabla" && <PadronPublicos graficador="p_dumbbell" args={args} scope={scope} onCambio={onCambio} />}

      {grupos && (
        <>
          <div className="pulso-f6-dato is-apilado">
            <span className="pulso-f6-dato-rotulo">{resumen ? "Dividir por" : "Grupos de"}</span>
            <div className="pulso-f6-dato-control">
              <VariablePicker value={cruce || null} allowEmpty filter={esSelectOne} placeholder="Elige la pregunta (ej. sexo)…"
                              onChange={elegirCruce} />
            </div>
          </div>
          {cruce && resumen && <GruposPadron args={args} cruce={cruce} opciones={opcionesCruce} scope={scope} onCambio={onCambio} />}
          {cruce && !resumen && (
            <div className="pulso-f6-dato is-apilado">
              <span className="pulso-f6-dato-rotulo">
                {varios ? "Los grupos (hasta cuatro)" : "Los dos grupos"}
                <AyudaGlobo rotulo={varios ? "Los grupos" : "Los dos grupos"} detalle="La brecha es el primero menos el segundo." />
              </span>
              <div className="pulso-f6-brecha-grupos" data-grupos={casillas.length}>
                {casillas.map((g, k) => (
                  <select key={k} className="pulso-f6-dato-select" aria-label={ORDINAL[k] ? `${ORDINAL[k]} grupo` : `Grupo ${k + 1}`}
                          value={g} onChange={(e) => onCambio(conGrupo(args, k, e.target.value))}>
                    <option value="">{k < 2 ? `${ORDINAL[k]} grupo…` : `${ORDINAL[k] ?? "Otro"} grupo (opcional)…`}</option>
                    {opcionesDeGrupo(opcionesCruce, args, k).map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}
                  </select>
                ))}
              </div>
            </div>
          )}
          {porPublicos ? (
            // Q4-3: con `base$*` las preguntas son las de escala de cada público (como en el panorama), no un selector vacío.
            <div className="pulso-f6-dato is-apilado" data-campo="vars">
              <span className="pulso-f6-dato-rotulo" id={`${id}-publicos`}>
                Públicos
                <AyudaGlobo rotulo="Públicos" detalle="Todas las preguntas de escala del público; la regla elige cuáles salen." />
              </span>
              <PublicosGrafico id={`${id}-publicos-lista`} graficador="p_dumbbell" valor={args.vars} describe={`${id}-publicos`}
                onCambio={(v) => onCambio({ vars: v })} />
            </div>
          ) : (
            <div className="pulso-f6-dato is-apilado">
              <span className="pulso-f6-dato-rotulo">Preguntas</span>
              <ul className="pulso-f6-brecha-preguntas" data-qa-geometry-group="graficos/f6-brecha-preguntas" data-qa-geometry-contract="intrinsic">
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
              {deLaRegla && baseCruce && (
                <span className="pulso-f6-dato-ayuda">{`Todas las de escala de ${publicoEnFrase(baseCruce)}; la regla elige cuáles salen.`}</span>
              )}
              {!preguntas.length && !deLaRegla && <span className="pulso-f6-dato-ayuda"><Plus size={12} aria-hidden="true" /> Preguntas con la misma escala, de la base del cruce.</span>}
            </div>
          )}
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
