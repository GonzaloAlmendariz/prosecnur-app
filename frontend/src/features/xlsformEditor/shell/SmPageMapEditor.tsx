import { useEffect, useState } from "react";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { SmConteo } from "./SmConteo";
import {
  buildPageLabel,
  displayQuestionRef,
  pageQuestionNames,
  pageXlsformVariableCount,
  parseQuestionList,
  questionRangeLabel,
  shouldShowManualPageQuestionsInput,
  totalCamposFormulario,
  type PageEntry,
} from "./smImportPages";
import { textoSeccionesSm } from "./smImportModel";
import "../styles/xf-sm-import.css";

// Las páginas de SurveyMonkey que se crearán como secciones. Cada sección
// muestra su conteo con el mismo par que el resto del diálogo (U8) y pliega su
// lista de preguntas: sin scroll anidado, el cuerpo del diálogo es el único
// dueño. C1: `xlsform-import-sm-secciones`, `equal`.

// Input controlado que conserva el texto crudo mientras se edita (para no
// expandir rangos a mitad de tecleo) y se sincroniza cuando el valor cambia
// desde fuera. Confirma al salir del campo.
function PageQuestionsInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string[];
  onCommit: (qs: string[]) => void;
}) {
  const externalText = value.map(displayQuestionRef).join(", ");
  const [text, setText] = useState(externalText);
  useEffect(() => {
    setText(externalText);
  }, [externalText]);

  return (
    <input
      id={id}
      type="text"
      className="pulso-xf-smi-input is-mono"
      value={text}
      placeholder="p24  o  p25-p31  o  p24, p26-p28"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseQuestionList(text);
        const reformatted = parsed.join(", ");
        if (reformatted !== externalText) onCommit(parsed);
        if (reformatted !== text) setText(reformatted);
      }}
    />
  );
}

// Las tarjetas son variantes pares (C2): todo lo que varía en largo —las
// preguntas y el texto de presentación de la página, que en la de bienvenida
// es un párrafo entero— vive dentro del desplegable, no en la tarjeta.
function textoResumen(nPreguntas: number, conPresentacion: boolean): string {
  const preguntas = nPreguntas === 1 ? "la pregunta" : `las ${nPreguntas} preguntas`;
  if (!nPreguntas) return "Ver el texto de presentación";
  return conPresentacion ? `Ver ${preguntas} y el texto de presentación` : `Ver ${preguntas}`;
}

function PreguntasDeSeccion({ page }: { page: PageEntry }) {
  const preguntas = page.questionDetails ?? [];
  const presentacion = (page.notes ?? []).map((n) => n.trim()).filter(Boolean).join("\n\n");
  if (!preguntas.length && !presentacion) {
    return <p className="pulso-xf-smi-seccion-nota">Página informativa: no tiene preguntas que importar.</p>;
  }
  return (
    <details className="pulso-xf-smi-seccion-preguntas">
      <summary>{textoResumen(preguntas.length, Boolean(presentacion))}</summary>
      {presentacion ? <p className="pulso-xf-smi-presentacion">{presentacion}</p> : null}
      {preguntas.length ? <ul>
        {preguntas.map((q) => {
          const filas = q.children ?? [];
          const esMatriz = filas.length > 1;
          return (
            <li key={q.name}>
              <span className="pulso-xf-smi-fila">
                <code>{displayQuestionRef(q.name)}</code>
                <span className="pulso-xf-smi-fila-texto">{q.heading ?? ""}</span>
                {esMatriz ? <span className="pulso-xf-smi-etiqueta">Matriz · {filas.length} filas</span> : null}
              </span>
              {esMatriz ? (
                <ul className="pulso-xf-smi-filas-matriz">
                  {filas.map((fila) => (
                    <li key={fila.name} className="pulso-xf-smi-fila">
                      <code>{fila.name}</code>
                      <span className="pulso-xf-smi-fila-texto">{fila.heading}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul> : null}
    </details>
  );
}

export function SmPageMapEditor({
  pages,
  onAdd,
  onRemove,
  onUpdate,
}: {
  pages: PageEntry[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PageEntry>) => void;
}) {
  const totalQuestions = pages.reduce((sum, p) => sum + pageQuestionNames(p).length, 0);
  const totalFields = totalCamposFormulario(pages);
  return (
    <section className="pulso-xf-smi-bloque" aria-labelledby="sm-secciones-titulo">
      <header className="pulso-xf-smi-bloque-cabecera">
        <div>
          <h3 id="sm-secciones-titulo">Secciones de la encuesta</h3>
          <p>Cada página de SurveyMonkey se crea como una sección del formulario, con el nombre que ves.</p>
        </div>
        {pages.length > 0 ? (
          <span className="pulso-xf-smi-bloque-resumen">
            <strong>{textoSeccionesSm(pages.length)}</strong>
            <SmConteo preguntas={totalQuestions} campos={totalFields} />
          </span>
        ) : null}
      </header>

      {pages.length === 0 ? (
        <p className="pulso-xf-smi-vacio">
          Aún no hay secciones. Se llenan solas al elegir la encuesta arriba.
        </p>
      ) : (
        <ol
          className="pulso-xf-smi-secciones"
          data-qa-geometry-group="xlsform-import-sm-secciones"
          data-qa-geometry-contract="equal"
        >
          {pages.map((p, idx) => {
            const label = buildPageLabel(p, idx);
            const questionCount = pageQuestionNames(p).length;
            const fieldCount = pageXlsformVariableCount(p);
            return (
              <li key={p.id} className="pulso-xf-smi-seccion" data-qa-geometry-member="">
                <div className="pulso-xf-smi-seccion-pagina">
                  <label htmlFor={`pulso-sm-page-${p.id}`}>Página</label>
                  <input
                    id={`pulso-sm-page-${p.id}`}
                    type="text"
                    className="pulso-xf-smi-input"
                    value={p.pageId}
                    placeholder="16"
                    onChange={(e) => onUpdate(p.id, { pageId: e.target.value, label: undefined })}
                  />
                </div>
                <div className="pulso-xf-smi-seccion-cuerpo">
                  <div className="pulso-xf-smi-seccion-titulo">
                    <strong>{label}</strong>
                    <button
                      type="button"
                      className="pulso-xf-smi-icono"
                      onClick={() => onRemove(p.id)}
                      aria-label={`Quitar la sección ${label}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                  <SmConteo preguntas={questionCount} campos={fieldCount} className="is-secundario" />
                  <PreguntasDeSeccion page={p} />
                  {shouldShowManualPageQuestionsInput(p) ? (
                    <div className="pulso-xf-smi-seccion-manual">
                      <label htmlFor={`pulso-sm-page-questions-${p.id}`}>
                        Preguntas de esta página (para saltos por página)
                      </label>
                      <PageQuestionsInput
                        id={`pulso-sm-page-questions-${p.id}`}
                        value={p.questions}
                        onCommit={(qs) => onUpdate(p.id, {
                          questions: qs,
                          rangeLabel: questionRangeLabel(qs),
                          label: undefined,
                        })}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" className="pulso-xf-smi-agregar" onClick={onAdd}>
        <Plus size={14} aria-hidden />
        Agregar sección a mano
      </button>
    </section>
  );
}
