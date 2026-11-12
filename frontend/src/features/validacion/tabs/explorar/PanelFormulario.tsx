import type { ExploradorFicha } from "../../../../api/validacionExplorar";
import { FraseDelCatalogo } from "../../reglas/lista/FraseDelCatalogo";
import ChipTipo from "./ChipTipo";
import { fmtN } from "./explorarModelo";
import type { LecturaDelFormulario } from "./lecturaDelFormulario";

/**
 * E10, "En el formulario" (prototipo): tipo, opciones, cuándo aparece, si es
 * obligatoria, qué abre y su restricción, en palabras. La condición y la
 * restricción salen de la frase del catálogo de reglas, no de la expresión
 * del XLSForm. Las opciones con su código y sus casos están en "Tabla" (el
 * conmutador de la distribución), así que aquí no se repiten.
 */
export default function PanelFormulario({ ficha, lectura }: { ficha: ExploradorFicha; lectura: LecturaDelFormulario }) {
  const conOpciones = ficha.tipo === "so" || ficha.tipo === "sm";
  return (
    <dl className="vx-ficha-dl" data-qa-geometry-group="validacion/explorar-ficha-formulario" data-qa-geometry-contract="intrinsic">
      <div>
        <dt>Tipo</dt>
        <dd><ChipTipo tipo={ficha.tipo} /></dd>
      </div>
      {conOpciones && ficha.opciones.length > 0 && (
        <div>
          <dt>Opciones</dt>
          <dd>{fmtN(ficha.opciones.length)}</dd>
        </div>
      )}
      <div>
        <dt>Aparece si</dt>
        {lectura.aparece.tipo === "frase" ? (
          <dd className="vx-frase"><FraseDelCatalogo piezas={lectura.aparece.piezas} /></dd>
        ) : lectura.aparece.tipo === "siempre" ? (
          <dd>Siempre</dd>
        ) : (
          <dd className="is-vacio">Con una condición del formulario que no se pudo escribir en palabras</dd>
        )}
      </div>
      <div>
        <dt>Obligatoria</dt>
        {ficha.required === null ? <dd className="is-vacio">Sin declarar</dd> : <dd>{ficha.required ? "Sí" : "No"}</dd>}
      </div>
      {(lectura.restricciones.length > 0 || ficha.constraint_message || ficha.constraint) && (
        <div>
          <dt>Restricción</dt>
          {lectura.restricciones.length > 0 ? (
            <dd className="vx-frase">
              {lectura.restricciones.map((frase, i) => (
                <span key={i} className="vx-frase-linea"><FraseDelCatalogo piezas={frase} /></span>
              ))}
            </dd>
          ) : ficha.constraint_message ? (
            <dd>"{ficha.constraint_message}"</dd>
          ) : (
            <dd className="is-vacio">Una restricción del formulario que no se pudo escribir en palabras</dd>
          )}
        </div>
      )}
      {ficha.abre.length > 0 && (
        <div>
          <dt>Abre</dt>
          <dd>
            {ficha.abre.map((a, i) => (
              <span key={a.var}>
                {i > 0 && ", "}
                <code title={a.label}>{a.var}</code>
              </span>
            ))}
            {ficha.datos.n_otro_textos !== null && ` (${fmtN(ficha.datos.n_otro_textos)} ${ficha.datos.n_otro_textos === 1 ? "texto escrito" : "textos escritos"})`}
          </dd>
        </div>
      )}
      {ficha.hint && (
        <div>
          <dt>Ayuda</dt>
          <dd>"{ficha.hint}"</dd>
        </div>
      )}
      {ficha.version_formulario && (
        <div>
          <dt>Versión</dt>
          <dd><code>{ficha.version_formulario}</code></dd>
        </div>
      )}
    </dl>
  );
}
