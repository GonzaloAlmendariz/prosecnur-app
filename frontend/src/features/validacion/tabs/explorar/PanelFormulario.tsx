import { useState } from "react";
import type { ExploradorFicha } from "../../../../api/validacionExplorar";
import { fmtN } from "./explorarModelo";
import { formatoConteo } from "../../../../lib/formatoNumero";

const OPCIONES_VISIBLES = 12;

function Valor({ texto, vacio, mono = false }: { texto: string | null; vacio: string; mono?: boolean }) {
  if (!texto) return <dd className="is-vacio">{vacio}</dd>;
  return <dd>{mono ? <span className="vx-mono">{texto}</span> : texto}</dd>;
}

/**
 * E10 — «En el formulario»: lo que el instrumento dice de la pregunta. Lee la
 * ficha tal cual; lo que no viene se dice («ninguna»), no se inventa.
 */
export default function PanelFormulario({ ficha }: { ficha: ExploradorFicha }) {
  const [todas, setTodas] = useState(false);
  const tipo = [ficha.tipo_xlsform, ficha.tipo_xlsform?.includes(ficha.lista ?? "") ? null : ficha.lista]
    .filter(Boolean)
    .join(" ");
  const opciones = todas ? ficha.opciones : ficha.opciones.slice(0, OPCIONES_VISIBLES);
  return (
    <section className="vx-panel" aria-label="En el formulario">
      <div className="vx-panel-cab">
        <h4>En el formulario</h4>
        {ficha.version_formulario && <span className="vx-mono">versión {ficha.version_formulario}</span>}
      </div>
      <div className="vx-enunciado">
        <span>{ficha.label}</span>
        {ficha.hint && <span>Ayuda: «{ficha.hint}»</span>}
      </div>
      <dl className="vx-dl">
        <dt>Tipo</dt>
        <Valor texto={tipo || null} vacio="sin declarar" mono />
        <dt>Grupo</dt>
        <Valor
          texto={ficha.grupo ? (ficha.grupo.label !== ficha.grupo.name ? `${ficha.grupo.name} (${ficha.grupo.label})` : ficha.grupo.name) : null}
          vacio="ninguno"
        />
        <dt>Aparece si</dt>
        <Valor texto={ficha.relevant} vacio="siempre" mono />
        <dt>Restricción</dt>
        {ficha.constraint ? (
          <dd>
            <span className="vx-mono">{ficha.constraint}</span>
            {ficha.constraint_message && <>: «{ficha.constraint_message}»</>}
          </dd>
        ) : (
          <dd className="is-vacio">ninguna</dd>
        )}
        <dt>Obligatoria</dt>
        <Valor texto={ficha.required === null ? null : ficha.required ? "Sí" : "No"} vacio="sin declarar" />
        <dt>Filtro de opciones</dt>
        <Valor texto={ficha.choice_filter} vacio="ninguno" mono />
        {ficha.appearance && (
          <>
            <dt>Apariencia</dt>
            <Valor texto={ficha.appearance} vacio="" mono />
          </>
        )}
        {ficha.abre.length > 0 && (
          <>
            <dt>Abre</dt>
            <dd>
              {ficha.abre.map((a, i) => (
                <span key={a.var}>
                  {i > 0 && ", "}
                  <span className="vx-mono" title={a.label}>{a.var}</span>
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
      {ficha.opciones.length > 0 && (
        <>
          <div className="vx-opciones" role="table" aria-label="Opciones de la lista">
            <div role="row">
              <span role="columnheader">Código</span>
              <span role="columnheader">Opción</span>
              <span role="columnheader">n</span>
            </div>
            {opciones.map((o) => (
              <div key={o.codigo} role="row">
                <span role="cell" className="vx-mono">{o.codigo}</span>
                <span role="cell">{o.etiqueta}</span>
                <span role="cell">{fmtN(o.n)}</span>
              </div>
            ))}
          </div>
          {ficha.opciones.length > OPCIONES_VISIBLES && (
            <button type="button" className="vx-ver-mas" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
              {todas ? "Ver menos" : `Ver las ${formatoConteo(ficha.opciones.length)} opciones`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
