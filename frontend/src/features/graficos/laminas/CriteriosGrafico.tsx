// Los criterios del mapa de calor por criterio (I2 del catálogo del recetario): cada criterio con su nombre y sus
// preguntas. La pestaña Gráfico no los mostraba ni los editaba; sólo el Editor anterior (`CriteriaConfigField`).
// Una pregunta que no está en el instrumento (las columnas 0–100 de Analítica, `r100_*`) se muestra con su nombre: un
// selector vacío diría «Elige una pregunta…» con la pregunta puesta.

import { useId } from "react";
import { Plus, X } from "../../../vendor/lucide-react";
import VariablePicker from "../VariablePicker";
import { parseVarRef, useVariables } from "../useVariables";

export type Criterio = { id: string; titulo: string; vars: string[] };

const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Lo guardado, como lista: el registro admite lista u objeto por nombre (`normalizeCriteriaConfig` del Editor anterior). */
export function leerCriterios(valor: unknown): Criterio[] {
  const crudos: Array<[string, unknown]> = Array.isArray(valor)
    ? valor.map((v, i) => [`Criterio ${i + 1}`, v])
    : valor && typeof valor === "object" ? Object.entries(valor as Record<string, unknown>) : [];
  return crudos.flatMap(([porDefecto, v], i) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    const titulo = typeof o.titulo === "string" ? o.titulo : porDefecto;
    const vars = (Array.isArray(o.vars) ? o.vars : typeof o.vars === "string" ? [o.vars] : []).map(String).filter(Boolean);
    const id = typeof o.id === "string" && o.id.trim() ? o.id : slug(titulo) || `criterio_${i + 1}`;
    return [{ id, titulo, vars }];
  });
}

/** Lo que se guarda: sin criterios vacíos ni preguntas repetidas; `null` si no queda ninguno. */
export function escribirCriterios(criterios: readonly Criterio[]): Criterio[] | null {
  const limpios = criterios
    .map((c, i) => ({ id: c.id.trim() || slug(c.titulo) || `criterio_${i + 1}`, titulo: c.titulo, vars: [...new Set(c.vars.filter(Boolean))] }))
    .filter((c) => c.titulo.trim() || c.vars.length);
  return limpios.length ? limpios : null;
}

export function CriteriosGrafico({ valor, onCambio }: { valor: unknown; onCambio: (v: Criterio[] | null) => void }) {
  const id = useId();
  const { variables } = useVariables();
  const criterios = leerCriterios(valor);
  const rotulo = (name: string, source?: string | null) =>
    variables.find((x) => x.name === name && (!source || x.source === source))?.label?.trim() || "";
  // `r100_<pregunta>` es la recodificación 0–100 de Analítica: se nombra por la pregunta de la que sale.
  const nombre = (ref: string) => {
    const r = parseVarRef(ref);
    const directo = rotulo(r.name, r.source);
    if (directo) return directo;
    const origen = /^r100_(.+)$/.exec(r.name)?.[1];
    const deOrigen = origen ? rotulo(origen, r.source) : "";
    return deOrigen ? `${deOrigen} (0–100)` : r.name;
  };
  const cambiar = (i: number, parche: Partial<Criterio>) => onCambio(escribirCriterios(criterios.map((c, k) => (k === i ? { ...c, ...parche } : c))));

  return (
    <div className="pulso-f6-dato is-apilado" data-qa="criterios-grafico">
      <span className="pulso-f6-dato-rotulo" id={id}>Criterios</span>
      <div className="pulso-f6-criterios" role="group" aria-labelledby={id} data-qa-geometry-group="graficos/f6-criterios" data-qa-geometry-contract="intrinsic">
        {criterios.map((c, i) => (
          <div key={`${c.id}-${i}`} className="pulso-f6-criterio">
            <div className="pulso-f6-criterio-cabecera">
              <input className="pulso-f6-input" value={c.titulo} aria-label={`Nombre del criterio ${i + 1}`} placeholder="Nombre del criterio"
                onChange={(e) => cambiar(i, { titulo: e.target.value })} />
              <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Quitar el criterio ${c.titulo || i + 1}`}
                onClick={() => onCambio(escribirCriterios(criterios.filter((_, k) => k !== i)))}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <ul className="pulso-f6-criterio-preguntas" data-qa-geometry-group="graficos/f6-criterio-preguntas" data-qa-geometry-contract="intrinsic">
              {c.vars.map((ref) => (
                <li key={ref} className="pulso-f6-criterio-pregunta">
                  <span title={ref}>{nombre(ref)}</span>
                  <button type="button" className="pulso-f6-criterio-quitar" aria-label={`Quitar ${nombre(ref)} de ${c.titulo}`}
                    onClick={() => cambiar(i, { vars: c.vars.filter((x) => x !== ref) })}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="pulso-f6-preguntas-fila is-nueva">
              <Plus size={14} aria-hidden="true" />
              <VariablePicker value={null} onChange={(v) => v && cambiar(i, { vars: [...c.vars, v] })} placeholder="Agregar pregunta…" />
            </div>
          </div>
        ))}
        <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" data-qa-geometry-capacity="owned"
          onClick={() => onCambio([...criterios, { id: `criterio_${criterios.length + 1}`, titulo: `Criterio ${criterios.length + 1}`, vars: [] }])}>
          <Plus size={14} aria-hidden="true" /> Agregar criterio
        </button>
      </div>
    </div>
  );
}
