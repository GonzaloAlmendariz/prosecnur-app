// Diseño de un experimento de lista en la pestaña Experimentos (checklist elección por pares C14, 2026-11-07): la
// pregunta de conteo, las afirmaciones de control, la sensible y su lugar, y qué parte de la muestra la ve. A la
// derecha, la lista de cada grupo tal como la verá el encuestado.

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { listaInicial, listaTratamiento, validarLista, type DisenoLista } from "./modeloLista";
import "./panelConjoint.css";

export function DisenoLista({ prefijoSugerido, existente, onInsertar }: {
  prefijoSugerido: string;
  existente?: { diseno: DisenoLista; fiel: boolean; motivo: string | null } | null;
  onInsertar: (d: DisenoLista) => string[];
}) {
  const [d, setD] = useState<DisenoLista>(() => existente?.diseno ?? listaInicial(prefijoSugerido));
  const editando = Boolean(existente);
  const bloqueo = existente && !existente.fiel ? `No se puede editar desde aquí: ${existente.motivo ?? "el experimento no sigue el patrón del editor."}` : null;
  const [rechazo, setRechazo] = useState<string[]>([]);
  const problemas = useMemo(() => validarLista(d), [d]);
  const cambiar = (cambios: Partial<DisenoLista>) => setD((prev) => ({ ...prev, ...cambios }));
  /** Al quitar o agregar afirmaciones, la sensible no se sale de la lista. */
  const conControles = (controles: string[]) => setD((prev) => ({ ...prev, controles, posicion: Math.min(prev.posicion, controles.length + 1) }));
  const tratamiento = listaTratamiento(d);
  const pct = Math.round(d.probTratamiento * 100);

  return (
    <div className="xfe-conjoint-pagina">
      <div className="xfe-conjoint">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-ls-pregunta">
          <h3 id="xfe-ls-pregunta">1. Pregunta de conteo</h3>
          <p className="xfe-conjoint__explica">
            El encuestado dice cuántas afirmaciones son ciertas para él, nunca cuáles. La diferencia de promedios entre
            los dos grupos estima cuántos responderían que sí a la afirmación sensible.
          </p>
          <PulsoFieldRow geometryGroup="xlsform/lista-pregunta" className="xfe-conjoint__columna">
            <PulsoField label="Pregunta">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.pregunta} onChange={(e) => cambiar({ pregunta: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-ls-control">
          <h3 id="xfe-ls-control">2. Afirmaciones de control</h3>
          <p className="xfe-conjoint__explica">Las ven los dos grupos.</p>
          <ol className="xfe-conjoint__versiones">
            {d.controles.map((c, i) => (
              <li key={i}>
                <span className="xfe-conjoint__codigo">Afirmación {i + 1}</span>
                <PulsoInput aria-label={`Afirmación ${i + 1}`} value={c} onChange={(e) => conControles(d.controles.map((x, k) => (k === i ? e.target.value : x)))} />
                <button type="button" className="xfe-conjoint__quitar" aria-label={`Quitar la afirmación ${i + 1}`} disabled={d.controles.length <= 2} onClick={() => conControles(d.controles.filter((_, k) => k !== i))}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ol>
          <div className="xfe-conjoint__acciones">
            <button type="button" onClick={() => conControles([...d.controles, ""])} disabled={d.controles.length >= 8}>
              <Plus size={13} /> Afirmación
            </button>
          </div>
        </section>

        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-ls-sensible">
          <h3 id="xfe-ls-sensible">3. Afirmación sensible</h3>
          <PulsoFieldRow geometryGroup="xlsform/lista-sensible" className="xfe-conjoint__columna">
            <PulsoField label="Afirmación">
              <textarea className="pulso-input xfe-conjoint__texto" rows={2} value={d.sensible} onChange={(e) => cambiar({ sensible: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
          <PulsoFieldRow geometryGroup="xlsform/lista-asignacion" className="xfe-conjoint__trio">
            <PulsoField label="Lugar en la lista">
              <PulsoSelect
                ariaLabel="Lugar de la afirmación sensible"
                value={String(d.posicion)}
                onValueChange={(v) => cambiar({ posicion: Number(v) })}
                options={Array.from({ length: d.controles.length + 1 }, (_, k) => ({ value: String(k + 1), label: k === d.controles.length ? "Al final" : `${k + 1}.ª` }))}
              />
            </PulsoField>
            <PulsoField label="Muestra que la ve (%)">
              <PulsoInput numeric type="number" min={1} max={99} value={pct} onChange={(e) => cambiar({ probTratamiento: Number(e.target.value) / 100 })} />
            </PulsoField>
          </PulsoFieldRow>
        </section>

        {problemas.length || rechazo.length || bloqueo ? (
          <section className="xfe-conjoint__avisos" role="status">
            <strong>Por corregir</strong>
            <ul>
              {[...(bloqueo ? [bloqueo] : []), ...problemas, ...rechazo].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <aside className="xfe-conjoint-lateral" aria-label="Listas de cada grupo y aplicar">
        <section className="xfe-conjoint__bloque" aria-labelledby="xfe-ls-muestra">
          <h3 id="xfe-ls-muestra">Lo que ve cada grupo</h3>
          <div className="xfe-conjoint__grupo">
            <strong>Control, {100 - pct}%</strong>
            <ul>{d.controles.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="xfe-conjoint__grupo">
            <strong>Con la afirmación sensible, {pct}%</strong>
            <ul>{tratamiento.map((c, i) => <li key={i} className={i === d.posicion - 1 ? "is-sensible" : undefined}>{c}</li>)}</ul>
          </div>
          <p className="xfe-conjoint__pregunta-muestra">{d.pregunta}</p>
        </section>
        <div className="xfe-conjoint-lateral__aplicar">
          <span className="xfe-conjoint-lateral__cifras">{problemas.length ? `${problemas.length} por corregir` : "2 cálculos y 1 página"}</span>
          <button type="button" className="pulso-primary" onClick={() => setRechazo(onInsertar(d))} disabled={problemas.length > 0 || Boolean(bloqueo)}>
            {editando ? "Aplicar cambios" : "Insertar en el formulario"}
          </button>
        </div>
      </aside>
    </div>
  );
}
