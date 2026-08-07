// Renombrar las columnas de una tabla comparativa, una caja por base.
//
// El valor viaja como texto `clave=Título`, una línea por columna — el mismo
// formato que `titulos_grupo` de las multiapiladas, para que el motor no aprenda
// una sintaxis nueva y el plan siga siendo legible en crudo.
//
// Pero pedirle al analista que escriba ese formato a mano es trasladarle un
// detalle de serialización: la aplicación YA sabe cuántas bases tiene el estudio
// y cómo se llaman. Aquí se muestra una caja por base, con su nombre técnico
// como etiqueta y el nombre técnico como placeholder — así se ve de un vistazo
// qué se está renombrando y qué queda como está.

import { useMemo } from "react";
import { useVariables } from "./useVariables";
import "./baseLabelsField.css";

export type BaseLabelsFieldProps = {
  value: unknown;
  onChange: (value: string) => void;
};

/** Texto `clave=Título` por línea → mapa. Lo que no matchea se ignora. */
export function parseBaseLabels(value: unknown): Record<string, string> {
  if (typeof value !== "string" || !value.trim()) return {};
  const out: Record<string, string> = {};
  for (const linea of value.split(/[\n;]/)) {
    const idx = linea.indexOf("=");
    if (idx < 0) continue;
    const clave = linea.slice(0, idx).trim();
    if (!clave) continue;
    out[clave] = linea.slice(idx + 1).trim();
  }
  return out;
}

/** Mapa → texto, saltando lo vacío: una clave sin título no renombra nada. */
export function formatBaseLabels(mapa: Record<string, string>, orden: string[]): string {
  return orden
    .filter((clave) => (mapa[clave] ?? "").trim().length > 0)
    .map((clave) => `${clave}=${mapa[clave].trim()}`)
    .join("\n");
}

export function BaseLabelsField({ value, onChange }: BaseLabelsFieldProps) {
  const { sources, loading } = useVariables();
  const bases = useMemo(() => sources.map((s) => s.name).filter(Boolean), [sources]);
  const mapa = useMemo(() => parseBaseLabels(value), [value]);

  if (loading) {
    return <div className="pulso-gv2-base-labels-empty">Leyendo las bases del estudio…</div>;
  }
  if (!bases.length) {
    // Sin bases declaradas no hay columnas que renombrar. Se dice, en vez de
    // mostrar un editor vacío que parece roto.
    return (
      <div className="pulso-gv2-base-labels-empty">
        Este estudio no tiene bases separadas, así que la tabla no tiene columnas por público.
      </div>
    );
  }

  const editar = (clave: string, texto: string) => {
    onChange(formatBaseLabels({ ...mapa, [clave]: texto }, bases));
  };

  return (
    <div className="pulso-gv2-base-labels">
      {bases.map((clave) => (
        <label key={clave} className="pulso-gv2-base-labels-row">
          <span className="pulso-gv2-base-labels-key">{clave}</span>
          <input
            type="text"
            value={mapa[clave] ?? ""}
            placeholder={clave}
            aria-label={`Nombre de la columna ${clave}`}
            onChange={(e) => editar(clave, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

export default BaseLabelsField;
