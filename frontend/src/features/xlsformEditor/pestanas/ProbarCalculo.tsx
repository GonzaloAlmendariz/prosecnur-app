import { useEffect, useMemo, useState } from "react";
import { tituloPlano } from "../kit/CuerpoPanelMarca";
import { dependeDelMomento, motivosEnTelefono, textoEnTelefono, valorLegible } from "./calculoTelefono";
import { PanelCard, TypeIcon } from "../kit";
import type { BuilderNode, BuilderStructure } from "../types";
import { evaluarCalculo } from "../logic/probarCalculo";

// «Probar con respuestas» (revamp E6, 2026-10-16): un campo por cada pregunta que usa el cálculo, con un valor
// de ejemplo según su tipo, y el resultado recalculado al instante.

type Opcion = { name: string; label: string };

function ejemplo(node: BuilderNode | undefined, opciones: Opcion[]): string {
  switch (node?.typeInfo.base) {
    case "integer":
    case "decimal":
    case "range":
      return "3";
    case "select_one":
      return opciones[0]?.name ?? "1";
    case "select_multiple":
      return opciones.slice(0, 2).map((o) => o.name).join(" ") || "1";
    case "date":
      return new Date().toISOString().slice(0, 10);
    default:
      return "ejemplo";
  }
}

export function ProbarCalculo({ node, usa, structure, opcionesDe }: {
  node: BuilderNode;
  usa: string[];
  structure: BuilderStructure | null;
  opcionesDe: (listName: string) => Opcion[];
}) {
  const porNombre = useMemo(() => new Map((structure?.outline ?? []).map((n) => [n.name, n])), [structure]);
  const inicial = useMemo(
    () => Object.fromEntries(usa.map((v) => { const n = porNombre.get(v); return [v, ejemplo(n, n ? opcionesDe(n.typeInfo.listName) : [])]; })),
    [usa, porNombre, opcionesDe],
  );
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  useEffect(() => setValores(inicial), [inicial]);
  // Lo que sólo el teléfono resuelve se dice antes de intentar evaluarlo, con su porqué (choice-name, join, sum…).
  const enTelefono = motivosEnTelefono(node.calculation).length > 0;
  const resultado = enTelefono ? ({ estado: "no-evaluable" } as const) : evaluarCalculo(node.calculation, valores);

  return (
    <PanelCard
      title="Probar con respuestas"
      meta={usa.length ? `${usa.length} pregunta${usa.length === 1 ? "" : "s"}` : undefined}
      footer={
        resultado.estado === "ok" ? (
          <>
            <span className="xfk-over">Resultado</span> <b className="xfp-resultado">{resultado.valor === "" ? "(vacío)" : valorLegible(resultado.valor)}</b>
            {dependeDelMomento(node.calculation) ? <span className="xfp-nota"> · en el teléfono, el momento en que se abre la encuesta</span> : null}
          </>
        ) : (
          <><span className="xfk-over">Resultado</span> {textoEnTelefono(node.calculation)}</>
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
            return (
              <label key={v} className="xfp-entrada">
                <span className="xfp-entrada__rot">
                  <TypeIcon baseType={n?.typeInfo.base ?? ""} size={12} />
                  <span className="xfp-entrada__txt">{n?.label ? tituloPlano(n.label) : v}</span>
                  {n?.label ? <code>{v}</code> : null}
                </span>
                <input
                  value={valores[v] ?? ""}
                  onChange={(e) => setValores((prev) => ({ ...prev, [v]: e.target.value }))}
                  aria-label={`Valor de prueba para ${v}`}
                />
              </label>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}
