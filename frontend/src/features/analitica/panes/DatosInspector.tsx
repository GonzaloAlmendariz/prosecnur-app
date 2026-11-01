// Inspector de Analítica › Datos (L28, D-L28).
//
// La tabla deja una fila por variable; lo que no cabe en 36 px vive aquí: los
// avisos de redacción de la etiqueta, la cobertura con su motivo, de qué
// pregunta es opción un dummy, «Restaurar» y las etiquetas de opciones con su
// conteo. La variable llega por `?foco=`: el inspector no guarda selección.

import { RotateCcw, Tags, X } from "lucide-react";
import type { DataReviewVariable } from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { describirCobertura } from "../coberturaVariable";
import { AvisosEtiqueta } from "./revisionEtiquetas/AvisosEtiqueta";
import { opcionesEquivalentes, problemasDeEtiqueta, type ProblemaEtiqueta } from "./revisionEtiquetas/detectorEtiquetas";
import { textoDeCobertura, tipoDeFila } from "./datosColumnas";

export type DatosInspectorProps = {
  variable: DataReviewVariable | null;
  /** La sección de la variable está oculta. */
  bloqueada: boolean;
  incluida: boolean;
  tieneDummies: boolean;
  etiqueta: string;
  etiquetaDeOpcion: (code: string) => string;
  editables: boolean;
  hayCambios: boolean;
  onSetVariableLabel: (name: string, label: string) => void;
  onSetValueLabel: (name: string, code: string, label: string) => void;
  onResetVariable: (name: string) => void;
  onCerrar: () => void;
};

export function DatosInspector(props: DatosInspectorProps) {
  const { variable } = props;
  if (!variable) {
    return (
      <aside className="pulso-datos-inspector" aria-label="Inspector de la variable">
        <EstadoVacio
          icono={<Tags size={15} />}
          titulo="Elige una variable"
          descripcion="Sus etiquetas de opciones, su cobertura y los avisos de redacción se abren aquí."
        />
      </aside>
    );
  }

  const cobertura = describirCobertura(variable, props.tieneDummies);
  const opciones = variable.opciones.map((o) => ({ ...o, etiqueta: props.etiquetaDeOpcion(o.code) }));
  const equivalentes = props.editables
    ? opcionesEquivalentes(opciones.map((o) => ({ code: o.code, label: o.etiqueta })))
    : new Map<string, ProblemaEtiqueta>();
  const padre = variable.dummy_parent ?? "";
  const padreEtiqueta = variable.dummy_parent_label?.trim() || padre;

  return (
    <aside className="pulso-datos-inspector" aria-label={`Inspector de ${variable.name}`}>
      <header className="pulso-datos-inspector-head">
        <div className="pulso-datos-inspector-titulo">
          <code>{variable.name}</code>
          <span>{tipoDeFila(variable)} · {props.bloqueada ? "sección oculta" : props.incluida ? "incluida" : "excluida"}</span>
        </div>
        <PulsoButton variant="icon" size="sm" onClick={props.onCerrar} aria-label="Cerrar el inspector" title="Cerrar">
          <X size={14} aria-hidden="true" />
        </PulsoButton>
      </header>

      <section className="pulso-datos-inspector-bloque" aria-label="Pregunta">
        <label className="pulso-datos-inspector-campo">
          <span>Etiqueta de pregunta</span>
          <input
            type="text"
            value={props.etiqueta}
            onChange={(e) => props.onSetVariableLabel(variable.name, e.target.value)}
            className={`pulso-data-review-input${props.etiqueta.trim() ? "" : " is-empty"}`}
            aria-label={`Etiqueta de pregunta de ${variable.name}`}
          />
        </label>
        <AvisosEtiqueta
          problemas={problemasDeEtiqueta(props.etiqueta)}
          onAplicar={(t) => props.onSetVariableLabel(variable.name, t)}
        />
        <p className="pulso-datos-inspector-nota" data-estado={cobertura.estado}>
          {cobertura.aviso ? <strong>{cobertura.aviso.etiqueta}. </strong> : null}
          {cobertura.aviso ? cobertura.aviso.detalle : `Con dato: ${textoDeCobertura(cobertura.texto)}.`}
        </p>
        {padre ? (
          <p className="pulso-datos-inspector-nota" title={padreEtiqueta}>
            Pertenece a <code>{padre}</code> · {variable.dummy_option_label?.trim() || props.etiqueta}
          </p>
        ) : null}
        {props.hayCambios ? (
          <PulsoButton
            variant="ghost"
            size="sm"
            onClick={() => props.onResetVariable(variable.name)}
            aria-label={`Restaurar etiquetas originales de ${variable.name}`}
            title="Restaurar las etiquetas originales de esta variable"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Restaurar
          </PulsoButton>
        ) : null}
      </section>

      <section className="pulso-datos-inspector-bloque pulso-datos-inspector-opciones" aria-label="Etiquetas de opciones">
        <h3>
          <Tags size={14} aria-hidden="true" />
          Etiquetas de opciones
        </h3>
        {props.editables ? (
          // `intrinsic`: una opción con avisos de redacción crece de alto.
          <div
            className="pulso-data-review-option-list"
            data-qa-geometry-group="analitica/datos-opciones"
            data-qa-geometry-contract="intrinsic"
          >
            {opciones.map((option) => {
              const avisos = [
                ...problemasDeEtiqueta(option.etiqueta, { esOpcion: true }),
                ...(equivalentes.get(option.code) ? [equivalentes.get(option.code)!] : []),
              ];
              return (
                <div key={`${variable.name}-${option.code}`} className="pulso-data-review-option-row">
                  <code className="pulso-data-review-option-code">{option.code}</code>
                  <input
                    type="text"
                    value={option.etiqueta}
                    onChange={(e) => props.onSetValueLabel(variable.name, option.code, e.target.value)}
                    className={`pulso-data-review-input${option.etiqueta.trim() ? "" : " is-empty"}`}
                    aria-label={`Etiqueta de ${variable.name} código ${option.code}`}
                  />
                  <span className="pulso-data-review-option-count">n={formatoConteo(option.count)}</span>
                  <AvisosEtiqueta problemas={avisos} onAplicar={(t) => props.onSetValueLabel(variable.name, option.code, t)} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="pulso-datos-inspector-nota">Esta variable no tiene opciones que etiquetar.</p>
        )}
      </section>
    </aside>
  );
}
