import { useMemo, useState } from "react";
import { textoEnTelefono, dependeDelMomento, motivosEnTelefono, valorLegible } from "./calculoTelefono";
import { PanelCard, TypeIcon } from "../kit";
import type { BuilderNode, BuilderStructure } from "../types";
import { evaluarCalculo } from "../logic/probarCalculo";
import { etiquetaPlana } from "./variablesLegibles";
import { valoresDePrueba } from "./probarCalculoModelo";

// «Probar con respuestas» (revamp E6, 2026-10-16): un campo por cada pregunta que usa la fórmula, con un valor de
// ejemplo según su tipo. Evalúa la fórmula que se está escribiendo (el borrador) y conserva lo tecleado al guardar.

type Opcion = { name: string; label: string };

export function ProbarCalculo({ formula, usa, structure, opcionesDe }: {
  node: BuilderNode;
  formula: string;
  usa: string[];
  structure: BuilderStructure | null;
  opcionesDe: (listName: string) => Opcion[];
}) {
  const porNombre = useMemo(() => new Map((structure?.outline ?? []).map((n) => [n.name, n])), [structure]);
  const etiquetaDe = (name: string) => porNombre.get(name)?.label ?? "";
  // Sólo lo tecleado se guarda: lo demás sale del tipo de cada pregunta, así que guardar la fórmula no lo borra.
  const [tecleados, setTecleados] = useState<Record<string, string>>({});
  const valores = valoresDePrueba(usa, tecleados, (v) => {
    const n = porNombre.get(v);
    return { base: n?.typeInfo.base ?? "", opciones: n ? opcionesDe(n.typeInfo.listName) : [] };
  });
  // Lo que sólo el teléfono resuelve se dice antes de intentar evaluarlo, con su porqué (choice-name, join, sum…).
  const enTelefono = motivosEnTelefono(formula).length > 0;
  const resultado = !formula.trim() ? null : enTelefono ? ({ estado: "no-evaluable" } as const) : evaluarCalculo(formula, valores);

  return (
    <PanelCard
      title="Probar con respuestas"
      meta={usa.length ? `${usa.length} pregunta${usa.length === 1 ? "" : "s"}` : undefined}
      footer={
        !resultado ? (
          <><span className="xfk-over">Resultado</span> <span className="xfp-nota">Sin fórmula todavía.</span></>
        ) : resultado.estado === "ok" ? (
          <>
            <span className="xfk-over">Resultado</span> <b className="xfp-resultado">{resultado.valor === "" ? "(vacío)" : valorLegible(resultado.valor)}</b>
            {dependeDelMomento(formula) ? <span className="xfp-nota"> · en el teléfono, el momento en que se abre la encuesta</span> : null}
          </>
        ) : (
          <><span className="xfk-over">Resultado</span> {textoEnTelefono(formula)}</>
        )
      }
      flush
      fill
    >
      {usa.length === 0 ? (
        <p className="xfp-nota xfp-nota--pad">No lee ninguna respuesta: su valor no depende de quien responde.</p>
      ) : (
        <div className="xfp-entradas">
          {usa.map((v) => {
            const n = porNombre.get(v);
            const etq = n?.label ? etiquetaPlana(n.label, etiquetaDe) : "";
            const numerico = ["integer", "decimal", "range"].includes(n?.typeInfo.base ?? "");
            return (
              <label key={v} className="xfp-entrada">
                <span className="xfp-entrada__rot">
                  <TypeIcon baseType={n?.typeInfo.base ?? ""} size={12} />
                  {etq ? <span className="xfp-entrada__txt">{etq}</span> : <code className="xfp-var is-codigo">{v}</code>}
                </span>
                <input
                  value={valores[v] ?? ""}
                  inputMode={numerico ? "decimal" : undefined}
                  onChange={(e) => setTecleados((prev) => ({ ...prev, [v]: e.target.value }))}
                  aria-label={`Valor de prueba para ${etq || v}`}
                />
              </label>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
