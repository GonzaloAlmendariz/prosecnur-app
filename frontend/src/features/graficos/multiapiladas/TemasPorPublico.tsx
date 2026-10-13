// G12 parte 2: «Públicos por tema» como una tarjeta por tema —su nombre y una línea por público con la pregunta
// equivalente—, en lugar de «Clave», chips con la referencia cruda y bloques repetidos en cada tema. La pregunta se
// muestra por su etiqueta (la de Procesamiento) y el código pequeño; una pregunta con otra escala se marca en su línea.

import { ArrowDown, ArrowUp, Plus, X } from "../../../vendor/lucide-react";
import VariablePicker from "../VariablePicker";
import type { VarWithSource } from "../useVariables";
import { parseVarRef } from "../useVariables";

export type TemaPublicos = { key: string; title: string; vars: string[] };

type Props = {
  temas: readonly TemaPublicos[];
  publicos: readonly string[];
  variables: readonly VarWithSource[];
  onChange: (next: TemaPublicos[]) => void;
  nuevoTema: (n: number) => TemaPublicos;
};

/** El nombre de un público para leer («docentes» → «Docentes»); la clave interna no cambia. */
export const nombrePublico = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ") : p);

const buscar = (variables: readonly VarWithSource[], ref: string) => {
  const { source, name } = parseVarRef(ref);
  return variables.find((v) => v.name === name && (!source || v.source === source));
};

/** La referencia de un tema para un público (la que empieza con `publico$`). */
export function refDePublico(tema: TemaPublicos, publico: string): string {
  return tema.vars.find((r) => parseVarRef(r).source === publico) ?? "";
}

/** Pone `ref` en la línea de su público y deja las referencias en el orden de los públicos. */
export function conRef(tema: TemaPublicos, publicos: readonly string[], publico: string, ref: string | null): TemaPublicos {
  const destino = (ref && parseVarRef(ref).source) || publico;
  const porPublico = new Map(publicos.map((p) => [p, refDePublico(tema, p)]));
  porPublico.set(destino, ref ?? "");
  if (destino !== publico && !ref) porPublico.set(publico, "");
  return { ...tema, vars: publicos.map((p) => porPublico.get(p) ?? "").filter(Boolean) };
}

/** ¿La pregunta tiene otra escala que la primera del tema? */
export function otraEscala(variables: readonly VarWithSource[], tema: TemaPublicos, ref: string): boolean {
  const base = buscar(variables, tema.vars[0] ?? "")?.scale_signature;
  const esta = buscar(variables, ref)?.scale_signature;
  return !!base && !!esta && base !== esta;
}

export function TemasPorPublico({ temas, publicos, variables, onChange, nuevoTema }: Props) {
  const lista = temas.length ? temas : [nuevoTema(1)];
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= lista.length) return;
    const next = [...lista]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const n = (p: string) => Math.max(0, ...lista.map((t) => buscar(variables, refDePublico(t, p))?.n_non_empty ?? 0));
  return (
    <div className="pulso-mapi-temas">
      <p className="pulso-mapi-publicos">{publicos.map((p) => (n(p) ? `${nombrePublico(p)} · ${n(p)}` : nombrePublico(p))).join("   ")}</p>
      {lista.map((tema, i) => (
        <div key={tema.key || i} className="pulso-mapi-tarjeta">
          <div className="pulso-mapi-tema">
            <input className="pulso-f6-input" aria-label="Nombre del tema" value={tema.title} placeholder="Nombre del tema"
                   onChange={(e) => onChange(lista.map((t, j) => (j === i ? { ...t, title: e.target.value } : t)))} />
            <span className="pulso-mapi-acciones">
              <button type="button" className="pulso-f6-icono-boton" aria-label="Subir el tema" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={12} aria-hidden="true" /></button>
              <button type="button" className="pulso-f6-icono-boton" aria-label="Bajar el tema" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={12} aria-hidden="true" /></button>
              <button type="button" className="pulso-f6-icono-boton" aria-label="Quitar el tema" onClick={() => onChange(lista.filter((_, j) => j !== i))}><X size={12} aria-hidden="true" /></button>
            </span>
          </div>
          {publicos.map((p) => {
            const ref = refDePublico(tema, p);
            const distinta = ref && otraEscala(variables, tema, ref);
            return (
              <div key={p} className={`pulso-mapi-linea${distinta ? " is-aviso" : ""}`}>
                <span className="pulso-mapi-pub">{nombrePublico(p)}</span>
                <div className="pulso-mapi-pregunta">
                  <VariablePicker value={ref || null} allowEmpty placeholder="Elegir pregunta…"
                                  onChange={(v) => {
                                    const actualizado = conRef(tema, publicos, p, v);
                                    // Sin nombre todavía, el tema toma la etiqueta de su primera pregunta: es el nombre que el analista escribiría.
                                    const titulo = tema.title.trim() || (v ? buscar(variables, v)?.label ?? "" : "");
                                    onChange(lista.map((t, j) => (j === i ? { ...actualizado, title: titulo } : t)));
                                  }} />
                  {distinta && <span className="pulso-mapi-aviso">Otra escala que el resto del tema.</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <button type="button" className="pulso-f6-boton pulso-mapi-agregar" onClick={() => onChange([...lista, nuevoTema(lista.length + 1)])}>
        <Plus size={12} aria-hidden="true" /> Agregar tema
      </button>
    </div>
  );
}
