// Punto de aviso sobre el sello de una fila de la Estructura (C22, 2026-10-17). Discreto: el detalle va en el
// tooltip y en el nombre accesible. Rojo si hay algún error, ámbar si sólo hay advertencias.

/** Aviso de una fila tal como lo arma la página desde los diagnósticos (contrato con la ficha: no cambiar). */
export type AvisoFila = { nivel: "error" | "warn"; titulo: string };

export function resumenAvisos(avisos: readonly AvisoFila[]): { nivel: AvisoFila["nivel"]; texto: string } {
  const nivel = avisos.some((a) => a.nivel === "error") ? "error" : "warn";
  const cab = avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`;
  return { nivel, texto: `${cab}: ${avisos.map((a) => a.titulo).join(" · ")}` };
}

export function PuntoAviso({ avisos }: { avisos: readonly AvisoFila[] }) {
  const { nivel, texto } = resumenAvisos(avisos);
  return <span className={`xfe-aviso is-${nivel}`} role="img" aria-label={texto} title={texto} data-aviso={nivel} />;
}
