import { stripMarkdown } from "../helpers/markdown";
import { PanelCard } from "../kit";
import type { BuilderNode } from "../types";
import { causaSinPrueba, evaluarRestriccion, textoCausaSinPrueba, valoresDeEjemplo, type ResultadoPrueba } from "../logic/probarRestriccion";

// «Probar valores» y «Así lo verá en el teléfono» (revamp E5, 2026-10-16): la regla se prueba con valores
// derivados de sus propios bordes, y el primer valor rechazado se muestra como lo vería quien encuesta.

const ETIQUETA: Record<ResultadoPrueba, string> = { acepta: "Se acepta", rechaza: "Pide corregir", "no-evaluable": "No se puede probar aquí" };

export function ProbarRestriccion({ node, opciones = [] }: { node: BuilderNode; opciones?: { name: string; label: string }[] }) {
  const valores = valoresDeEjemplo(node, opciones.map((o) => o.name));
  const etiqueta = (v: string) => v.split(/\s+/).map((c) => opciones.find((o) => o.name === c)?.label || c).join(" + ");
  // La causa se mira antes de probar: una fila rota o unas comillas tipográficas no son «funciones del teléfono».
  const causa = causaSinPrueba(node);
  const filas = causa ? [] : valores.map((v) => ({ v, r: evaluarRestriccion(node.constraint, v, {}, node.name) }));
  const rechazado = filas.find((f) => f.r === "rechaza");
  const mensajeCrudo = stripMarkdown(node.constraint_message ?? "").trim();
  // El «mensaje» de una fila rota es su propio nombre: no es un mensaje.
  const mensaje = mensajeCrudo === node.name ? "" : mensajeCrudo;
  const noEvaluable = filas.length > 0 && filas.every((f) => f.r === "no-evaluable");
  return (
    <div className="xfp-fila2" data-qa-geometry-group="xlsform/probar-restriccion-fila" data-qa-geometry-contract="intrinsic">
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
                  <td><code>{f.v === "" ? "(vacío)" : f.v}</code>{opciones.length ? <span className="xfp-prueba__etq">{stripMarkdown(etiqueta(f.v))}</span> : null}</td>
                  <td><span className="xfp-prueba__estado" aria-hidden="true" />{ETIQUETA[f.r]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PanelCard>
      <PanelCard title="Así lo verá en el teléfono" flush fill>
        <div className="xfp-telefono">
          <span className="xfp-telefono__enunciado">{stripMarkdown(node.label || node.name)}</span>
          <span className={rechazado ? "xfp-telefono__campo is-error" : "xfp-telefono__campo"}>{rechazado ? (opciones.length ? stripMarkdown(etiqueta(rechazado.v)) : rechazado.v) || " " : valores[0] ?? ""}</span>
          {causa ? (
            <span className="xfp-telefono__ok">Sin una regla que el editor pueda evaluar, no hay un aviso que mostrar.</span>
          ) : rechazado ? (
            <span className="xfp-telefono__error">{mensaje || "Respuesta no permitida (aviso genérico: falta un mensaje)."}</span>
          ) : (
            <span className="xfp-telefono__ok">Con estos valores nadie ve un error.</span>
          )}
        </div>
      </PanelCard>
    </div>
  );
}
