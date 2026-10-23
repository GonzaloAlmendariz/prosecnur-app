/**
 * Control › Discrepancias (T9): Kobo y la hoja de barrido no dicen lo mismo.
 *
 * P2: lo primero es la alerta en los dos sentidos, con responsable, CodPulso y
 * proGres, para avisar al equipo; la decisión «Cuenta / No cuenta» viene
 * después. P1: mientras no se decide, la efectiva de Kobo cuenta. P3: «la
 * hoja dice Efectivo y Kobo no tiene envío» va a Avisos. P4: el enumerador de
 * Kobo y el responsable de la hoja son la misma persona; la equivalencia de
 * nombres se confirma en Insumos › Llave y filtros.
 *
 * Fuente: bloque `discrepancias_telefonicas`
 * (`api/R/monitoreo_telefonico_discrepancias.R`), cruzado por CodPulso con
 * `control_tiempo_kobo` (envío, enumerador y fecha de Kobo).
 */
import type { MonitoreoAcreditacionReports, MonitoreoManualCaseReconciliation, MonitoreoProfile } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";

export type SentidoDeDiscrepancia = "kobo_sin_hoja" | "hoja_sin_kobo";

export type EstadoDeDecision = "pendiente" | "cuenta" | "no_cuenta";

export type CasoDeDiscrepancia = {
  sentido: SentidoDeDiscrepancia;
  codigo: string;
  progres: string;
  responsable: string;
  hojaDice: string;
  fechaHoja: string;
  fechaKobo: string;
  responseId: string;
  enumerador: string;
  /** El enumerador de Kobo no es el responsable de la hoja, ni con la equivalencia confirmada. */
  enumeradorDistinto: boolean;
  decision: EstadoDeDecision;
  nota: string;
  decididoEl: string;
};

export const SIN_RESPONSABLE = "Sin asignar";

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function clave(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** El nombre de la hoja que corresponde a un enumerador de Kobo, con las equivalencias confirmadas. */
export function nombreEnLaHoja(enumerador: string, equivalencias: ReadonlyArray<{ kobo: string; hoja: string }> = []) {
  const par = equivalencias.find((item) => clave(item.kobo) === clave(enumerador));
  return par ? par.hoja : enumerador;
}

export function decisionesTelefonicas(perfil: MonitoreoProfile | null | undefined) {
  const manual = perfil?.reconciliation_decisions?.manual_case_reconciliations ?? {};
  return Object.values(manual).filter((item): item is MonitoreoManualCaseReconciliation => (
    Boolean(item) && item.match_type === "telefonico_discrepancia"
  ));
}

export function casosDeDiscrepancia(
  reports: MonitoreoAcreditacionReports | null | undefined,
  perfil: MonitoreoProfile | null | undefined,
): CasoDeDiscrepancia[] {
  const envios = new Map<string, { responseId: string; enumerador: string; fecha: string }>();
  filasDeBloque(reports, ["control_tiempo_kobo"]).forEach((fila) => {
    const codigo = texto(fila.CodPulso);
    if (!codigo || envios.has(codigo)) return;
    envios.set(codigo, {
      responseId: texto(fila["Response ID"]),
      enumerador: texto(fila["Responsable plataforma"]),
      fecha: texto(fila["Fecha Kobo"]),
    });
  });
  const decisiones = new Map(decisionesTelefonicas(perfil).map((item) => [item.response_id, item]));
  const porCodigo = new Map(decisionesTelefonicas(perfil).map((item) => [item.declared_code, item]));
  const equivalencias = perfil?.enumerator_equivalences ?? [];
  return filasDeBloque(reports, ["discrepancias_telefonicas"]).map((fila) => {
    const codigo = texto(fila.CodPulso);
    const envio = envios.get(codigo);
    const responsable = texto(fila.Responsable);
    const enumerador = envio?.enumerador ?? "";
    const decision = (envio?.responseId ? decisiones.get(envio.responseId) : undefined) ?? porCodigo.get(codigo);
    const sinResponsable = !responsable || /^sin (responsable|asignar)$/i.test(responsable);
    return {
      sentido: texto(fila.Sentido) === "hoja_sin_kobo" ? "hoja_sin_kobo" : "kobo_sin_hoja",
      codigo,
      progres: texto(fila.proGres),
      responsable: sinResponsable ? SIN_RESPONSABLE : responsable,
      hojaDice: texto(fila["La hoja dice"]),
      fechaHoja: texto(fila["Fecha hoja"]),
      fechaKobo: texto(fila["Fecha Kobo"]) || envio?.fecha || "",
      responseId: envio?.responseId ?? decision?.response_id ?? "",
      enumerador,
      enumeradorDistinto: Boolean(enumerador && !sinResponsable && clave(nombreEnLaHoja(enumerador, equivalencias)) !== clave(responsable)),
      decision: !decision ? "pendiente" : decision.action === "keep_excluded" ? "no_cuenta" : "cuenta",
      nota: decision?.note ?? "",
      decididoEl: decision?.decided_at ?? "",
    } satisfies CasoDeDiscrepancia;
  });
}

/**
 * Los envíos que el supervisor sacó del avance («No cuenta»): ya no son
 * efectiva de Kobo, así que el bloque no los trae; se listan desde la decisión
 * para que la decisión siga a la vista y se pueda revertir.
 */
export function casosSacados(perfil: MonitoreoProfile | null | undefined, vigentes: readonly CasoDeDiscrepancia[]) {
  const vistos = new Set(vigentes.map((caso) => caso.responseId).filter(Boolean));
  return decisionesTelefonicas(perfil)
    .filter((item) => item.action === "keep_excluded" && !vistos.has(item.response_id))
    .map((item) => ({ codigo: item.declared_code, responseId: item.response_id, nota: item.note, decididoEl: item.decided_at }));
}

export type GrupoPorResponsable = { responsable: string; casos: CasoDeDiscrepancia[] };

/** Para avisar al equipo: un grupo por responsable, los de más casos primero; «Sin asignar» al final. */
export function porResponsable(casos: readonly CasoDeDiscrepancia[]): GrupoPorResponsable[] {
  const grupos = new Map<string, CasoDeDiscrepancia[]>();
  casos.forEach((caso) => grupos.set(caso.responsable, [...(grupos.get(caso.responsable) ?? []), caso]));
  return [...grupos.entries()]
    .map(([responsable, lista]) => ({ responsable, casos: [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true })) }))
    .sort((a, b) => Number(a.responsable === SIN_RESPONSABLE) - Number(b.responsable === SIN_RESPONSABLE)
      || b.casos.length - a.casos.length
      || a.responsable.localeCompare(b.responsable, "es"));
}

const QUE_PASA: Record<SentidoDeDiscrepancia, string> = {
  kobo_sin_hoja: "Kobo tiene la efectiva y la hoja no la marca «Efectivo»",
  hoja_sin_kobo: "La hoja dice «Efectivo» y Kobo no tiene envío",
};

export function queDice(caso: Pick<CasoDeDiscrepancia, "sentido" | "hojaDice">) {
  return caso.sentido === "kobo_sin_hoja" ? `${QUE_PASA.kobo_sin_hoja} (dice «${caso.hojaDice || "sin status"}»)` : QUE_PASA.hoja_sin_kobo;
}

/** Texto para pegar en el chat del equipo: un bloque por responsable, un caso por línea. */
export function textoParaElEquipo(grupos: readonly GrupoPorResponsable[]) {
  return grupos.map((grupo) => [
    `${grupo.responsable} (${grupo.casos.length.toLocaleString("es-PE")})`,
    ...grupo.casos.map((caso) => `- ${caso.codigo}${caso.progres ? ` · proGres ${caso.progres}` : ""}: ${queDice(caso)}`),
  ].join("\n")).join("\n\n");
}

function celdaCsv(valor: string) {
  return /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** CSV con una fila por caso, para abrir en Excel o subir a la hoja del equipo. */
export function csvParaElEquipo(casos: readonly CasoDeDiscrepancia[]) {
  const cabecera = ["Responsable", "CodPulso", "proGres", "Qué pasa", "La hoja dice", "Fecha hoja", "Envío en Kobo", "Enumerador Kobo", "Decisión"];
  const decision: Record<EstadoDeDecision, string> = { pendiente: "Cuenta mientras tanto", cuenta: "Cuenta", no_cuenta: "No cuenta" };
  const filas = casos.map((caso) => [
    caso.responsable, caso.codigo, caso.progres, QUE_PASA[caso.sentido], caso.hojaDice, caso.fechaHoja, caso.fechaKobo, caso.enumerador,
    caso.sentido === "kobo_sin_hoja" ? decision[caso.decision] : "Va a Avisos",
  ]);
  return [cabecera, ...filas].map((fila) => fila.map(celdaCsv).join(",")).join("\n");
}

export type ResumenDeDiscrepancias = { koboSinHoja: number; hojaSinKobo: number; pendientes: number; decididos: number };

export function resumenDeDiscrepancias(casos: readonly CasoDeDiscrepancia[], sacados = 0): ResumenDeDiscrepancias {
  const kobo = casos.filter((caso) => caso.sentido === "kobo_sin_hoja");
  return {
    koboSinHoja: kobo.length,
    hojaSinKobo: casos.length - kobo.length,
    pendientes: kobo.filter((caso) => caso.decision === "pendiente").length,
    decididos: kobo.filter((caso) => caso.decision !== "pendiente").length + sacados,
  };
}

/** Sugerencias de equivalencia (P4): enumeradores de Kobo sin igual en la hoja, emparejados por parecido. */
export function sugerenciasDeEquivalencia(
  enumeradores: readonly string[],
  responsables: readonly string[],
  confirmadas: ReadonlyArray<{ kobo: string; hoja: string }> = [],
) {
  const hoja = [...new Set(responsables.filter(Boolean))];
  const porClave = new Map(hoja.map((nombre) => [clave(nombre), nombre]));
  const yaConfirmados = new Set(confirmadas.map((item) => clave(item.kobo)));
  return [...new Set(enumeradores.filter(Boolean))]
    .filter((enumerador) => !porClave.has(clave(enumerador)) && !yaConfirmados.has(clave(enumerador)))
    .map((enumerador) => {
      const k = clave(enumerador);
      const digitos = k.replace(/\D/g, "");
      const parecido = hoja.find((nombre) => {
        const h = clave(nombre);
        if (digitos && h.replace(/\D/g, "") === digitos && h.replace(/\d/g, "") === k.replace(/\d/g, "")) return true;
        return h.length >= 4 && (h.includes(k) || k.includes(h));
      }) ?? "";
      return { kobo: enumerador, hoja: parecido };
    })
    .sort((a, b) => a.kobo.localeCompare(b.kobo, "es", { numeric: true }));
}
