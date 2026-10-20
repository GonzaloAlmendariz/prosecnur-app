import { useState } from "react";
import { stripMarkdown } from "../helpers/markdown";
import { PanelCard } from "../kit";
import type { BuilderNode } from "../types";
import { causaSinPrueba, textoCausaSinPrueba } from "../logic/probarRestriccion";
import { casosDeRestriccion, ETIQUETA_CASO, resultadoDeCaso } from "./probarRestriccionModelo";
import { etiquetaPlana, type EtiquetaDe } from "./variablesLegibles";
import { EtiquetaLegible } from "./LecturaPiezas";

// «Probar valores» y «Así lo verá en el teléfono» (revamp E5, 2026-10-16): los casos salen de la regla vigente y se
// puede probar un valor propio. El primer valor rechazado se muestra como lo vería quien encuesta, con la forma real
// del tipo (campo de texto u opciones).

type Opcion = { name: string; label: string };

export function ProbarRestriccion({ node, opciones = [], etiquetaDe }: { node: BuilderNode; opciones?: Opcion[]; etiquetaDe?: EtiquetaDe }) {
  const [propio, setPropio] = useState("");
  const esSeleccion = node.typeInfo.base === "select_one" || node.typeInfo.base === "select_multiple";
  const etiqueta = (v: string) => v.split(/\s+/).map((c) => etiquetaPlana(opciones.find((o) => o.name === c)?.label || c, etiquetaDe)).join(" + ");
  // La causa se mira antes de probar: unas comillas tipográficas no son «funciones del teléfono».
  const causa = causaSinPrueba(node);
  const casos = causa ? [] : casosDeRestriccion(node, opciones.map((o) => o.name));
  const filas = casos.map((v) => ({ v, r: resultadoDeCaso(node, v) }));
  const rPropio = propio.trim() ? resultadoDeCaso(node, propio) : null;
  const rechazado = rPropio === "rechaza" ? { v: propio, r: rPropio } : filas.find((f) => f.r === "rechaza");
  const mostrado = rechazado?.v ?? filas.find((f) => f.r === "acepta")?.v ?? "";
  const mensajeCrudo = stripMarkdown(node.constraint_message ?? "").trim();
  const mensaje = mensajeCrudo === node.name ? "" : mensajeCrudo;
  const noEvaluable = filas.length > 0 && filas.every((f) => f.r === "no-evaluable" || f.r === "no-se-evalua");
  return (
    <div className="xfp-fila2" data-qa-geometry-group="xlsform/probar-restriccion-fila" data-qa-geometry-contract="equal">
      <PanelCard title="Probar valores" meta={filas.length ? `${filas.length} casos` : undefined} flush fill>
        {causa ? (
          <p className="xfp-nota xfp-nota--pad">{textoCausaSinPrueba(causa)}</p>
        ) : filas.length === 0 ? (
          <p className="xfp-nota xfp-nota--pad">Este tipo de pregunta no se prueba con valores escritos.</p>
        ) : noEvaluable ? (
          <p className="xfp-nota xfp-nota--pad">El editor no pudo evaluar la regla con estos valores: se comprueba en el teléfono.</p>
        ) : (
          <table className="xfp-prueba">
            <thead><tr><th>Valor</th><th>Resultado</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.v} className={`is-${f.r}`}>
                  <td><code>{f.v === "" ? "(vacío)" : f.v}</code>{esSeleccion && f.v ? <span className="xfp-prueba__etq">{etiqueta(f.v)}</span> : null}</td>
                  <td><span className="xfp-prueba__estado" aria-hidden="true" />{ETIQUETA_CASO[f.r]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!causa && !esSeleccion && filas.length > 0 && !noEvaluable ? (
          <div className="xfp-prueba__propio">
            <label htmlFor={`xfp-propio-${node.rowIndex}`}>Prueba un valor</label>
            <input id={`xfp-propio-${node.rowIndex}`} value={propio} onChange={(e) => setPropio(e.target.value)} spellCheck={false} autoComplete="off" />
            <span className={`xfp-prueba__veredicto is-${rPropio ?? "nada"}`} aria-live="polite">{rPropio ? ETIQUETA_CASO[rPropio] : ""}</span>
          </div>
        ) : null}
      </PanelCard>
      <PanelCard title="Así lo verá en el teléfono" flush fill>
        <div className="xfp-telefono">
          <span className="xfp-telefono__enunciado">{node.label ? <EtiquetaLegible texto={node.label} etiquetaDe={etiquetaDe} /> : node.name}</span>
          {esSeleccion ? (
            <ul className="xfp-telefono__opciones" role="presentation">
              {opciones.slice(0, 5).map((o) => {
                const marcada = mostrado.split(/\s+/).includes(o.name);
                return (
                  <li key={o.name} className={marcada ? "is-marcada" : undefined}>
                    <span className={node.typeInfo.base === "select_one" ? "xfp-telefono__radio" : "xfp-telefono__casilla"} aria-hidden="true" />
                    {o.label ? <EtiquetaLegible texto={o.label} etiquetaDe={etiquetaDe} /> : o.name}
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className={rechazado ? "xfp-telefono__campo is-error" : "xfp-telefono__campo"}>{mostrado || " "}</span>
          )}
          {causa ? null : rechazado ? (
            <span className="xfp-telefono__error">{mensaje || "Respuesta no permitida (aviso genérico: falta un mensaje)."}</span>
          ) : (
            <span className="xfp-telefono__ok">Con estos valores nadie ve un error.</span>
          )}
        </div>
      </PanelCard>
    </div>
  );
}
