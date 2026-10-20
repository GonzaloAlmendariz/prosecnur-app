// «Qué ve el encuestado» (E5): se elige la respuesta de cada pregunta de la que depende el filtro y se ve la lista
// que queda. Si la expresión no se puede evaluar, lo dice; nunca adivina.

import type { XlsformEditorSheet } from "../../../api/multiIntegrado";
import { opcionesVisibles, type AnalisisFiltro, type Entrada, type Respuestas } from "./modeloFiltros";

type Props = {
  a: AnalisisFiltro;
  choices: XlsformEditorSheet;
  respuestas: Respuestas;
  onRespuesta: (nombre: string, valor: string | string[]) => void;
  destello: boolean;
};

function Control({ e, valor, onCambio, compacto }: { e: Entrada; valor: string | string[] | undefined; onCambio: (v: string | string[]) => void; compacto: boolean }) {
  const id = `xcf-vista-${e.nombre}`;
  const rotulo = compacto
    ? <label htmlFor={id} className="xcf-vista__rot" title={`${e.nombre} · ${e.etiqueta}`}><code>{e.nombre}</code></label>
    : <label htmlFor={id} className="xcf-vista__rot"><span>{e.etiqueta}</span> <code>{e.nombre}</code></label>;
  if (!e.respuestas) {
    return <div className="xcf-vista__par" data-qa-geometry-member="">{rotulo}<input id={id} className="xcf-input" value={typeof valor === "string" ? valor : ""} placeholder="Valor de la respuesta" onChange={(x) => onCambio(x.target.value)} /></div>;
  }
  if (e.multiple) {
    const vs = Array.isArray(valor) ? valor : [];
    return (
      <div className="xcf-vista__par" data-qa-geometry-member="">
        {rotulo}
        <div id={id} className="xcf-vista__multi" role="group" aria-label={e.etiqueta}>
          {e.respuestas.map((r) => (
            <label key={r.codigo}>
              <input type="checkbox" checked={vs.includes(r.codigo)} onChange={() => onCambio(vs.includes(r.codigo) ? vs.filter((v) => v !== r.codigo) : [...vs, r.codigo])} />
              {r.etiqueta}
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="xcf-vista__par" data-qa-geometry-member="">
      {rotulo}
      <select id={id} className="xcf-input" value={typeof valor === "string" ? valor : ""} aria-label={compacto ? `Respuesta de ${e.nombre}` : undefined} onChange={(x) => onCambio(x.target.value)}>
        <option value="">Sin responder</option>
        {e.respuestas.map((r) => <option key={r.codigo} value={r.codigo}>{r.etiqueta}</option>)}
      </select>
    </div>
  );
}

export function VistaEncuestado({ a, choices, respuestas, onRespuesta, destello }: Props) {
  const visibles = opcionesVisibles(a, choices, respuestas);
  const compacto = a.entradas.length > 3;
  const multiple = a.baseType === "select_multiple";
  return (
    <section className="xcf-vista" aria-labelledby="xcf-vista-titulo">
      <h4 id="xcf-vista-titulo" className="xcf-vista__titulo">Qué ve el encuestado</h4>
      <div className={destello ? "xcf-vista__caja is-destello" : "xcf-vista__caja"}>
        {!a.evaluable ? (
          <p className="xcf-vista__sin">
            {a.estado.clase === "conflicto"
              ? "No se puede previsualizar mientras el filtro esté en conflicto."
              : !a.opciones.length ? "La lista no tiene opciones en choices." : "No se puede previsualizar esta expresión. Pruébala en «Probar»."}
          </p>
        ) : (
          <>
            {a.entradas.length ? (
              <div className={compacto ? "xcf-vista__controles is-compacto" : "xcf-vista__controles"} data-qa-geometry-group="xlsform/filtros-respuestas" data-qa-geometry-contract="intrinsic">
                {a.entradas.map((e) => <Control key={e.nombre} e={e} valor={respuestas[e.nombre]} compacto={compacto} onCambio={(v) => onRespuesta(e.nombre, v)} />)}
              </div>
            ) : <p className="xcf-nota">No depende de otra respuesta.</p>}
            <div className="xcf-vista__pregunta">{a.etiqueta}</div>
            {visibles?.length ? (
              <ul className="xcf-vista__opciones" aria-live="polite">
                {a.opciones.filter((o) => visibles.includes(o.codigo)).map((o) => (
                  <li key={o.codigo}><span className={multiple ? "xcf-vista__glifo is-cuadro" : "xcf-vista__glifo"} aria-hidden="true" />{o.etiqueta}</li>
                ))}
              </ul>
            ) : <div className="xcf-vista__vacia" aria-live="polite">La pregunta se muestra sin opciones.</div>}
            <div className="xcf-nota">{visibles?.length ?? 0} de {a.opciones.length} opciones</div>
          </>
        )}
      </div>
    </section>
  );
}
