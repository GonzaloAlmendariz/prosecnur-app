/**
 * La familia "Fuera de la auditoría" (D-F7c): las preguntas del formulario con
 * reglas, cada una con su interruptor. Excluir una silencia todas sus reglas y
 * pide el motivo (vara V5); devolverla no lo pide. Lo que se guarda es lo de
 * antes (`instrumento/VariablesFueraDeAuditoria.tsx`).
 */
import { useMemo, useState } from "react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { SlidersHorizontal } from "../../../../vendor/lucide-react";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { normalizeSearchText } from "../../instrumento/modeloInstrumento";
import type { InstrumentoVariablesExcluidas } from "../../types";

export type PreguntaExcluible = InstrumentoVariablesExcluidas["opciones"][number] & { excluida: boolean };

/** Excluidas primero; después las que más casos marcaron; después por código. */
export function preguntasExcluibles(excluidas: InstrumentoVariablesExcluidas | null): PreguntaExcluible[] {
  if (!excluidas) return [];
  const fuera = new Set(excluidas.variables);
  return excluidas.opciones
    .map((o) => ({ ...o, excluida: fuera.has(o.variable) }))
    .sort((a, b) => {
      if (a.excluida !== b.excluida) return a.excluida ? -1 : 1;
      const diff = (b.n_inconsistencias ?? 0) - (a.n_inconsistencias ?? 0);
      return diff !== 0 ? diff : a.variable.localeCompare(b.variable);
    });
}

export function ListaFueraDeAuditoria({
  preguntas,
  elegida,
  ocupada,
  onElegir,
  onExcluir,
}: {
  preguntas: readonly PreguntaExcluible[];
  elegida: string | null;
  ocupada: boolean;
  onElegir: (variable: string) => void;
  /** `true` pide excluirla (con motivo); `false` la devuelve a la auditoría. */
  onExcluir: (variable: string, excluir: boolean) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => {
    const q = normalizeSearchText(busqueda);
    return q ? preguntas.filter((p) => normalizeSearchText(`${p.variable} ${p.label}`).includes(q)) : preguntas;
  }, [busqueda, preguntas]);

  if (!preguntas.length) {
    return (
      <EstadoVacio
        icono={<SlidersHorizontal size={20} />}
        titulo="Sin preguntas con reglas"
        descripcion="Cuando el plan del formulario tenga reglas, sus preguntas se pueden dejar fuera de la auditoría aquí."
      />
    );
  }
  return (
    <div className="pulso-rl-fuera">
      <PulsoInput
        size="sm"
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar una pregunta"
        aria-label="Buscar una pregunta"
      />
      <ul className="pulso-rl-reglas" data-qa-geometry-group="validacion/reglas-fuera" data-qa-geometry-contract="intrinsic">
        {visibles.map((p) => (
          <li key={p.variable} className="pulso-rl-regla" data-qa-geometry-member="" data-inactiva={p.excluida ? "" : undefined}>
            <button
              type="button"
              className="pulso-rl-regla-boton"
              aria-current={p.variable === elegida ? "true" : undefined}
              onClick={() => onElegir(p.variable)}
            >
              <span className="pulso-rl-regla-nombre">{p.label || p.variable}</span>
              <span className="pulso-rl-regla-pie">
                <code className="pulso-rl-codigo">{p.variable}</code>
                <span className="pulso-rl-regla-tratamiento">
                  {formatoConteo(p.n_reglas)} {p.n_reglas === 1 ? "regla" : "reglas"}
                </span>
                <span className="pulso-rl-regla-casos">{p.excluida ? "Fuera de la auditoría" : "Se audita"}</span>
              </span>
            </button>
            <span className="pulso-rl-regla-interruptor">
              <PulsoSwitch
                size="sm"
                checked={p.excluida}
                disabled={ocupada}
                ariaLabel={`Excluir ${p.variable}`}
                onCheckedChange={(siguiente) => onExcluir(p.variable, siguiente)}
              />
            </span>
          </li>
        ))}
      </ul>
      {!visibles.length ? <p className="pulso-rl-nota">Ninguna pregunta coincide con la búsqueda.</p> : null}
    </div>
  );
}
