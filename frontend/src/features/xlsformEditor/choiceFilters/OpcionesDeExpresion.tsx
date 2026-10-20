// Centro de un filtro escrito como expresión (E5): la expresión tal cual y sus opciones, con las que nunca se ven
// marcadas. No se edita aquí: «Editar filtro» abre la expresión o permite cambiarla de forma.

import type { AnalisisFiltro } from "./modeloFiltros";

export function OpcionesDeExpresion({ a, resaltadas }: { a: AnalisisFiltro; resaltadas: ReadonlySet<string> }) {
  const nunca = new Set(a.diagnosticos.flatMap((d) => (d.clase === "nunca" ? d.opciones : [])));
  return (
    <div className="xcf-matriz">
      <div className="xcf-matriz__cab"><h4>Expresión</h4><span className="xcf-nota">{a.opciones.length} opciones en <code>{a.lista}</code></span></div>
      <pre className="xcf-codigo">{a.expresion}</pre>
      <div className="xcf-matriz__marco is-lista" data-qa-geometry-group="xlsform/filtros-matriz" data-qa-geometry-contract="intrinsic"
        data-qa-geometry-capacity="owned" data-qa-scroll-owner="filtros-matriz">
        <ul className="xcf-casillas is-lectura" aria-label={`Opciones de ${a.pregunta}`}>
          {a.opciones.map((o) => (
            <li key={o.codigo} data-opcion={o.codigo} className={resaltadas.has(o.codigo) ? "is-resaltada" : undefined}>
              <span className="xcf-casillas__fila" title={o.etiqueta}>
                <code>{o.codigo}</code>
                <span>{o.etiqueta}</span>
                {nunca.has(o.codigo) ? <span className="xcf-chip is-nunca is-mini">nunca visible</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
