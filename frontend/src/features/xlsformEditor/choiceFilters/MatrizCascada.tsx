// Matriz de la cascada (E5): opción × respuesta de la pregunta madre. Marcar una celda escribe la respuesta en la
// columna de la cascada (en choices); la columna «Fija» suma la opción como `or name = '…'`. La columna de la
// respuesta que tiene la vista previa queda resaltada. Encabezado y primera columna fijos; la tabla tiene su scroll.

import { useMemo, useState } from "react";
import type { XlsformEditorSheet } from "../../../api/multiIntegrado";
import { Search } from "../../../vendor/lucide-react";
import type { AnalisisFiltro, Respuesta } from "./modeloFiltros";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  a: AnalisisFiltro;
  choices: XlsformEditorSheet;
  /** Respuesta(s) que tiene ahora la vista previa en la pregunta madre. */
  actual: readonly string[];
  resaltadas: ReadonlySet<string>;
  editable: boolean;
  onMarcar: (codigo: string, respuesta: string) => void;
  onFija: (codigo: string) => void;
};

const MUCHAS_COLUMNAS = 24;
const TOPE_FILAS = 300;

export function MatrizCascada({ a, choices, actual, resaltadas, editable, onMarcar, onFija }: Props) {
  const c = a.cascada!;
  const [busca, setBusca] = useState("");
  const [todas, setTodas] = useState(false);
  const iC = choices.columns.indexOf(c.columna);
  const valoresDe = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of a.opciones) {
      const vs = new Set<string>();
      for (const f of o.filas) {
        const celda = iC < 0 ? "" : (choices.rows[f]?.[iC] ?? "").trim();
        for (const v of c.forma === "incluye" ? celda.split(/\s+/) : [celda]) if (v) vs.add(v);
      }
      m.set(o.codigo, [...vs]);
    }
    return m;
  }, [a.opciones, choices.rows, iC, c.forma]);
  const madre = a.entradas.find((e) => e.nombre === c.madre);
  const respuestas: Respuesta[] = madre?.respuestas
    ?? [...new Set([...valoresDe.values()].flat())].map((v) => ({ codigo: v, etiqueta: v }));
  const codigosMadre = new Set(respuestas.map((r) => r.codigo));
  const conOpciones = new Set([...valoresDe.values()].flat());
  const muchas = respuestas.length > MUCHAS_COLUMNAS;
  const columnas = muchas && !todas ? respuestas.filter((r) => conOpciones.has(r.codigo)) : respuestas;
  const ocultas = respuestas.length - columnas.length;
  const q = busca.trim().toLowerCase();
  const filas = q ? a.opciones.filter((o) => `${o.codigo} ${o.etiqueta}`.toLowerCase().includes(q)) : a.opciones;
  const mostradas = filas.slice(0, TOPE_FILAS);

  return (
    <div className="xcf-matriz">
      <div className="xcf-matriz__cab">
        <h4>Opción × respuesta de <code>{c.madre}</code></h4>
        <span className="xcf-nota">columna <code>{c.columna}</code></span>
      </div>
      {a.opciones.length > 12 || muchas ? (
        <div className="xcf-matriz__herr">
          <label className="xcf-busca">
            <Search size={13} aria-hidden="true" />
            <input value={busca} placeholder="Buscar opción" aria-label="Buscar opción en la matriz" onChange={(e) => setBusca(e.target.value)} />
          </label>
          {muchas && (todas || ocultas > 0) ? (
            <PulsoButton variant="ghost" size="sm" aria-pressed={todas} onClick={() => setTodas((t) => !t)}>
              {todas ? "Ocultar respuestas sin opciones" : `Ver las ${ocultas} respuestas sin opciones`}
            </PulsoButton>
          ) : null}
        </div>
      ) : null}
      <div className="xcf-matriz__marco" data-qa-geometry-group="xlsform/filtros-matriz" data-qa-geometry-contract="intrinsic"
        data-qa-geometry-capacity="owned" data-qa-scroll-owner="filtros-matriz" tabIndex={0} role="region" aria-label={`Matriz de ${a.pregunta}`}>
        <table className="xcf-mx">
          <thead>
            <tr>
              <th scope="col" className="xcf-mx__esquina">Opción de <code>{a.pregunta}</code></th>
              {columnas.map((r) => {
                const vacia = !conOpciones.has(r.codigo);
                const enVista = actual.includes(r.codigo);
                return (
                  <th key={r.codigo} scope="col" className={`${vacia ? "is-vacia" : ""}${enVista ? " is-actual" : ""}`.trim() || undefined}
                    title={`${r.etiqueta}${vacia ? " · sin opciones" : ""}`}>
                    <span className="xcf-mx__hc" title={r.codigo}>{r.codigo}</span>
                    <span className="xcf-mx__hl" title={r.etiqueta}>{r.etiqueta}</span>
                  </th>
                );
              })}
              <th scope="col" title="Se muestra siempre"><span className="xcf-mx__hc">Fija</span><span className="xcf-mx__hl">siempre</span></th>
            </tr>
          </thead>
          <tbody>
            {mostradas.map((o) => {
              const vs = valoresDe.get(o.codigo) ?? [];
              const huerfanos = vs.filter((v) => !codigosMadre.has(v));
              const fija = c.siempre.includes(o.codigo);
              return (
                <tr key={o.codigo} data-opcion={o.codigo} className={resaltadas.has(o.codigo) ? "is-resaltada" : undefined}>
                  <th scope="row">
                    <span className="xcf-mx__fila">
                      <code>{o.codigo}</code>
                      <span className="xcf-mx__op" title={o.etiqueta}>{o.etiqueta}</span>
                      {huerfanos.map((h) => <span key={h} className="xcf-chip is-nunca is-mini" title={`${c.columna} = ${h}`}>{h}</span>)}
                    </span>
                  </th>
                  {columnas.map((r) => {
                    const on = vs.includes(r.codigo);
                    return (
                      <td key={r.codigo} className={actual.includes(r.codigo) ? "is-actual" : undefined}>
                        <button type="button" className={on ? "xcf-celda is-on" : "xcf-celda"} aria-pressed={on} disabled={!editable}
                          aria-label={`${o.etiqueta} con ${r.etiqueta}`} onClick={() => onMarcar(o.codigo, r.codigo)}>
                          <span className="xcf-celda__marca" aria-hidden="true" />
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <button type="button" className={fija ? "xcf-celda is-on" : "xcf-celda"} aria-pressed={fija} disabled={!editable}
                      aria-label={`${o.etiqueta} siempre`} onClick={() => onFija(o.codigo)}>
                      <span className="xcf-celda__marca" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filas.length > TOPE_FILAS ? <p className="xcf-nota xcf-matriz__tope">Se ven {TOPE_FILAS} de {filas.length}. Busca para acotar.</p> : null}
        {!mostradas.length ? <p className="xcf-nota xcf-matriz__tope">{a.opciones.length ? "Ninguna opción coincide." : <>La lista <code>{a.lista}</code> no tiene opciones en choices.</>}</p> : null}
      </div>
    </div>
  );
}
