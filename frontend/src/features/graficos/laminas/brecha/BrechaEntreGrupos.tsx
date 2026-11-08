// G17 (Gonzalo, 2026-10-13): la tarjeta de la brecha. Entre dos grupos de una base se elige aquí: la pregunta que define
// los grupos, los dos grupos, las preguntas y el indicador. P21 (enmienda al ADR 0103): entre dos bases ya no sale sólo
// de la matriz de equivalencias; se arma con los temas por público (EditorTemasEquivalentes), que la matriz sugiere.

import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
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
  aEntreBases, aEntreGrupos, baseDelCruce, brechaSinPreguntas, comodinDelCruce, conCorte, conCruce, conGrupo, conPreguntas, corteDe,
  esEntreGrupos, FALTA_CRUCE, faltaEnBrecha, gruposDe, gruposPorDefecto, maxGrupos, mismaBase, opcionesDe, opcionesDeGrupo, preguntasDeclaradas,
  preguntasPorRegla, soloComodinDelCruce,
} from "./modeloBrechaGrupos";
import "./brechaEntreGrupos.css";
import { AyudaGlobo } from "../AyudaGlobo";
import { PulsoButton } from "../../../../components/PulsoButton";

type Props = { args: Readonly<Record<string, unknown>>; onCambio: (patch: Record<string, unknown>) => void };

const ORDINAL: readonly string[] = ["Primer", "Segundo", "Tercer", "Cuarto"];

const esSelectOne = (tipo: string) => /^select_one/.test(tipo) || tipo === "so";

export function BrechaEntreGrupos({ args, onCambio }: Props) {
  const id = useId();
  const { variables } = useVariables();
  const grupos = esEntreGrupos(args);
  const cruce = typeof args.cruce === "string" ? args.cruce : "";
  // Las elegidas una por una; el `base$*` del cruce no es una fila (R8-1).
  const preguntas = preguntasDeclaradas(args);
  const opcionesCruce = cruce ? opcionesDe(variables, cruce) : [];
  const casillas = gruposDe(args);
  const varios = maxGrupos(args) > 2;
  const escala = grupos && preguntas.length ? opcionesDe(variables, preguntas[0]) : [];
  const corte = new Set(corteDe(args));
  // R9-16: sin «Dividir por» y con regla, la falta la dice la regla (con su camino a «Dividir por», R8-7); aquí se decía
  // dos veces seguidas la misma frase.
  const conReglaDePreguntas = !!args.regla && typeof args.regla === "object";
  const faltaEnTarjeta = grupos ? faltaEnBrecha(args) : null;
  const falta = faltaEnTarjeta === FALTA_CRUCE && conReglaDePreguntas ? null : faltaEnTarjeta;
  // ADR 0135 §6: en el contraste del resumen los grupos se eligen con su padrón (GruposPadron) y, entre bases, cada
  // público lleva el suyo con la propuesta de Cálculo de muestra o Monitoreo (PadronPublicos).
  const resumen = args.estilo === "resumen";
  const scope = useGraficosReportScope(useLocation().search);
  const porPublicos = grupos && usaPublicos(args.vars) && !soloComodinDelCruce(variables, args);
  const deLaRegla = grupos && !!cruce && preguntasPorRegla(args);
  const baseCruce = cruce ? baseDelCruce(variables, cruce) : "";
  const sinPreguntas = grupos && brechaSinPreguntas(args) && !!baseCruce;
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
        <span className="pulso-f6-dato-rotulo" id={`${id}-modo`} aria-hidden="true">Comparar</span>
        {/* W2-B: elegir el modo es elegir un valor: el segmentado del kit, en partes iguales a todo el ancho. */}
        <RadioSegmentado etiqueta="Comparar" ancho multilinea qaGrupo="graficos/f6-brecha-modo"
          valor={grupos ? "grupos" : "bases"}
          onCambiar={(k) => onCambio(k === "grupos" ? aEntreGrupos(args) : aEntreBases())}
          opciones={[{ clave: "bases", rotulo: "Dos bases" }, { clave: "grupos", rotulo: "Dos grupos de una base" }]} />
      </div>

      {!grupos && <EditorTemasEquivalentes tipo="brecha" args={args} onCambio={onCambio} />}
      {!grupos && resumen && <EntradaEmparejado args={args} scope={scope} onCambio={onCambio} />}
      {!grupos && resumen && <PadronPublicos graficador="p_dumbbell" args={args} scope={scope} onCambio={onCambio} />}

      {grupos && (
        <>
          <div className="pulso-f6-dato is-apilado" data-campo="cruce">
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
                    <PulsoButton variant="icon" tone="quiet" size="sm" intent="remove" aria-label="Quitar la pregunta"
                            onClick={() => onCambio(conPreguntas(variables, preguntas.filter((_, j) => j !== i)))}>
                      <X aria-hidden="true" />
                    </PulsoButton>
                    {cruce && !mismaBase(variables, cruce, ref) && <span className="pulso-f6-dato-ayuda is-aviso">Está en otra base que el cruce.</span>}
                  </li>
                ))}
              </ul>
              <div className="pulso-f6-dato-control">
                <VariablePicker value={null} allowEmpty filter={esSelectOne} placeholder="Agregar pregunta…"
                                onChange={(v) => v && onCambio(conPreguntas(variables, [...preguntas, v]))} />
              </div>
              {sinPreguntas && (
                <p className="pulso-f6-dato-ayuda is-aviso" role="status">
                  {"La lámina sale vacía: no tiene preguntas. "}
                  <PulsoButton variant="link" size="sm" onClick={() => onCambio({ vars: [comodinDelCruce(variables, cruce)] })}>
                    {`Usar las de escala de ${publicoEnFrase(baseCruce)}`}
                  </PulsoButton>
                </p>
              )}
              {deLaRegla && baseCruce && (
                <span className="pulso-f6-dato-ayuda">{`Todas las de escala de ${publicoEnFrase(baseCruce)}; la regla elige cuáles salen.`}</span>
              )}
              {!preguntas.length && !deLaRegla && !sinPreguntas && <span className="pulso-f6-dato-ayuda"><Plus size={12} aria-hidden="true" /> Preguntas con la misma escala, de la base del cruce.</span>}
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
