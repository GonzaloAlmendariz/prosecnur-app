import type { ColumnaPropia } from "../../../../api/baseVariables";
import { PulsoInput } from "../../../../components/PulsoInput";
import { formatoConteo } from "../../../../lib/formatoNumero";
import {
  ROTULO_TIPO,
  etiquetaEditada,
  type AccionColumnas,
  type BorradorColumnas,
} from "../../variablesBase/variablesBaseModel";

const OPCIONES_VISIBLES = 12;

/**
 * Una columna que la base trae fuera del formulario. Incorporada: su ficha
 * (tipo, casos con dato, opciones). Por incorporar: su etiqueta y las de sus
 * opciones se editan aquí antes de incorporarla, con el borrador de la mesa
 * para que "Incorporar las N" use lo editado.
 */
export function FichaDeColumna({
  columna: c,
  borrador,
  despachar,
}: {
  columna: ColumnaPropia;
  borrador: BorradorColumnas;
  despachar: (a: AccionColumnas) => void;
}) {
  const editable = !c.declarada;
  const opciones = c.opciones;
  return (
    <div className="pulso-variables-ficha" data-qa-geometry-group="carga/variables-ficha" data-qa-geometry-contract="intrinsic">
      <dl className="pulso-variables-dl">
        <dt>Tipo</dt>
        <dd>{ROTULO_TIPO[c.tipo]}</dd>
        <dt>Con dato</dt>
        <dd>{formatoConteo(c.n_validos)}</dd>
        <dt>{editable ? "Etiqueta" : "Etiqueta en el informe"}</dt>
        <dd>
          {editable ? (
            <PulsoInput
              size="sm"
              value={etiquetaEditada(borrador, c)}
              aria-label={`Etiqueta de ${c.name}`}
              onChange={(e) => despachar({ tipo: "etiqueta", name: c.name, valor: e.target.value })}
            />
          ) : c.label}
        </dd>
      </dl>
      {opciones.length > 0 ? (
        <section aria-labelledby={`pulso-variables-opciones-${c.name}`}>
          <h4 id={`pulso-variables-opciones-${c.name}`} className="pulso-variables-h">Opciones</h4>
          <ul className="pulso-variables-opciones">
            {(editable ? opciones : opciones.slice(0, OPCIONES_VISIBLES)).map((o) => (
              <li key={o.codigo}>
                <code>{o.codigo}</code>
                {editable && c.tipo === "select_one" ? (
                  <PulsoInput
                    size="sm"
                    value={borrador.opciones[c.name]?.[o.codigo] ?? (o.etiqueta === o.codigo ? "" : o.etiqueta)}
                    placeholder={o.codigo}
                    aria-label={`Etiqueta del código ${o.codigo} de ${c.name}`}
                    onChange={(e) => despachar({ tipo: "opcion", name: c.name, codigo: o.codigo, valor: e.target.value })}
                  />
                ) : <span>{o.etiqueta || o.codigo}</span>}
              </li>
            ))}
            {!editable && opciones.length > OPCIONES_VISIBLES ? (
              <li className="pulso-variables-nota">{`${formatoConteo(opciones.length - OPCIONES_VISIBLES)} más`}</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
