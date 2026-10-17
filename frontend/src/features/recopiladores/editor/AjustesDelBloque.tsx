import type { CollectionMaterialBlock, CollectionMaterialField } from "../../../api/recopiladores";
import { Segmented } from "../../xlsformEditor/kit";
import { X } from "../../../vendor/lucide-react";
import {
  BINDING_OPTIONS,
  bindingLabel,
  materialFieldBinding,
  opcionesDeBinding,
} from "../bloquesDeMaterial";
import { ajustesVisibles, type ClaveDeAjuste, type PropiedadEditable } from "./modeloAjustes";

type Props = {
  /** La cara del bloque: `block_id` sólo es único dentro de ella. */
  pageId: string;
  block: CollectionMaterialBlock;
  /** Lo que el layout declara que cambia la tinta (`zone.editable`). */
  editable: readonly string[];
  onCambiar: (patch: Partial<CollectionMaterialBlock>) => void;
};

const CORRECCIONES = [
  { value: "L", label: "Baja" },
  { value: "M", label: "Media" },
  { value: "Q", label: "Alta" },
  { value: "H", label: "Máxima" },
] as const;

const ALINEACIONES = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
] as const;
type Alineacion = (typeof ALINEACIONES)[number]["value"];

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function entero(valor: string): number | null {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : null;
}

function Numero({ id, valor, min, max, onCambiar }: {
  id: string;
  valor: unknown;
  min: number;
  max: number;
  onCambiar: (n: number) => void;
}) {
  return (
    <input
      id={id}
      className="rec-ed-control rec-ed-control--numero"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={typeof valor === "number" ? valor : typeof valor === "string" ? valor : ""}
      onChange={(event) => {
        const n = entero(event.target.value);
        if (n !== null) onCambiar(n);
      }}
    />
  );
}

/** Un id de HTML no admite espacios: cara y bloque vienen de la receta. */
function segmentoDeId(valor: string): string {
  return valor.trim().replace(/\s+/g, "_") || "_";
}

/**
 * El id del control de un ajuste: único por cara, bloque y propiedad (el
 * `block_id` se repite entre frente y dorso).
 */
export function idDeAjuste(pageId: string, blockId: string, propiedad: PropiedadEditable): string {
  return `rec-ed-ajuste-${segmentoDeId(pageId)}-${segmentoDeId(blockId)}-${propiedad}`;
}

/** Los campos de la unidad que ofrece la grilla: los que ya trae y los habituales. */
function camposOfrecidos(fields: readonly CollectionMaterialField[]): string[] {
  const salida: string[] = [];
  for (const field of fields) {
    const binding = materialFieldBinding(field);
    if (binding && !salida.includes(binding)) salida.push(binding);
  }
  for (const binding of BINDING_OPTIONS) {
    if (binding.startsWith("unit.") && !salida.includes(binding)) salida.push(binding);
  }
  return salida;
}

type Fila = { fields: Array<Record<string, unknown>> };

function filasDe(rows: unknown): Fila[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    fields: esRegistro(row) && Array.isArray(row.fields) ? row.fields.filter(esRegistro) : [],
  }));
}

/**
 * Los ajustes que de verdad cambian la tinta en este layout, y sólo esos. Una
 * propiedad que el dibujante ignora no se ofrece: moverla no cambiaría nada en
 * el papel.
 */
export function AjustesDelBloque({ pageId, block, editable, onCambiar }: Props) {
  const claves = ajustesVisibles(block.type, editable);
  if (!claves.length) return null;
  const id = (clave: ClaveDeAjuste) => idDeAjuste(pageId, block.block_id, clave.propiedad);

  const control = (clave: ClaveDeAjuste) => {
    switch (clave.propiedad) {
      case "text":
        return (
          <textarea
            id={id(clave)}
            className="rec-ed-control"
            rows={block.type === "status_tag" ? 1 : 3}
            maxLength={block.type === "status_tag" ? 24 : undefined}
            value={typeof block.text === "string" ? block.text : ""}
            onChange={(event) => onCambiar({ text: event.target.value })}
          />
        );
      case "binding":
        return (
          <select
            id={id(clave)}
            className="rec-ed-control"
            value={block.binding ?? ""}
            onChange={(event) => onCambiar({ binding: event.target.value })}
          >
            {opcionesDeBinding(block.binding).map((binding) => (
              <option key={binding} value={binding}>{bindingLabel(binding)}</option>
            ))}
          </select>
        );
      case "max_lines":
        return <Numero id={id(clave)} valor={block.max_lines} min={1} max={12} onCambiar={(n) => onCambiar({ max_lines: n })} />;
      case "correction":
        return (
          <select
            id={id(clave)}
            className="rec-ed-control"
            value={typeof block.correction === "string" ? block.correction : "M"}
            onChange={(event) => onCambiar({ correction: event.target.value })}
          >
            {CORRECCIONES.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
          </select>
        );
      case "quiet_zone":
        return <Numero id={id(clave)} valor={block.quiet_zone ?? 4} min={4} max={12} onCambiar={(n) => onCambiar({ quiet_zone: n })} />;
      case "max_height_mm":
        return <Numero id={id(clave)} valor={block.max_height_mm ?? 14} min={8} max={30} onCambiar={(n) => onCambiar({ max_height_mm: n })} />;
      case "align": {
        const actual = (typeof block.align === "string" ? block.align : "center") as Alineacion;
        return (
          <Segmented<Alineacion>
            aria-label="Alineación de los logos"
            size="sm"
            value={actual}
            options={ALINEACIONES}
            onChange={(align) => onCambiar({ align })}
          />
        );
      }
      case "assets": {
        const assets = Array.isArray(block.assets) ? block.assets.filter((a): a is string => typeof a === "string") : [];
        return (
          <ul className="rec-ed-logos">
            {assets.map((asset) => (
              <li key={asset}>
                <span>{asset}</span>
                <button
                  type="button"
                  className="rec-ed-icono"
                  aria-label={`Quitar el logo ${asset}`}
                  disabled={assets.length <= 1}
                  onClick={() => onCambiar({ assets: assets.filter((a) => a !== asset) })}
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        );
      }
      case "fields": {
        const fields = block.fields ?? [];
        return (
          <div className="rec-ed-checks" role="group" aria-labelledby={`${id(clave)}-rotulo`}>
            {camposOfrecidos(fields).map((binding) => {
              const marcado = fields.some((field) => materialFieldBinding(field) === binding);
              return (
                <label key={binding} className="rec-ed-check">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(event) => onCambiar({
                      fields: event.target.checked
                        ? [...fields, binding]
                        : fields.filter((field) => materialFieldBinding(field) !== binding),
                    })}
                  />
                  {bindingLabel(binding)}
                </label>
              );
            })}
          </div>
        );
      }
      case "rows":
        if (block.type === "application_log") {
          return <Numero id={id(clave)} valor={block.rows ?? 3} min={1} max={6} onCambiar={(n) => onCambiar({ rows: n })} />;
        }
        return (
          <div className="rec-ed-renglones" data-qa-geometry-group="material-editor-renglones" data-qa-geometry-contract="equal" role="group" aria-labelledby={`${id(clave)}-rotulo`}>
            {filasDe(block.rows).map((fila, i) => (
              <div key={i} className="rec-ed-renglon">
                {fila.fields.map((cell, j) => (
                  <input
                    key={j}
                    className="rec-ed-control"
                    aria-label={`Rótulo del campo ${j + 1} del renglón ${i + 1}`}
                    value={typeof cell.label === "string" ? cell.label : ""}
                    onChange={(event) => {
                      const filas = filasDe(block.rows).map((f, fi) => (fi !== i ? f : {
                        fields: f.fields.map((c, cj) => (cj === j ? { ...c, label: event.target.value } : c)),
                      }));
                      onCambiar({ rows: filas });
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      case "labels": {
        const total = typeof block.rows === "number" ? block.rows : 3;
        const labels = Array.isArray(block.labels) ? block.labels.map((l) => (typeof l === "string" ? l : "")) : [];
        return (
          <div className="rec-ed-renglones" data-qa-geometry-group="material-editor-renglones" data-qa-geometry-contract="equal" role="group" aria-labelledby={`${id(clave)}-rotulo`}>
            {Array.from({ length: total }, (_, i) => (
              <input
                key={i}
                className="rec-ed-control"
                aria-label={`Rótulo del renglón ${i + 1}`}
                value={labels[i] ?? ""}
                onChange={(event) => {
                  const siguiente = Array.from({ length: Math.max(labels.length, i + 1) }, (_, k) => (k === i ? event.target.value : labels[k] ?? ""));
                  // Las etiquetas vacías del final no viajan: el registro las numera.
                  while (siguiente.length && !siguiente[siguiente.length - 1].trim()) siguiente.pop();
                  onCambiar({ labels: siguiente });
                }}
              />
            ))}
          </div>
        );
      }
    }
  };

  return (
    // C1: cada ajuste es un control distinto (texto, número, lista): intrinsic.
    <section
      className="rec-ed-ajustes"
      aria-label="Ajustes del bloque"
      data-qa-geometry-group="material-editor-ajustes"
      data-qa-geometry-contract="intrinsic"
    >
      <span className="rec-ed-sobre">Ajustes</span>
      {claves.map((clave) => {
        const agrupa = clave.propiedad === "fields" || clave.propiedad === "assets"
          || clave.propiedad === "labels" || clave.propiedad === "align"
          || (clave.propiedad === "rows" && block.type !== "application_log");
        return (
          <div key={clave.propiedad} className="rec-ed-ajuste">
            {agrupa ? (
              <span className="rec-ed-ajuste-rotulo" id={`${id(clave)}-rotulo`}>{clave.rotulo}</span>
            ) : (
              <label className="rec-ed-ajuste-rotulo" htmlFor={id(clave)}>{clave.rotulo}</label>
            )}
            {control(clave)}
          </div>
        );
      })}
    </section>
  );
}
