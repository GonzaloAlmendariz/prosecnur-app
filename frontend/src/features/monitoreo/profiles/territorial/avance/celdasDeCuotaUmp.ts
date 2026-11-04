// Lo que la tabla «Cuota de cada UMP» pinta en sus celdas de texto (formato de Monitoreo, vista 7). El
// aplicador y «quién cubre» partían en dos renglones y «Saldo» era una columna entera de «—»: aquí cada
// celda cabe en un renglón y lo largo queda en el título; la columna que no informa no se pinta.

import type { FilaDeUmp, QuienCubre } from "./faltanteModel";
import { textoDeQuienCubre } from "./faltanteModel";

/**
 * «P884, Norma Flores Bustamante» → código «P884» y nombre «Norma Flores» (el nombre de pila y el apellido
 * paterno); `completo` es lo que va en el título. Sin código, sólo el nombre.
 */
export function aplicadorCorto(aplicador: string): { codigo: string; nombre: string; completo: string } {
  const completo = aplicador.trim();
  const [primera, ...resto] = completo.split(/\s*,\s*/);
  const tieneCodigo = resto.length > 0 && /^[A-Za-z]{0,3}\d+[A-Za-z]?$/.test(primera ?? "");
  const nombreLargo = tieneCodigo ? resto.join(", ") : completo;
  const palabras = nombreLargo.split(/\s+/).filter(Boolean);
  const nombre = palabras.length >= 3 ? `${palabras[0]} ${palabras[palabras.length - 2]}` : nombreLargo;
  return { codigo: tieneCodigo ? primera : "", nombre, completo };
}

/** «Sin excedente» en la tabla (la frase entera va al título); el resto, igual que en las tarjetas. */
export function quienCubreCorto(cubre: QuienCubre): { texto: string; titulo: string } {
  const titulo = textoDeQuienCubre(cubre);
  return { texto: cubre?.tipo === "sin-excedente" ? "Sin excedente" : titulo, titulo };
}

/** La columna «Saldo» sólo se pinta si alguna UMP recibió o cedió una subsanación. */
export function hayAlgunSaldo(filas: readonly Pick<FilaDeUmp, "ganancia" | "perdida">[]): boolean {
  return filas.some((fila) => fila.ganancia > 0 || fila.perdida > 0);
}
