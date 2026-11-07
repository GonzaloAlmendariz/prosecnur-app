/**
 * Qué fases del arranque se ven en la pantalla de carga (5 nov 2026, checklist de pulido de UI, ítem 6).
 *
 * Antes se mostraba una ventana de las últimas seis fases, y como las terminadas iban entrando y saliendo de esa
 * ventana en cada sondeo, la lista «rotaba»: filas que aparecían y desaparecían con otro nombre en el mismo sitio.
 * Ahora la lista tiene forma fija:
 *
 *  1. una fila-resumen con lo ya preparado (clave estable `listas`), que nombra las dos primeras y cuenta el resto;
 *  2. las fases en curso o en espera, en el orden en que llegaron (como mucho `maxActivas`);
 *  3. la fila final «Listo para trabajar».
 *
 * Así lo que cambia de un sondeo al otro es el ESTADO de una fila, no qué fila ocupa cada sitio.
 */
export type FaseVisibleEstado = "pending" | "running" | "ready" | "skipped" | "timeout" | "error";

export type FaseVisible = {
  id: string;
  label: string;
  status: FaseVisibleEstado;
  detail?: string;
};

const ACTIVA = (status: FaseVisibleEstado) => status === "running" || status === "pending";

export function fasesVisibles(fases: FaseVisible[], maxActivas = 4): FaseVisible[] {
  const final = fases.find((fase) => fase.id === "suite");
  const resto = fases.filter((fase) => fase.id !== "suite");
  const cerradas = resto.filter((fase) => !ACTIVA(fase.status));
  const activas = resto.filter((fase) => ACTIVA(fase.status));
  // Primero las que corren, después las que esperan: lo que se mueve va arriba.
  const enOrden = [...activas.filter((f) => f.status === "running"), ...activas.filter((f) => f.status === "pending")];
  const visibles: FaseVisible[] = [];
  if (cerradas.length) visibles.push(resumenDeCerradas(cerradas));
  visibles.push(...enOrden.slice(0, maxActivas));
  const ocultas = enOrden.length - maxActivas;
  if (ocultas > 0) {
    visibles.push({ id: "en-espera", label: `${ocultas} ${ocultas === 1 ? "fase más" : "fases más"} en espera`, status: "pending" });
  }
  if (final) visibles.push(final);
  return visibles;
}

function resumenDeCerradas(cerradas: FaseVisible[]): FaseVisible {
  const conProblema = cerradas.filter((fase) => fase.status === "error" || fase.status === "timeout");
  if (conProblema.length) {
    // Un problema no se esconde dentro del resumen: la fila lo nombra.
    const primera = conProblema[0];
    return {
      id: "listas",
      label: conProblema.length === 1 ? primera.label : `${primera.label} y ${conProblema.length - 1} más`,
      status: primera.status,
      detail: primera.detail,
    };
  }
  const listas = cerradas.filter((fase) => fase.status === "ready");
  const nombres = (listas.length ? listas : cerradas).map((fase) => fase.label);
  const label = nombres.length <= 2
    ? nombres.join(" y ")
    : `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;
  return {
    id: "listas",
    label,
    status: listas.length ? "ready" : "skipped",
    detail: !listas.length ? "No aplica" : listas.length === 1 ? "Lista" : `${listas.length} listas`,
  };
}
