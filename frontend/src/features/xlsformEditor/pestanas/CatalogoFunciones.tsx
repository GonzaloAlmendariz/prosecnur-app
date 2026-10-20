import { useMemo, useState } from "react";
import type { LogicScope } from "../logic";
import { describeExpression } from "../canvas/reglasHumanas";
import { PanelCard } from "../kit";
import { buscarFunciones, FUNCIONES, type Funcion } from "./catalogoModelo";

// Catálogo de funciones XLSForm para escribir cálculos (revamp E6, 2026-10-16). Un clic inserta la función en el
// cursor de la fórmula; la ayuda de abajo sigue a la función que se señala o se enfoca, sin insertar nada.

export function CatalogoFunciones({ scope, onInsertar }: { scope: LogicScope; onInsertar?: (f: Funcion) => void }) {
  const [busca, setBusca] = useState("");
  const [elegida, setElegida] = useState("if");
  const visibles = useMemo(() => buscarFunciones(busca), [busca]);
  const grupos = [...new Set(visibles.map((f) => f.grupo))];
  const actual = FUNCIONES.find((f) => f.id === elegida) ?? FUNCIONES[0]!;
  return (
    <aside className="xfp-catalogo" aria-label="Funciones para cálculos">
      <PanelCard title="Funciones" meta={`${FUNCIONES.length}`} flush fill>
        <div className="xfp-catalogo__busca">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar función" aria-label="Buscar función" />
        </div>
        <div className="xfp-catalogo__lista" data-qa-geometry-group="xlsform/catalogo-funciones" data-qa-geometry-contract="intrinsic">
          {grupos.map((g) => (
            <div key={g} className="xfp-catalogo__grupo">
              <span className="xfp-catalogo__gtit">{g}</span>
              {visibles.filter((f) => f.grupo === g).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={f.id === actual.id ? "xfp-fn is-on" : "xfp-fn"}
                  title={onInsertar ? `Insertar ${f.id} en la fórmula` : undefined}
                  aria-label={onInsertar ? `Insertar ${f.id}` : f.id}
                  onMouseEnter={() => setElegida(f.id)}
                  onFocus={() => setElegida(f.id)}
                  onClick={() => { setElegida(f.id); onInsertar?.(f); }}
                >
                  <code>{f.id}</code>
                </button>
              ))}
            </div>
          ))}
          {visibles.length === 0 ? <p className="xfp-nota xfp-nota--pad">Ninguna función coincide.</p> : null}
        </div>
      </PanelCard>
      <PanelCard title={actual.firma} flush>
        <div className="xfp-catalogo__doc" aria-live="polite">
          <p>{actual.hace}</p>
          <span className="xfk-over">Ejemplo</span>
          <code className="xfp-catalogo__ej">{actual.ejemplo}</code>
          <span className="xfp-catalogo__lee">{describeExpression(actual.ejemplo, scope).summary}</span>
        </div>
      </PanelCard>
    </aside>
  );
}
