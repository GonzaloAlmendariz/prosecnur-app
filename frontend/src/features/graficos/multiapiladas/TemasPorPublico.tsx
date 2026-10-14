// G12 parte 2: «Públicos por tema» como una tarjeta por tema —su nombre y una línea por público con la pregunta
// equivalente—, en lugar de «Clave», chips con la referencia cruda y bloques repetidos en cada tema. La pregunta se
// muestra por su etiqueta (la de Procesamiento) y el código pequeño; una pregunta con otra escala se marca en su línea.

// P20: la matriz de equivalencias sugiere la pregunta de cada público vacío y la lámina decide (enmienda al ADR 0103).

import { ArrowDown, ArrowUp, Link2, Plus, X } from "../../../vendor/lucide-react";
import VariablePicker from "../VariablePicker";
import type { VarWithSource } from "../useVariables";
import { parseVarRef } from "../useVariables";
import { buscar, conRef, nombrePublico, refDePublico, otraEscala, type TemaPublicos } from "./temasPublicos";
import { aplicablesEnLote, SIN_MATRIZ, sugerenciasDeTema, type FuentesMatriz, type SugerenciaPublico } from "./sugerenciasMatriz";

export { conRef, nombrePublico, otraEscala, refDePublico, type TemaPublicos };

type Props = {
  temas: readonly TemaPublicos[];
  publicos: readonly string[];
  variables: readonly VarWithSource[];
  onChange: (next: TemaPublicos[]) => void;
  nuevoTema: (n: number) => TemaPublicos;
  /** Lo que la matriz de equivalencias sabe; sin matriz no se sugiere nada. */
  matriz?: FuentesMatriz;
  /** Tipos de pregunta que ofrece el selector (radar, brecha y serie sólo aceptan opción única). */
  filtroTipo?: (tipo: string) => boolean;
};

function ChipSugerencia({ s, publico, variables, onAplicar }: { s: SugerenciaPublico; publico: string; variables: readonly VarWithSource[]; onAplicar: () => void }) {
  const v = buscar(variables, s.ref);
  const codigo = v?.name ?? s.ref;
  const etiqueta = v?.label || s.etiquetaEstandar;
  const prefijo = s.fuerza === "matriz" ? "Equivalente según tu matriz" : "Parece la misma pregunta";
  const nombre = `${prefijo} para ${nombrePublico(publico)}: ${codigo}${etiqueta ? ` · ${etiqueta}` : ""}${s.otraEscala ? " (otra escala)" : ""}. Usarla`;
  return (
    <button type="button" className={`pulso-mapi-sugerencia is-${s.fuerza}${s.otraEscala ? " is-otra-escala" : ""}`}
            aria-label={nombre} title={nombre} onClick={onAplicar}>
      {s.fuerza === "matriz" && <Link2 size={12} aria-hidden="true" />}
      <span className="pulso-mapi-sugerencia-texto">
        {prefijo}: <code>{codigo}</code>{etiqueta ? ` · ${etiqueta}` : ""}
      </span>
      {s.otraEscala && <span className="pulso-mapi-sugerencia-escala">otra escala</span>}
    </button>
  );
}

export function TemasPorPublico({ temas, publicos, variables, onChange, nuevoTema, matriz = SIN_MATRIZ, filtroTipo }: Props) {
  const lista = temas.length ? temas : [nuevoTema(1)];
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= lista.length) return;
    const next = [...lista]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const n = (p: string) => Math.max(0, ...lista.map((t) => buscar(variables, refDePublico(t, p))?.n_non_empty ?? 0));
  return (
    <div className="pulso-mapi-temas">
      <p className="pulso-mapi-publicos">{publicos.map((p) => (n(p) ? `${nombrePublico(p)} · ${n(p)}` : nombrePublico(p))).join("   ")}</p>
      {lista.map((tema, i) => {
        const sugerencias = sugerenciasDeTema(tema, publicos, variables, matriz);
        const lote = aplicablesEnLote(sugerencias);
        const reemplazar = (t: TemaPublicos) => onChange(lista.map((x, j) => (j === i ? t : x)));
        const aplicar = (aplicadas: readonly SugerenciaPublico[]) => {
          const actualizado = aplicadas.reduce((t, s) => conRef(t, publicos, parseVarRef(s.ref).source ?? "", s.ref), tema);
          // Sin nombre todavía, el tema toma la etiqueta estándar de la matriz: es el nombre que el analista ya escribió allí.
          const titulo = tema.title.trim() || aplicadas.find((s) => s.etiquetaEstandar)?.etiquetaEstandar || "";
          reemplazar({ ...actualizado, title: titulo });
        };
        return (
        <div key={tema.key || i} className="pulso-mapi-tarjeta">
          <div className="pulso-mapi-tema">
            <input className="pulso-f6-input" aria-label="Nombre del tema" value={tema.title} placeholder="Nombre del tema"
                   onChange={(e) => onChange(lista.map((t, j) => (j === i ? { ...t, title: e.target.value } : t)))} />
            <span className="pulso-mapi-acciones">
              {lote.length > 0 && (
                <button type="button" className="pulso-f6-boton pulso-mapi-completar" onClick={() => aplicar(lote)}
                        aria-label={`Completar con la matriz ${lote.length === 1 ? "el público vacío" : `los ${lote.length} públicos vacíos`} de ${tema.title.trim() || "este tema"}`}>
                  <Link2 size={12} aria-hidden="true" /> Completar con la matriz
                </button>
              )}
              <button type="button" className="pulso-f6-icono-boton" aria-label="Subir el tema" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={12} aria-hidden="true" /></button>
              <button type="button" className="pulso-f6-icono-boton" aria-label="Bajar el tema" disabled={i === lista.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={12} aria-hidden="true" /></button>
              <button type="button" className="pulso-f6-icono-boton" aria-label="Quitar el tema" onClick={() => onChange(lista.filter((_, j) => j !== i))}><X size={12} aria-hidden="true" /></button>
            </span>
          </div>
          {publicos.map((p) => {
            const ref = refDePublico(tema, p);
            const distinta = ref && otraEscala(variables, tema, ref);
            const sugerida = ref ? undefined : sugerencias[p];
            return (
              <div key={p} className={`pulso-mapi-linea${distinta ? " is-aviso" : ""}`}>
                <span className="pulso-mapi-pub">{nombrePublico(p)}</span>
                <div className="pulso-mapi-pregunta">
                  {sugerida && <ChipSugerencia s={sugerida} publico={p} variables={variables} onAplicar={() => aplicar([sugerida])} />}
                  <VariablePicker value={ref || null} allowEmpty ocultarBase placeholder="Elegir pregunta…" filter={filtroTipo}
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
        );
      })}
      <button type="button" className="pulso-f6-boton pulso-mapi-agregar" onClick={() => onChange([...lista, nuevoTema(lista.length + 1)])}>
        <Plus size={12} aria-hidden="true" /> Agregar tema
      </button>
    </div>
  );
}
