// Tabla del editor de equivalencias (ADR 0062, enmienda del editor).
//
// La forma la dicta el Excel que el equipo ya usaba, porque es la que se lee
// bien: una fila por pregunta y los públicos en paralelo. Se lee de corrido y
// se ve de un golpe en cuántos públicos existe cada pregunta.
//
// La lógica vive en `equivalenciasEditorModel`; aquí sólo hay render y eventos.

import { Check, Plus, Sparkles, Trash2 } from "../../vendor/lucide-react";
import type { VariableDeBase } from "../../api/equivalencias";
import type { FilaEditor } from "./equivalenciasEditorModel";
import { ArmonizacionIndicador } from "./ArmonizacionFilaEditor";
import { CoberturaBases } from "./CoberturaBases";
import { nombreDeSerieDeBases } from "./nombreDeSerie";
import { anchoColumnaPublico, anchoMinimoLista } from "./equivalenciasAnchos";
import { useDesbordeHorizontal } from "./useDesbordeHorizontal";
import { PulsoButton } from "../../components/PulsoButton";

export type EquivalenciasTablaProps = {
  bases: string[];
  filas: FilaEditor[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  onAsignar: (filaId: string, base: string, variable: string) => void;
  onEditar: (filaId: string, campo: "etiqueta_estandar" | "seccion" | "diapositiva", valor: string) => void;
  onQuitar: (filaId: string) => void;
  onConfirmar: (filaId: string) => void;
  onAgregarFila: () => void;
  /** Abre el editor de armonización con el `foco` de la fila. Sin él, no hay indicador. */
  onArmonizar?: (foco: string) => void;
};

function textoVariable(opciones: readonly VariableDeBase[], valor: string): string {
  if (!valor) return "";
  const v = opciones.find((o) => o.name === valor);
  return v ? `${v.name} · ${v.label}` : valor;
}

export function EquivalenciasTabla({
  bases,
  filas,
  variablesPorBase,
  onAsignar,
  onEditar,
  onQuitar,
  onConfirmar,
  onAgregarFila,
  onArmonizar,
}: EquivalenciasTablaProps) {
  const [marcoRef, desborda] = useDesbordeHorizontal();
  const serie = nombreDeSerieDeBases(bases);
  const minimo = anchoMinimoLista(bases.length);
  return (
    <div className="pulso-equiv-tabla-wrap">
      {/* `table-layout: fixed` con columnas declaradas: el reparto lo decide el
          rol de cada columna y no el texto más largo que traiga una fila. La tabla
          tiene un ancho mínimo que crece con las bases y, si no cabe, el marco
          se vuelve el dueño del desplazamiento horizontal con la etiqueta fija. */}
      <div
        ref={marcoRef}
        className={desborda ? "pulso-equiv-hscroll is-desborda" : "pulso-equiv-hscroll"}
        data-scroll-axis={desborda ? "x" : undefined}
        role={desborda ? "region" : undefined}
        aria-label={desborda ? `Lista de equivalencias, ${bases.length} bases, desplázate a la derecha para ver todas` : undefined}
        tabIndex={desborda ? 0 : undefined}
      >
      <table className="pulso-equiv-tabla" style={{ minWidth: `${minimo}px` }}>
        <colgroup>
          <col />
          <col className="pulso-equiv-col-diapo" />
          {bases.map((base) => (
            <col key={base} style={{ width: anchoColumnaPublico() }} />
          ))}
          <col className="pulso-equiv-col-n" />
          <col className="pulso-equiv-col-acciones" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="pulso-equiv-col-etiqueta">Etiqueta estándar</th>
            <th scope="col" className="pulso-equiv-col-diapo">Diapositiva</th>
            {bases.map((base) => (
              <th key={base} scope="col">{base}</th>
            ))}
            <th scope="col" className="pulso-equiv-col-n">Bases</th>
            <th scope="col"><span className="pulso-sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className={fila.sugerida ? "is-sugerida" : undefined}>
              <td>
                <div className="pulso-equiv-celda-etiqueta">
                  {/* La marca de propuesta va en la fila y también aquí: si sólo
                      estuviera en el color, una fila sugerida y una decidida se
                      leerían igual en una captura o con poco contraste. */}
                  {fila.sugerida && (
                    <span className="pulso-equiv-chip-sugerida" title="Propuesta del sistema: revísala y confírmala">
                      <Sparkles size={11} aria-hidden="true" />
                      Propuesta
                    </span>
                  )}
                  <input
                    value={fila.etiqueta_estandar}
                    title={fila.etiqueta_estandar || undefined}
                    placeholder="Cómo se llama esta pregunta en el informe"
                    aria-label={`Etiqueta estándar de la fila ${fila.id}`}
                    onChange={(e) => onEditar(fila.id, "etiqueta_estandar", e.target.value)}
                  />
                  {onArmonizar && <ArmonizacionIndicador fila={fila} serie={serie} onAbrir={onArmonizar} />}
                </div>
              </td>
              <td>
                <input
                  className="pulso-equiv-input-diapo"
                  value={fila.diapositiva ?? ""}
                  placeholder="—"
                  aria-label={`Diapositiva de la fila ${fila.id}`}
                  onChange={(e) => onEditar(fila.id, "diapositiva", e.target.value)}
                />
              </td>
              {bases.map((base) => {
                const opciones = variablesPorBase[base] ?? [];
                const valor = fila.variables[base] ?? "";
                return (
                  <td key={base}>
                    <select
                      value={valor}
                      title={textoVariable(opciones, valor) || undefined}
                      aria-label={`Variable de ${base} en la fila ${fila.id}`}
                      onChange={(e) => onAsignar(fila.id, base, e.target.value)}
                    >
                      <option value="">—</option>
                      {opciones.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} · {v.label.slice(0, 70)}
                        </option>
                      ))}
                    </select>
                  </td>
                );
              })}
              <td className="pulso-equiv-col-n">
                <CoberturaBases bases={bases} variables={fila.variables} />
              </td>
              <td>
                <div className="pulso-equiv-acciones-fila">
                  {fila.sugerida && (
                    <button
                      type="button"
                      className="pulso-icon"
                      title="Confirmar esta propuesta"
                      aria-label="Confirmar propuesta"
                      onClick={() => onConfirmar(fila.id)}
                    >
                      <Check size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="pulso-icon pulso-icon-danger"
                    title="Quitar la fila"
                    aria-label="Quitar fila"
                    onClick={() => onQuitar(fila.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <PulsoButton variant="secondary" className="pulso-equiv-btn" onClick={onAgregarFila}>
        <Plus size={14} aria-hidden="true" />
        Añadir pregunta
      </PulsoButton>
    </div>
  );
}
