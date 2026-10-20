// Filtro fijo como lista (E5): las opciones con casillas y buscador. Marcar escribe el valor en la columna del filtro
// (o reescribe las opciones nombradas); el choice_filter de una columna no cambia. Reemplaza la «expresión combinada».

import { useState } from "react";
import type { XlsformEditorSheet } from "../../../api/multiIntegrado";
import { Search } from "../../../vendor/lucide-react";
import { opcionesVisibles, type AnalisisFiltro } from "./modeloFiltros";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  a: AnalisisFiltro;
  choices: XlsformEditorSheet;
  editable: boolean;
  onMarcar: (codigos: string[], visibles: boolean) => void;
};

const TOPE = 400;

export function ListaFija({ a, choices, editable, onMarcar }: Props) {
  const [busca, setBusca] = useState("");
  const marcadas = new Set(opcionesVisibles(a, choices, {}) ?? []);
  const q = busca.trim().toLowerCase();
  const filas = q ? a.opciones.filter((o) => `${o.codigo} ${o.etiqueta}`.toLowerCase().includes(q)) : a.opciones;
  const codigos = filas.map((o) => o.codigo);
  const todasMarcadas = codigos.length > 0 && codigos.every((c) => marcadas.has(c));
  const regla = a.fijo?.forma === "columna" ? <>marcadas con <code>{a.fijo.valor}</code> en <code>{a.fijo.columna}</code></> : <>nombradas en la expresión</>;
  return (
    <div className="xcf-matriz">
      <div className="xcf-matriz__cab">
        <h4>Opciones que se muestran</h4>
        <span className="xcf-nota">{marcadas.size} de {a.opciones.length} · {regla}</span>
      </div>
      <div className="xcf-matriz__herr">
        <label className="xcf-busca">
          <Search size={13} aria-hidden="true" />
          <input value={busca} placeholder="Buscar opción" aria-label="Buscar opción" onChange={(e) => setBusca(e.target.value)} />
        </label>
        {editable && codigos.length ? (
          <PulsoButton variant="ghost" size="sm" onClick={() => onMarcar(codigos, !todasMarcadas)}>
            {todasMarcadas ? `Desmarcar ${q ? "las " + codigos.length : "todas"}` : `Marcar ${q ? "las " + codigos.length : "todas"}`}
          </PulsoButton>
        ) : null}
      </div>
      <div className="xcf-matriz__marco is-lista" data-qa-geometry-group="xlsform/filtros-matriz" data-qa-geometry-contract="intrinsic"
        data-qa-geometry-capacity="owned" data-qa-scroll-owner="filtros-matriz">
        <ul className="xcf-casillas" aria-label={`Opciones de ${a.pregunta}`}>
          {filas.slice(0, TOPE).map((o) => {
            const on = marcadas.has(o.codigo);
            return (
              <li key={o.codigo} data-opcion={o.codigo}>
                <label className={on ? "is-on" : undefined} title={o.etiqueta}>
                  <input type="checkbox" checked={on} disabled={!editable} onChange={() => onMarcar([o.codigo], !on)} />
                  <code>{o.codigo}</code>
                  <span>{o.etiqueta}</span>
                </label>
              </li>
            );
          })}
          {!filas.length ? <li className="xcf-nota">Ninguna opción coincide.</li> : null}
        </ul>
        {filas.length > TOPE ? <p className="xcf-nota xcf-matriz__tope">Se ven {TOPE} de {filas.length}. Busca para acotar.</p> : null}
      </div>
    </div>
  );
}
