/**
 * La columna "Decisión" de Hallazgos (prototipo `decHall`, `vistas.js:163`):
 * "Sobre qué casos" (segmentado), "Tratamiento" (opciones con su descripción y
 * la marca "Previsto"), "Motivo" y el pie con el efecto previsto, "Omitir" y
 * "Guardar y seguir ⌘ ↵".
 *
 * Lo que el prototipo no dibuja va dentro del mismo contenedor (causa 2):
 * a qué casos llega la decisión (D-F2 y D-F3), el campo de valor de "Corregir"
 * o "Asignar" bajo la opción elegida, por qué una decisión lista no se aplica,
 * los casos nuevos con "Incluir casos nuevos", la línea de la decidida con
 * "Eliminar la decisión" y, si la regla tiene más de una, sus decisiones.
 */
import { useState, type Dispatch, type SetStateAction } from "react";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PieConEfecto } from "../../../components/procesamiento/PieConEfecto";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { Dialog } from "../../../components/Dialog";
import { teclaMod } from "../../../lib/teclado";
import type { LimpiezaDecision } from "../types";
import { renderActionSpecificFields } from "../limpieza/CamposDeAccion";
import { actionNeedsVariable, formatDateTime, humanizeAction, type ChoiceOption, type EditorForm } from "../limpieza/modeloLimpieza";
import { ROTULO_FICHA_FISICA, esFichaFisica } from "./fichaFisica";
import type { LineaDeEfecto, OpcionDeTratamiento } from "./modeloHallazgos";

/** La tecla de guardar según el sistema (lib/teclado): Cmd en macOS, Ctrl en Windows. */
function teclaDeGuardar(): string {
  return `${teclaMod()} ↵`;
}

export type AlcanceDeDecision = {
  titulo: string;
  todos: string;
  marcados: string;
  /** La decisión es sobre todos los casos de la regla. */
  todosElegido: boolean;
  /** "Dejar como está" cubre la regla entera: no se elige. */
  bloqueado: boolean;
  onCambiar: (todos: boolean) => void;
  /** A qué casos llega, en una línea (D-F2 y D-F3). */
  linea: string;
};

export type AvisosDeDecision = {
  /** "Decidida el 3 mar: motivo"; `null` si no hay decisión lista. */
  decidida: string | null;
  noAplicable: string | null;
  casosNuevos: { texto: string; ids: string[] } | null;
  yaNoMarca: string | null;
};

export function Decision({
  opciones,
  elegida,
  onElegir,
  tituloOpciones,
  alcance,
  form,
  setForm,
  variables,
  etiquetas,
  choiceOptions,
  numerica,
  avisos,
  efecto,
  efectoOcupado,
  causaNoGuardar,
  guardando,
  onGuardar,
  onOmitir,
  hayOtro,
  decisionLista,
  onIncluirCasosNuevos,
  onEliminar,
  decisiones,
  decisionAbierta,
  onAbrirDecision,
  marcaDeFicha = null,
}: {
  opciones: readonly OpcionDeTratamiento[];
  elegida: string | null;
  onElegir: (opcion: OpcionDeTratamiento) => void;
  tituloOpciones: string;
  alcance: AlcanceDeDecision;
  form: EditorForm;
  setForm: Dispatch<SetStateAction<EditorForm>>;
  variables: readonly string[];
  etiquetas: Readonly<Record<string, string>>;
  choiceOptions: ChoiceOption[];
  /** La pregunta que cambia es numérica: los ejemplos de los campos son cifras. */
  numerica: boolean;
  avisos: AvisosDeDecision;
  efecto: LineaDeEfecto;
  efectoOcupado: boolean;
  /** Por qué no se puede guardar todavía; `null` si se puede. */
  causaNoGuardar: string | null;
  guardando: boolean;
  onGuardar: () => void;
  onOmitir: () => void;
  /** Queda otro hallazgo por decidir al que pasar. */
  hayOtro: boolean;
  decisionLista: LimpiezaDecision | null;
  onIncluirCasosNuevos: (d: LimpiezaDecision) => void;
  onEliminar: (d: LimpiezaDecision) => void;
  decisiones: readonly LimpiezaDecision[];
  decisionAbierta: LimpiezaDecision | null;
  onAbrirDecision: (id: string) => void;
  /** La decisión abierta es una marca de "Revisar con la ficha física": su línea y la decisión que se elimina. */
  marcaDeFicha?: { texto: string; decision: LimpiezaDecision } | null;
}) {
  const [confirmar, setConfirmar] = useState<LimpiezaDecision | null>(null);
  const necesitaPregunta = actionNeedsVariable(form.action_type) && variables.length > 1;
  const alcanceOpciones = [
    { valor: "todos", rotulo: alcance.todos },
    { valor: "marcados", rotulo: alcance.marcados },
  ] as const;

  return (
    <PanelDeMesa
      zona="decision"
      titulo="Decisión"
      etiquetaCuerpo="Decisión del hallazgo"
      pie={(
        <PieConEfecto
          className="pulso-hz-pie"
          cifra={efecto.cifra}
          efecto={(
            <>
              <span aria-busy={efectoOcupado || undefined} data-midiendo={efectoOcupado ? "" : undefined}>{efecto.texto}</span>
              {/* Por qué no se puede guardar, a la vista y no solo en el título del botón (si el efecto no lo dice ya). */}
              {causaNoGuardar && causaNoGuardar !== efecto.texto ? <span className="pulso-hz-causa">{causaNoGuardar}</span> : null}
            </>
          )}
        >
          <PulsoButton variant="secondary" size="lg" disabled={guardando || !hayOtro} onClick={onOmitir}>
            Omitir
          </PulsoButton>
          <PulsoButton
            variant="primary"
            size="lg"
            className="pulso-hz-guardar"
            disabled={guardando || !!causaNoGuardar}
            title={causaNoGuardar ?? undefined}
            onClick={onGuardar}
          >
            {hayOtro ? "Guardar y seguir" : "Guardar"}
            <kbd aria-hidden="true">{teclaDeGuardar()}</kbd>
          </PulsoButton>
        </PieConEfecto>
      )}
    >
      <div className="pulso-hz-decision" data-qa-geometry-group="validacion/hallazgos-decision" data-qa-geometry-contract="intrinsic">
        {avisos.decidida || avisos.noAplicable || avisos.casosNuevos || avisos.yaNoMarca || marcaDeFicha ? (
          <div className="pulso-hz-avisos">
            {marcaDeFicha ? (
              <p className="pulso-hz-decidida">
                <span>{marcaDeFicha.texto}</span>
                <PulsoButton variant="link" size="sm" disabled={guardando} onClick={() => setConfirmar(marcaDeFicha.decision)}>
                  Eliminar la decisión
                </PulsoButton>
              </p>
            ) : null}
            {avisos.decidida && decisionLista ? (
              <p className="pulso-hz-decidida">
                <span>{avisos.decidida}</span>
                <PulsoButton variant="link" size="sm" disabled={guardando} onClick={() => setConfirmar(decisionLista)}>
                  Eliminar la decisión
                </PulsoButton>
              </p>
            ) : null}
            {avisos.noAplicable ? <p className="pulso-hz-aviso" data-tono="aviso">{avisos.noAplicable}</p> : null}
            {avisos.casosNuevos && decisionLista ? (
              <div className="pulso-hz-aviso" data-tono="aviso" role="status">
                <p>{avisos.casosNuevos.texto}</p>
                <p className="pulso-hz-aviso-ids">{avisos.casosNuevos.ids.join(", ")}</p>
                <PulsoButton variant="secondary" size="sm" disabled={guardando} onClick={() => onIncluirCasosNuevos(decisionLista)}>
                  Incluir casos nuevos
                </PulsoButton>
              </div>
            ) : null}
            {avisos.yaNoMarca ? <p className="pulso-hz-aviso">{avisos.yaNoMarca}</p> : null}
          </div>
        ) : null}

        <section className="pulso-hz-bloque" aria-labelledby="pulso-hz-sobre">
          <h5 id="pulso-hz-sobre">{alcance.titulo}</h5>
          <GlidingRadioGroup<(typeof alcanceOpciones)[number], string>
            className="pulso-regla-segmentado pulso-regla-segmentado--ancho pulso-hz-segmentado"
            aria-labelledby="pulso-hz-sobre"
            value={alcance.todosElegido || alcance.bloqueado ? "todos" : "marcados"}
            options={alcanceOpciones}
            getOptionValue={(o) => o.valor}
            onValueChange={(v) => alcance.onCambiar(v === "todos")}
            getOptionProps={(o, { checked }) => ({
              className: checked ? "is-on" : undefined,
              disabled: alcance.bloqueado && o.valor === "marcados",
            })}
          >
            {(o) => o.rotulo}
          </GlidingRadioGroup>
          <p className="pulso-hz-alcance">{alcance.linea}</p>
        </section>

        <section className="pulso-hz-bloque" aria-labelledby="pulso-hz-que">
          <h5 id="pulso-hz-que">{tituloOpciones}</h5>
          <GlidingRadioGroup<OpcionDeTratamiento, string>
            className="pulso-hz-opciones"
            aria-labelledby="pulso-hz-que"
            orientation="vertical"
            value={elegida ?? ""}
            options={opciones}
            getOptionValue={(o) => o.clave}
            onValueChange={(clave) => {
              const opcion = opciones.find((o) => o.clave === clave);
              if (opcion && !opcion.deshabilitada) onElegir(opcion);
            }}
            getOptionProps={(o, { checked }) => ({
              className: ["pulso-hz-opcion", checked ? "is-on" : ""].filter(Boolean).join(" "),
              disabled: !!o.deshabilitada,
              title: o.deshabilitada,
            })}
          >
            {(o) => (
              <>
                <i aria-hidden="true" />
                <span className="pulso-hz-opcion-texto">
                  <span className="pulso-hz-opcion-titulo">
                    {o.titulo}
                    {o.prevista ? <em className="pulso-hz-previsto" title="Tratamiento previsto en la regla">Previsto</em> : null}
                  </span>
                  <small>{o.deshabilitada ?? o.detalle}</small>
                  {o.situacion && !o.deshabilitada ? <small className="pulso-hz-opcion-situacion">{o.situacion}</small> : null}
                </span>
              </>
            )}
          </GlidingRadioGroup>
          {necesitaPregunta ? (
            <label className="pulso-hz-campo">
              <span>Pregunta</span>
              <PulsoSelect
                value={form.target_variable}
                ariaLabel="Pregunta que cambia"
                onValueChange={(v) => setForm((f) => ({ ...f, target_variable: v }))}
                options={variables.map((v) => ({ value: v, label: etiquetas[v] ? `${etiquetas[v]} (${v})` : v, textValue: etiquetas[v] ?? v }))}
              />
            </label>
          ) : null}
          {form.action_type !== "ignore_rule" && form.action_type !== "exclude_cases" && form.action_type !== "nullify_fields" ? (
            <div className="pulso-hz-campos">{renderActionSpecificFields(form, setForm, choiceOptions, numerica)}</div>
          ) : null}
        </section>

        <section className="pulso-hz-bloque" aria-labelledby="pulso-hz-motivo">
          <h5 id="pulso-hz-motivo">Motivo</h5>
          <textarea
            className="pulso-input pulso-hz-motivo"
            aria-labelledby="pulso-hz-motivo"
            rows={3}
            value={form.rationale}
            onChange={(e) => {
              const rationale = e.target.value;
              setForm((f) => ({ ...f, rationale }));
            }}
          />
        </section>

        {decisiones.length > 1 ? (
          <section className="pulso-hz-bloque" aria-labelledby="pulso-hz-decisiones">
            <h5 id="pulso-hz-decisiones">Decisiones de esta regla</h5>
            <ul className="pulso-hz-historial">
              {decisiones.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="pulso-hz-historial-fila"
                    aria-current={decisionAbierta?.id === d.id ? "true" : undefined}
                    onClick={() => onAbrirDecision(d.id)}
                  >
                    <span>{esFichaFisica(d) ? ROTULO_FICHA_FISICA : humanizeAction(d.action_type)}</span>
                    <small>{d.status === "ready" ? "Lista" : esFichaFisica(d) ? "Pendiente" : "Borrador"}, {formatDateTime(d.updated_at)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <Dialog
        open={confirmar !== null}
        onOpenChange={(abierto) => { if (!abierto) setConfirmar(null); }}
        title="Eliminar la decisión"
        tono="peligro"
        footer={(
          <>
            <PulsoButton variant="secondary" onClick={() => setConfirmar(null)}>Cancelar</PulsoButton>
            <PulsoButton
              variant="danger"
              onClick={() => {
                if (confirmar) onEliminar(confirmar);
                setConfirmar(null);
              }}
            >
              Eliminar
            </PulsoButton>
          </>
        )}
      >
        <p className="pulso-hz-confirmar">El hallazgo vuelve a quedar por decidir. Los datos de la base no cambian hasta cerrar la base.</p>
      </Dialog>
    </PanelDeMesa>
  );
}
