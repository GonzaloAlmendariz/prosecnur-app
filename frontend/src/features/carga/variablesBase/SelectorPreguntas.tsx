// Buscadores de preguntas de una base para las variables calculadas (ADR 0106).
// Mismo patrón que el indicador compuesto (ADR 0105): se escribe lo que dice la
// pregunta, se muestran ocho resultados y el resto se alcanza afinando la
// búsqueda (sin scroll propio). Usa las clases `pulso-compuesto-*`.

import { useState } from "react";
import type { VariableDeBase } from "../../../api/equivalencias";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Plus, Search, X } from "../../../vendor/lucide-react";
import { opcionesDeAyuda, parsearCodigos, resultadosBusqueda, type AccionCompuesto } from "../indicadorCompuestoModel";
import { etiquetaLegible } from "../preguntaEquivalenteModel";
import "../IndicadorCompuestoEditor.css";

function Buscador({
  opciones,
  elegidas,
  etiqueta,
  onElegir,
}: {
  opciones: readonly VariableDeBase[];
  elegidas: readonly string[];
  etiqueta: string;
  onElegir: (nombre: string) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const { visibles, resto } = resultadosBusqueda(opciones, consulta, elegidas);
  return (
    <div className="pulso-compuesto-busqueda">
      <label className="pulso-compuesto-buscar">
        <Search size={13} aria-hidden="true" />
        <span className="pulso-sr-only">{etiqueta}</span>
        <input type="search" value={consulta} placeholder="Buscar por texto o código" onChange={(e) => setConsulta(e.target.value)} />
      </label>
      {consulta.trim() && (
        visibles.length === 0 ? (
          <p className="pulso-armon-nota">Ninguna pregunta casa con «{consulta.trim()}».</p>
        ) : (
          <ul className="pulso-compuesto-resultados" aria-label="Resultados">
            {visibles.map((o) => (
              <li key={o.name}>
                <button
                  type="button"
                  onClick={() => { onElegir(o.name); setConsulta(""); }}
                  aria-label={`Elegir ${etiquetaLegible(o.label) || o.name} (${o.name})`}
                >
                  <Plus size={12} aria-hidden="true" />
                  <code>{o.name}</code>
                  <span className="pulso-compuesto-etiqueta">{etiquetaLegible(o.label)}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {resto > 0 && <p className="pulso-armon-nota">{formatoConteo(resto)} más: afina la búsqueda.</p>}
    </div>
  );
}

/** Regla «alguna»: varias preguntas y los códigos que cuentan como «sí». */
export function PreguntasAlguna({
  opciones,
  variables,
  codigosTexto,
  despachar,
}: {
  opciones: readonly VariableDeBase[];
  variables: readonly string[];
  codigosTexto: string;
  despachar: (a: AccionCompuesto) => void;
}) {
  // `base` es obligatorio en la acción del compuesto; aquí hay una sola base.
  const base = "";
  const codigos = parsearCodigos(codigosTexto);
  const ayuda = opcionesDeAyuda(opciones, variables);
  const etiquetaDe = (nombre: string) => etiquetaLegible(opciones.find((o) => o.name === nombre)?.label);
  return (
    <div className="pulso-vb-bloque" role="group" aria-label="Preguntas y códigos «sí»">
      {variables.length === 0 ? (
        <p className="pulso-armon-vacio">Busca las preguntas que forman la variable.</p>
      ) : (
        <ul className="pulso-compuesto-elegidas" aria-label="Preguntas elegidas">
          {variables.map((v) => (
            <li key={v}>
              <code>{v}</code>
              {etiquetaDe(v) && <span className="pulso-compuesto-etiqueta">{etiquetaDe(v)}</span>}
              <button
                type="button"
                className="pulso-icon pulso-icon-danger"
                aria-label={`Quitar ${v}`}
                onClick={() => despachar({ tipo: "quitar", base, variable: v })}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Buscador
        opciones={opciones}
        elegidas={variables}
        etiqueta="Buscar pregunta"
        onElegir={(variable) => despachar({ tipo: "agregar", base, variable })}
      />
      {variables.length > 0 && (
        <div className="pulso-compuesto-codigos">
          <label className="pulso-compuesto-campo">
            <span>Códigos «sí»</span>
            <input
              value={codigosTexto}
              inputMode="numeric"
              aria-invalid={codigos.length === 0 || undefined}
              onChange={(e) => despachar({ tipo: "codigos", base, valor: e.target.value })}
            />
          </label>
          {ayuda.length > 0 && (
            <div className="pulso-compuesto-ayuda" role="group" aria-label={`Opciones de ${variables[0]}`}>
              {ayuda.map((o) => (
                <button
                  key={o.codigo}
                  type="button"
                  className="pulso-compuesto-opcion"
                  aria-pressed={codigos.includes(o.codigo)}
                  onClick={() => despachar({ tipo: "alternar-codigo", base, codigo: o.codigo })}
                >
                  <code>{o.codigo}</code> {o.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Regla «recodificar»: una sola pregunta, con lista de respuestas. */
export function PreguntaOrigen({
  opciones,
  variable,
  onElegir,
}: {
  opciones: readonly VariableDeBase[];
  variable: string;
  onElegir: (nombre: string) => void;
}) {
  const conLista = opciones.filter((o) => (o.opciones?.length ?? 0) > 0);
  const elegida = opciones.find((o) => o.name === variable);
  if (variable) {
    return (
      <ul className="pulso-compuesto-elegidas" aria-label="Pregunta que se recodifica">
        <li>
          <code>{variable}</code>
          <span className="pulso-compuesto-etiqueta">{etiquetaLegible(elegida?.label)}</span>
          <button type="button" className="pulso-vb-enlace" onClick={() => onElegir("")}>Cambiar</button>
        </li>
      </ul>
    );
  }
  if (conLista.length === 0) {
    return <p className="pulso-armon-nota">La base no tiene preguntas con lista de respuestas.</p>;
  }
  return <Buscador opciones={conLista} elegidas={[]} etiqueta="Buscar la pregunta que se recodifica" onElegir={onElegir} />;
}
