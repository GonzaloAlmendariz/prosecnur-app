// Ficha de solo lectura de una pregunta en «Vista del cuestionario»: se despliega bajo la pregunta elegida y su
// única salida al Constructor es «Editar en Constructor». Escape la cierra (lo maneja la pregunta que la abre).

import { renderMarkdownInline } from "../helpers/markdown";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { fichaDePregunta } from "./modeloFicha";
import type { PreguntaDoc } from "./modeloCuestionario";

function Texto({ texto }: { texto: string }) {
  // renderMarkdownInline escapa el texto y sólo emite el subconjunto de marcas del editor.
  return <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(texto) }} />;
}

export function idFicha(name: string): string {
  return `xf-cue-ficha-${name.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

export function FichaPregunta({ pregunta, onEditar }: { pregunta: PreguntaDoc; onEditar: (name: string) => void }) {
  const ficha = fichaDePregunta(pregunta);
  const id = idFicha(ficha.variable);
  return (
    <section id={id} className="pulso-xf-ficha pulso-xf-cue-ficha" aria-labelledby={`${id}-titulo`}>
      <h4 id={`${id}-titulo`} className="pulso-xf-ficha-titulo">Ficha de la pregunta {ficha.numero}</h4>
      <dl className="pulso-xf-ficha-datos">
        <dt>Tipo</dt>
        <dd>{ficha.tipo}</dd>
        <dt>Variable</dt>
        <dd><code>{ficha.variable}</code></dd>
        <dt>Obligatoria</dt>
        <dd>{ficha.obligatoria ? "Sí" : "No"}</dd>
        <dt>Aparece</dt>
        <dd>{ficha.condicion ? <>Si {ficha.condicion}</> : "Siempre"}</dd>
        {ficha.lista && (
          <>
            <dt>Opciones</dt>
            <dd>
              <code>{ficha.lista.nombre}</code>
              {" · "}
              {ficha.lista.opciones.length === 0
                ? "La lista no existe en la hoja de opciones"
                : `${ficha.lista.opciones.length} ${ficha.lista.opciones.length === 1 ? "opción" : "opciones"}`}
              {ficha.lista.opciones.length > 0 && (
                <ul className="pulso-xf-ficha-lista">
                  {/* Con choice_filter una lista repite códigos (uno por filtro): la clave lleva la posición. */}
                  {ficha.lista.opciones.map((o, i) => (
                    <li key={`${o.codigo}-${i}`}><code>{o.codigo}</code><Texto texto={o.etiqueta} /></li>
                  ))}
                </ul>
              )}
            </dd>
          </>
        )}
        <dt>Restricción</dt>
        <dd>
          {!ficha.restriccion ? "Ninguna" : ficha.restriccion.tecnica ? (
            <>
              Formato validado (ver regla)
              <code className="pulso-xf-ficha-regla">{ficha.restriccion.texto}</code>
            </>
          ) : ficha.restriccion.texto}
          {ficha.mensajeRestriccion && <p className="pulso-xf-ficha-nota">Mensaje: «{ficha.mensajeRestriccion}»</p>}
        </dd>
      </dl>
      <EditarEnConstructor onEditar={() => onEditar(ficha.variable)} describedBy={`${id}-titulo`} />
    </section>
  );
}
