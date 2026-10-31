import type { AsignacionPlanificada, LecturaDeAsignacion } from "../../../../../api/monitoreoAsignacionPlanificada";

/**
 * La columna «Planificado» de Avance › UMP (B3): a quién le asignó Material la
 * UMP y si las respuestas que llegaron son de esa persona. Solo con la
 * asignación de la MISMA muestra que está en campo; si no, la tabla lo dice en
 * una línea y no pinta la columna.
 */

export type CeldaPlanificada = {
  codigo: string;
  /** «P844 · Ana Ruiz», o el código solo si la lista no trae nombre. */
  rotulo: string;
  lectura: LecturaDeAsignacion;
  texto: string;
  tono: "ok" | "info" | "falta" | "neutro";
  /** Lo que se vio, para el `title`: «P844 (2), P101 (1)». */
  detalle: string;
  /** C7: lo que declara campo y, si contradice a Kobo, por qué. */
  declarado: {
    estado: string;
    fechas: string;
    contraste: string | null;
    /** P2: «Campo 5 · Kobo 1», o `null` si campo no transcribió conteos. */
    conteo: { texto: string; distinto: boolean } | null;
  } | null;
};

export type ColumnaPlanificada =
  | { tipo: "columna"; porManzana: Map<string, CeldaPlanificada>; resumen: string; conDeclarado: boolean }
  | { tipo: "aviso"; texto: string }
  | { tipo: "nada" };

const TEXTO: Record<LecturaDeAsignacion, { texto: string; tono: CeldaPlanificada["tono"] }> = {
  coincide: { texto: "Coincide", tono: "ok" },
  coincide_con_otros: { texto: "Con otros", tono: "info" },
  otro_encuestador: { texto: "Otro encuestador", tono: "falta" },
  sin_respuestas: { texto: "Sin respuestas", tono: "neutro" },
};

export function columnaPlanificada(asignacion: AsignacionPlanificada | null): ColumnaPlanificada {
  if (!asignacion) return { tipo: "nada" };
  if (asignacion.estado === "otra_muestra") return { tipo: "aviso", texto: asignacion.motivo || "Asignación de otra muestra." };
  if (asignacion.estado !== "comparable") return { tipo: "nada" };
  const porManzana = new Map<string, CeldaPlanificada>();
  for (const u of asignacion.porUmp) {
    const { texto, tono } = TEXTO[u.lectura];
    porManzana.set(u.idManzana, {
      codigo: u.codigoPlanificado,
      rotulo: u.nombrePlanificado ? `${u.codigoPlanificado} · ${u.nombrePlanificado}` : u.codigoPlanificado,
      lectura: u.lectura,
      texto,
      tono,
      detalle: u.observados.length
        ? `Llegaron: ${u.observados.map((o) => `${o.codigo || "sin código"} (${o.respuestas})`).join(", ")}${u.heredada ? ". Código heredado del titular." : ""}`
        : `Sin respuestas todavía${u.heredada ? ". Código heredado del titular." : ""}`,
      declarado: u.estadoDeclarado || u.efectivasDeclaradas != null
        ? {
          estado: u.estadoDeclarado,
          fechas: [u.fechaSalida && `salió ${u.fechaSalida}`, u.fechaEntrega && `entregó ${u.fechaEntrega}`].filter(Boolean).join(", "),
          contraste: u.contraste === "finalizada_sin_respuestas"
            ? "Campo la da por finalizada y no llegó ninguna respuesta a Kobo."
            : u.contraste === "pendiente_con_respuestas"
              ? `Campo la tiene pendiente y ya llegaron ${u.respuestas} respuestas a Kobo.`
              : null,
          conteo: u.efectivasDeclaradas == null
            ? null
            : { texto: `Campo ${u.efectivasDeclaradas} · Kobo ${u.efectivasKobo}`, distinto: u.efectivasDeclaradas !== u.efectivasKobo },
        }
        : null,
    });
  }
  const r = asignacion.resumen;
  const partes = [`${r.coinciden} coinciden`];
  if (r.otroEncuestador) partes.push(`${r.otroEncuestador} con otro encuestador`);
  if (r.coincidenConOtros) partes.push(`${r.coincidenConOtros} con otros además`);
  if (r.sinPlanificar) partes.push(`${r.sinPlanificar} con respuestas sin asignar`);
  const declarado = r.conEstadoDeclarado
    ? ` Estado declarado por campo en ${r.conEstadoDeclarado}${r.contrastes ? `; ${r.contrastes} no cuadra${r.contrastes === 1 ? "" : "n"} con Kobo` : ""}.`
    : "";
  const conteos = r.conConteos
    ? ` Efectivas del consolidado en ${r.conConteos}${r.conteosDistintos ? `; ${r.conteosDistintos} distinta${r.conteosDistintos === 1 ? "" : "s"} de Kobo` : ", iguales a Kobo"}.`
    : "";
  return {
    tipo: "columna",
    porManzana,
    resumen: `Planificado en Material: ${partes.join(", ")}.${declarado}${conteos}`,
    conDeclarado: r.conEstadoDeclarado > 0 || r.conConteos > 0,
  };
}
