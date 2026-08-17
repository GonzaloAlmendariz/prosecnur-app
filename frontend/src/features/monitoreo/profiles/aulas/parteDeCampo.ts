import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * El parte de campo, ordenado para que lo que no cuadra se vea primero.
 *
 * La resta la hace el motor (`monitoreo_aulas_partes_publicados`), que es el
 * mismo que decide el descuadre del control de Validación: aquí no se recalcula
 * nada, sólo se ordena y se cuenta. Si esta vista rehiciera la identidad
 * habría dos reglas para lo mismo y bastaría con que una cambiara para que la
 * tabla y el aviso dijeran cosas distintas.
 */

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function parteDeCampo(filas: ReadonlyArray<MonitoreoRow>) {
  const conDiferencia = filas.map((fila) => ({
    fila,
    // `cuadra` viene del motor y puede ser nulo: un parte sin asistentes ni
    // efectivas no tiene identidad que comprobar, y tratarlo como descuadre
    // inventaría un problema que nadie declaró.
    descuadra: fila.cuadra === false,
    magnitud: Math.abs(numero(fila.diferencia) ?? 0),
  }));

  const ordenadas = [...conDiferencia].sort((a, b) => {
    if (a.descuadra !== b.descuadra) return a.descuadra ? -1 : 1;
    if (a.descuadra) return b.magnitud - a.magnitud;
    return String(a.fila.operational_code ?? "").localeCompare(
      String(b.fila.operational_code ?? ""),
      "es",
      { numeric: true },
    );
  });

  const descuadrados = conDiferencia.filter((f) => f.descuadra).length;
  const sinComprobar = filas.filter((f) => f.cuadra == null).length;
  return {
    filas: ordenadas.map((f) => f.fila as Record<string, unknown>),
    descuadrados,
    sinComprobar,
    label: etiqueta(filas.length, descuadrados, sinComprobar),
  };
}

/** Lo que dice el subtítulo del panel: cuántos partes hay y cuántos fallan. */
function etiqueta(total: number, descuadrados: number, sinComprobar: number) {
  if (!total) return "sin partes";
  const partes = total === 1 ? "1 parte" : `${total.toLocaleString("es-PE")} partes`;
  const trozos = [partes];
  if (descuadrados) trozos.push(`${descuadrados} sin cuadrar`);
  // No es lo mismo «cuadran todos» que «no se pudo comprobar»: un parte sin
  // asistentes ni efectivas no falla, es que no declara lo suficiente.
  if (sinComprobar) trozos.push(`${sinComprobar} sin comprobar`);
  if (!descuadrados && !sinComprobar) trozos.push("todos cuadran");
  return trozos.join(" · ");
}
