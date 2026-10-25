/**
 * Control › Respuestas (ficha Ctl9): qué llegó de cada plataforma, una fila
 * por respuesta (`internal_queries.cases` sin las personas sin respuesta).
 * Facetas con su conteo —estado de la respuesta, canal, cruce y si cuenta en
 * el avance—, la tabla más reciente primero y su exportación. Grano
 * respuesta; las personas van en Control › Personas.
 */

import type { MonitoreoInternalQueryCase } from "../../../../../../api/client";
import { internalCaseResponseStateLabel, internalCaseResponseStateValue } from "../../../../internalQueries";
import { comoCruzo } from "./personasModelo";

export type Respuesta = {
  clave: string;
  id: string;
  recibida: string;
  publico: string;
  canal: string;
  encuesta: string;
  estado: string;
  cruce: string;
  cuenta: boolean;
};

export type Faceta = "estado" | "canal" | "cruce" | "cuenta";

export const FACETAS: ReadonlyArray<{ id: Faceta; rotulo: string }> = [
  { id: "estado", rotulo: "Respuesta" },
  { id: "canal", rotulo: "Canal" },
  { id: "cruce", rotulo: "Cruce" },
  { id: "cuenta", rotulo: "Cuenta en el avance" },
];

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function cuentaEnAvance(caso: MonitoreoInternalQueryCase) {
  const declarado = caso.counts_in_advance;
  if (typeof declarado === "boolean") return declarado;
  if (typeof declarado === "string" && declarado) return ["true", "1", "si", "sí"].includes(declarado.toLowerCase());
  return String(caso.advancement) === "effective";
}

export function respuestasDe(casos: readonly MonitoreoInternalQueryCase[]): Respuesta[] {
  return casos
    .filter((caso) => internalCaseResponseStateValue(caso) !== "pending" && (caso.response_id || caso.response_datetime))
    .map((caso, indice) => ({
      clave: `${texto(caso.response_id) || indice}-${indice}`,
      id: texto(caso.response_id) || "Sin identificador",
      recibida: texto(caso.response_datetime || caso.date).slice(0, 10),
      publico: texto(caso.actor) || "Sin público",
      canal: texto(caso.channel) || "Sin canal",
      encuesta: texto(caso.source_label),
      estado: internalCaseResponseStateLabel(internalCaseResponseStateValue(caso)),
      cruce: comoCruzo(caso),
      cuenta: cuentaEnAvance(caso),
    }))
    .sort((a, b) => b.recibida.localeCompare(a.recibida) || a.id.localeCompare(b.id));
}

export function valorDeFaceta(respuesta: Respuesta, faceta: Faceta): string {
  if (faceta === "cuenta") return respuesta.cuenta ? "Cuenta" : "No cuenta";
  return respuesta[faceta];
}

export type Seleccion = Partial<Record<Faceta, string>>;

export function filtrarRespuestas(respuestas: readonly Respuesta[], seleccion: Seleccion, busqueda = ""): Respuesta[] {
  const tokens = busqueda.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean);
  return respuestas.filter((respuesta) => (
    FACETAS.every(({ id }) => !seleccion[id] || valorDeFaceta(respuesta, id) === seleccion[id])
    && tokens.every((token) => `${respuesta.id} ${respuesta.publico} ${respuesta.encuesta}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(token))
  ));
}

/** Conteo de cada valor de una faceta con las demás facetas aplicadas. */
export function conteoDeFaceta(respuestas: readonly Respuesta[], faceta: Faceta, seleccion: Seleccion): Array<{ valor: string; casos: number }> {
  const sinEsta = { ...seleccion, [faceta]: undefined };
  const cuenta = new Map<string, number>();
  filtrarRespuestas(respuestas, sinEsta).forEach((respuesta) => {
    const valor = valorDeFaceta(respuesta, faceta);
    cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
  });
  return [...cuenta].map(([valor, casos]) => ({ valor, casos })).sort((a, b) => b.casos - a.casos || a.valor.localeCompare(b.valor, "es"));
}

export function csvDeRespuestas(respuestas: readonly Respuesta[]): string {
  const celda = (valor: string) => `"${valor.replace(/"/g, "\"\"")}"`;
  return [
    ["Respuesta", "Recibida", "Público", "Canal", "Encuesta", "Estado", "Cruce", "Cuenta en el avance"].map(celda).join(","),
    ...respuestas.map((r) => [r.id, r.recibida, r.publico, r.canal, r.encuesta, r.estado, r.cruce, r.cuenta ? "Sí" : "No"].map(celda).join(",")),
  ].join("\n");
}
