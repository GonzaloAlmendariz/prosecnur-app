// Matriz del filtro por opción (E5): opción × pregunta que la habilita. Una celda marcada lleva el rango de respuestas
// que la habilitan; elegirla abre la tira de respuestas, y volver a pulsarla la quita. «Fija» la muestra siempre.
// Cada cambio se escribe con porOpcion.ts (columnas filter_* en choices y la expresión en choice_filter).

import { useMemo, useState } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { Plus } from "../../../vendor/lucide-react";
import type { BuilderNode } from "../types";
import { aplicarPorOpcion, asignacionesPorOpcion, type AsignacionOpcion } from "./porOpcion";
import { opcionesDe, type AnalisisFiltro, type Respuesta } from "./modeloFiltros";
import { SelectorPreguntaFiltro, type PreguntaElegible } from "./SelectorPreguntaFiltro";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  a: AnalisisFiltro;
  workbook: XlsformEditorWorkbook;
  porNombre: ReadonlyMap<string, BuilderNode>;
  candidatas: readonly PreguntaElegible[];
  resaltadas: ReadonlySet<string>;
  editable: boolean;
  onWorkbook: (wb: XlsformEditorWorkbook) => void;
  onAnunciar: (texto: string) => void;
};

/** «2–5» si las respuestas son números seguidos; si no, los códigos separados por espacio. */
export function rango(valores: readonly string[]): string {
  if (!valores.length) return "—";
  const nums = valores.map(Number);
  if (nums.every((n) => Number.isInteger(n))) {
    const s = [...nums].sort((x, y) => x - y);
    const seguidos = s.every((n, i) => i === 0 || n === s[i - 1]! + 1);
    return seguidos && s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s.join(" ");
  }
  return valores.join(" ");
}

/** Quita el comienzo que comparten todos los títulos (las preguntas del hostigamiento empiezan igual), por palabras.
 *  La elipsis inicial la pone el CSS, así el texto sigue contenido en su `title`. */
export function sinComienzoComun(titulos: readonly string[]): string[] {
  if (titulos.length < 2) return [...titulos];
  const palabras = titulos.map((t) => t.split(/\s+/));
  let n = 0;
  while (palabras.every((p) => p[n] !== undefined && p[n] === palabras[0]![n]) && palabras.every((p) => p.length > n + 1)) n += 1;
  return n >= 3 ? palabras.map((p) => p.slice(n).join(" ")) : [...titulos];
}

export function MatrizPorOpcion({ a, workbook, porNombre, candidatas, resaltadas, editable, onWorkbook, onAnunciar }: Props) {
  const lectura = a.porOpcion!;
  // Las columnas que ya se vieron se quedan aunque se queden sin opciones: la matriz no cambia de forma al editar.
  const [extras, setExtras] = useState<string[]>(() => lectura.terminos.map((t) => t.pregunta));
  const [elegida, setElegida] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const asign = useMemo(() => asignacionesPorOpcion(workbook.choices, a.lista, lectura), [workbook.choices, a.lista, lectura]);
  const preguntas = [...new Set([...lectura.terminos.map((t) => t.pregunta), ...Object.values(asign).map((x) => x.pregunta).filter(Boolean), ...extras])];
  const respuestasDe = (p: string): Respuesta[] => {
    const n = porNombre.get(p);
    return n ? opcionesDe(workbook.choices, n.typeInfo.listName, (x) => porNombre.get(x)?.label).map((o) => ({ codigo: o.codigo, etiqueta: o.etiqueta })) : [];
  };
  const listaDe = (p: string) => porNombre.get(p)?.typeInfo.listName ?? "";
  const aplicar = (nuevas: Record<string, AsignacionOpcion>) => onWorkbook(aplicarPorOpcion(workbook, a.fila, a.lista, nuevas, lectura));

  const pulsar = (codigo: string, p: string) => {
    const cur = asign[codigo];
    if (cur?.pregunta === p && cur.valores.length) {
      if (elegida === codigo) {
        aplicar({ ...asign, [codigo]: { pregunta: "", valores: [], oculta: true } });
        setElegida(null);
      } else setElegida(codigo);
      return;
    }
    // Arranca con las respuestas de otra opción cuya pregunta usa la misma escala; si no hay, con todas.
    const hermana = Object.values(asign).find((x) => x.pregunta && x.pregunta !== p && x.valores.length && listaDe(x.pregunta) === listaDe(p));
    const valores = hermana ? [...hermana.valores] : respuestasDe(p).map((r) => r.codigo);
    aplicar({ ...asign, [codigo]: { pregunta: p, valores } });
    setElegida(codigo);
  };
  const pulsarFija = (codigo: string) => {
    const cur = asign[codigo];
    const fija = !cur?.pregunta && !cur?.oculta;
    aplicar({ ...asign, [codigo]: fija ? { pregunta: "", valores: [], oculta: true } : { pregunta: "", valores: [] } });
    if (elegida === codigo) setElegida(null);
  };
  const alternarValor = (codigo: string, v: string) => {
    const cur = asign[codigo];
    if (!cur?.pregunta) return;
    aplicar({ ...asign, [codigo]: { ...cur, valores: cur.valores.includes(v) ? cur.valores.filter((x) => x !== v) : [...cur.valores, v] } });
  };
  const usarEnLasDemas = (codigo: string) => {
    const cur = asign[codigo];
    if (!cur?.pregunta) return;
    const lista = listaDe(cur.pregunta);
    const nuevas = { ...asign };
    let n = 0;
    for (const [c, x] of Object.entries(asign)) {
      if (c !== codigo && x.pregunta && listaDe(x.pregunta) === lista) { nuevas[c] = { ...x, valores: [...cur.valores] }; n += 1; }
    }
    aplicar(nuevas);
    onAnunciar(n ? `Se aplicaron las mismas respuestas a ${n === 1 ? "1 opción" : `${n} opciones`}.` : "No hay otras opciones con la misma escala.");
  };

  const titulos = preguntas.map((p) => candidatas.find((c) => c.name === p)?.titulo ?? porNombre.get(p)?.label ?? p);
  const cortos = sinComienzoComun(titulos);
  const sel = elegida ? asign[elegida] : null;
  const opSel = a.opciones.find((o) => o.codigo === elegida);
  const disponibles = candidatas.filter((c) => !preguntas.includes(c.name));

  return (
    <div className="xcf-matriz">
      <div className="xcf-matriz__cab">
        <h4>Opción × pregunta que la habilita</h4>
        {editable ? (
          <PulsoButton variant="ghost" size="sm" aria-expanded={agregando} onClick={() => setAgregando((x) => !x)}>
            <Plus size={13} aria-hidden="true" /> Agregar pregunta
          </PulsoButton>
        ) : null}
      </div>
      {agregando ? (
        <div className="xcf-matriz__agregar">
          <SelectorPreguntaFiltro preguntas={disponibles} elegidas={[]} etiqueta="Pregunta que habilita opciones" autoFocus
            onElegir={(n) => { setExtras((x) => [...x, n]); setAgregando(false); }} />
        </div>
      ) : null}
      <div className="xcf-matriz__marco" data-qa-geometry-group="xlsform/filtros-matriz" data-qa-geometry-contract="intrinsic"
        data-qa-geometry-capacity="owned" data-qa-scroll-owner="filtros-matriz" tabIndex={0} role="region" aria-label={`Matriz de ${a.pregunta}`}>
        <table className="xcf-mx">
          <thead>
            <tr>
              <th scope="col" className="xcf-mx__esquina">Opción de <code>{a.pregunta}</code></th>
              {preguntas.map((p, i) => {
                return (
                  <th key={p} scope="col" title={`${p} · ${titulos[i]}`}>
                    <span className="xcf-mx__hc" title={p}>{p}</span>
                    <span className={cortos[i] !== titulos[i] ? "xcf-mx__hl is-recortado" : "xcf-mx__hl"} title={titulos[i]}>{cortos[i]}</span>
                  </th>
                );
              })}
              <th scope="col" title="Se muestra siempre"><span className="xcf-mx__hc">Fija</span><span className="xcf-mx__hl">siempre</span></th>
            </tr>
          </thead>
          <tbody>
            {a.opciones.map((o) => {
              const x = asign[o.codigo];
              const fija = !x?.pregunta && !x?.oculta;
              return (
                <tr key={o.codigo} data-opcion={o.codigo} className={resaltadas.has(o.codigo) ? "is-resaltada" : undefined}>
                  <th scope="row"><span className="xcf-mx__fila"><code>{o.codigo}</code><span className="xcf-mx__op" title={o.etiqueta}>{o.etiqueta}</span></span></th>
                  {preguntas.map((p) => {
                    const on = x?.pregunta === p && x.valores.length > 0;
                    const etiquetas = on ? respuestasDe(p).filter((r) => x!.valores.includes(r.codigo)).map((r) => r.etiqueta).join(", ") : "";
                    return (
                      <td key={p}>
                        <button type="button" className={`xcf-celda${on ? " is-on" : ""}${on && elegida === o.codigo ? " is-elegida" : ""}`}
                          aria-pressed={on} disabled={!editable} title={etiquetas || undefined}
                          aria-label={on ? `${o.etiqueta} con ${p}: ${etiquetas}` : `${o.etiqueta} con ${p}`} onClick={() => pulsar(o.codigo, p)}>
                          {on ? <span className="xcf-celda__rango">{rango(x!.valores)}</span> : <span className="xcf-celda__marca" aria-hidden="true" />}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <button type="button" className={fija ? "xcf-celda is-on" : "xcf-celda"} aria-pressed={fija} disabled={!editable}
                      aria-label={`${o.etiqueta} siempre`} onClick={() => pulsarFija(o.codigo)}>
                      <span className="xcf-celda__marca" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel?.pregunta && opSel ? (
        <div className="xcf-tira" role="group" aria-label={`Respuestas que habilitan ${opSel.etiqueta}`}>
          <span><b>{opSel.etiqueta}</b> aparece si <code>{sel.pregunta}</code> es</span>
          <span className="xcf-tira__opciones">
            {respuestasDe(sel.pregunta).map((r) => (
              <button key={r.codigo} type="button" className="xcf-tira__op" aria-pressed={sel.valores.includes(r.codigo)} title={r.codigo}
                disabled={!editable} onClick={() => alternarValor(opSel.codigo, r.codigo)}>
                {r.etiqueta}
              </button>
            ))}
          </span>
          {editable ? <PulsoButton variant="ghost" size="sm" onClick={() => usarEnLasDemas(opSel.codigo)}>Usar estas respuestas en las demás</PulsoButton> : null}
        </div>
      ) : (
        <p className="xcf-nota xcf-tira is-vacia">Elige una celda marcada para ajustar sus respuestas.</p>
      )}
    </div>
  );
}
