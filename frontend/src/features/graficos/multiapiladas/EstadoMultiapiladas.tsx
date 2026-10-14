// G12 parte 2: el estado del gráfico se dice una vez, al pie y siempre a la vista: la escala común, cuántas filas
// tendrá y sólo lo que está mal. Reemplaza «Síntesis» y «Revisar selección».

export type Problema = { kind: "error" | "warning"; message: string };

export function EstadoMultiapiladas({ escala, filas, problemas }: {
  escala: { tone: "ok" | "warning" | "error" | "idle"; message: string } | null;
  filas: number;
  problemas: readonly Problema[];
}) {
  return (
    <div className="pulso-mapi-estado" role="status">
      {escala && escala.message && <span className={escala.tone === "ok" ? "is-ok" : escala.tone === "idle" ? "" : "is-aviso"}>{escala.tone === "ok" ? "✓ " : ""}{escala.message}</span>}
      {filas > 0 && <span>{filas} {filas === 1 ? "fila" : "filas"} en el gráfico</span>}
      {problemas.map((p) => <span key={p.message} className={p.kind === "error" ? "is-error" : "is-aviso"}>{p.message}</span>)}
    </div>
  );
}
