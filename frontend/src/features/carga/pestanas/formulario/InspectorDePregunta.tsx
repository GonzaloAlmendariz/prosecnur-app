import { ArrowRight, FileText } from "../../../../vendor/lucide-react";
import type { Pregunta } from "../../../../api/client";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { PreviewQuestionCard } from "../../../xlsformEditor/canvas/PreviewQuestionCard";
import { typeLabel } from "../../../xlsformEditor/parsing/parseType";
import { toBuilderNode, toChoiceItems } from "../../PreguntasPanel";
import { condicionEnPalabras, esCalculada, preguntasQueAbre, tituloDePregunta } from "./formularioModel";

const OPCIONES_VISIBLES = 8;

/**
 * La pregunta elegida (prototipo "carga-formulario", columna derecha): su
 * ficha (tipo, obligatoria, restricción, ayuda, opciones o cálculo), cuándo
 * aparece y qué preguntas abre; debajo, cómo se ve en la encuesta.
 *
 * El prototipo dibuja abajo "En los datos" (debieron responder, respondieron,
 * textos distintos, codificación): la estructura del formulario no trae esas
 * cuentas, así que ese bloque es un hueco declarado y aquí va la vista previa
 * que antes abría el detalle de la pregunta.
 */
export function InspectorDePregunta({ pregunta, todas }: { pregunta: Pregunta | null; todas: readonly Pregunta[] }) {
  if (!pregunta) {
    return (
      <PanelDeMesa zona="inspector" titulo="Pregunta">
        <EstadoVacio tamano="compacto" icono={<FileText size={15} />} titulo="Elige una pregunta de la tabla" />
      </PanelDeMesa>
    );
  }
  const calculada = esCalculada(pregunta);
  const aparece = condicionEnPalabras(pregunta.relevant_expr, todas);
  const restriccion = condicionEnPalabras(pregunta.constraint_expr, todas);
  const abre = preguntasQueAbre(pregunta, todas);
  const opciones = pregunta.choices ?? [];
  return (
    <PanelDeMesa
        zona="inspector"
        titulo={tituloDePregunta(pregunta)}
        etiquetaCuerpo={`Ficha de ${pregunta.name}`}
      >
        <div className="pulso-formulario-ficha" data-qa-geometry-group="carga/formulario-ficha" data-qa-geometry-contract="intrinsic" data-huecos-del-motor='"En los datos" (debieron responder, respondieron, textos distintos, codificación): la estructura no trae esas cuentas'>
          <dl className="pulso-formulario-dl">
            <dt>Tipo</dt>
            <dd>{calculada ? "Calculada" : typeLabel(pregunta.tipo)}{pregunta.list_name ? <code> {pregunta.list_name}</code> : null}</dd>
            {calculada ? null : (
              <>
                <dt>Obligatoria</dt>
                <dd>{pregunta.required ? "Sí: la encuesta no se puede finalizar sin ella" : "No"}</dd>
                <dt>Restricción</dt>
                <dd>{restriccion ?? "Ninguna"}</dd>
                <dt>Texto de ayuda</dt>
                <dd>{pregunta.hint ? `"${pregunta.hint}"` : "Ninguno"}</dd>
              </>
            )}
            {calculada && pregunta.calculation_expr ? (<><dt>Cálculo</dt><dd><code>{pregunta.calculation_expr}</code></dd></>) : null}
            {pregunta.choice_filter_expr ? (<><dt>Filtro de opciones</dt><dd>{condicionEnPalabras(pregunta.choice_filter_expr, todas)}</dd></>) : null}
            {opciones.length > 0 ? (
              <>
                <dt>Opciones</dt>
                <dd>
                  <ul className="pulso-formulario-opciones">
                    {opciones.slice(0, OPCIONES_VISIBLES).map((o) => <li key={o.name}><code>{o.name}</code><span>{o.label}</span></li>)}
                    {opciones.length > OPCIONES_VISIBLES ? (
                      <li className="pulso-formulario-opciones-resto">{`${formatoConteo(opciones.length - OPCIONES_VISIBLES)} más`}</li>
                    ) : null}
                  </ul>
                </dd>
              </>
            ) : null}
          </dl>
          <section className="pulso-formulario-ruta" aria-labelledby="pulso-formulario-aparece">
            <h4 id="pulso-formulario-aparece">Aparece si</h4>
            {aparece ? (
              <p className="pulso-formulario-cadena"><span>{aparece}</span></p>
            ) : <p className="pulso-formulario-cadena"><span>Siempre</span></p>}
          </section>
          <section className="pulso-formulario-ruta" aria-labelledby="pulso-formulario-abre">
            <h4 id="pulso-formulario-abre">Abre</h4>
            {abre.length > 0 ? (
              <ul className="pulso-formulario-abre">
                {abre.map((p) => (
                  <li key={p.name}><ArrowRight size={12} aria-hidden="true" /><code>{p.name}</code><span>{p.label}</span></li>
                ))}
              </ul>
            ) : <p className="pulso-formulario-cadena"><span>Ninguna pregunta depende de esta</span></p>}
          </section>
          <section className="pulso-formulario-ruta pulso-formulario-vista" aria-labelledby="pulso-formulario-vista">
            <h4 id="pulso-formulario-vista">Cómo se ve en la encuesta</h4>
            <PreviewQuestionCard node={toBuilderNode(pregunta)} choices={toChoiceItems(pregunta)} position={pregunta.row_index} />
          </section>
        </div>
      </PanelDeMesa>
  );
}
