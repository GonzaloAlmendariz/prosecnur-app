import type { HojasRutaPhase } from "../../../api/hojasRuta";

/**
 * P1 de la paridad con la página clásica. La etapa es la corrida que mira Hojas de ruta y lo que
 * declara el Planner es una propuesta (ADR 0123 §6; Gonzalo: «fase y ventana: propuesta; se mantiene
 * Alinear en Monitoreo y Hojas»), así que desde la barra:
 *   - el chip de fase abre la otra corrida;
 *   - si el Planner propone otra etapa, se ve la diferencia y «Alinear» la abre con un clic;
 *   - con un piloto y un Campo real todavía vacío, se crea Campo real desde el piloto. Con muestra o
 *     envío en campo no se ofrece: el backend lo rechaza (E_HOJAS_RUTA_CAMPO_CON_MUESTRA) porque
 *     reemplazaría la corrida entera.
 * Una sola fase en juego: la que se ve es la que usan los cálculos y el envío (hojas_ruta_etapa.R).
 */

export type EtapaDelEstudio = { fase: HojasRutaPhase; planner?: HojasRutaPhase | null; alineada?: boolean };

export type ChipDeFase = {
  id: "fase" | "alinear" | "crear-campo";
  label: string;
  tone: "info" | "warn";
  detail: string;
  /** Qué hace el clic; ausente, el chip sólo informa. */
  accion?: { tipo: "ver"; fase: HojasRutaPhase } | { tipo: "crear-campo" };
};

const NOMBRE: Record<HojasRutaPhase, string> = { pilot: "Piloto", field: "Campo real" };

export function chipsDeFase(args: {
  fase: HojasRutaPhase;
  hayPiloto: boolean;
  /** Campo real tiene muestra sorteada o envío a Material. */
  campoConMuestra: boolean;
  evitaPiloto: boolean;
  etapa: EtapaDelEstudio | null;
}): ChipDeFase[] {
  const { fase, hayPiloto, campoConMuestra, evitaPiloto, etapa } = args;
  const otra: HojasRutaPhase = fase === "pilot" ? "field" : "pilot";
  // La corrida de campo siempre existe; la piloto, sólo si se hizo.
  const hayOtra = otra === "pilot" ? hayPiloto : true;
  const base = fase === "pilot" ? "La corrida piloto es histórica: se consulta, no se cambia." : evitaPiloto ? "Campo real · evita las titulares del piloto." : "Campo real.";
  const chips: ChipDeFase[] = [
    {
      id: "fase",
      label: NOMBRE[fase],
      tone: "info",
      // La corrida que se mira es la etapa que usan el envío y la campaña: pasar a la otra es una decisión.
      detail: hayOtra ? `${base} Clic para pasar a la corrida de ${NOMBRE[otra]}: es la que se envía a Material.` : base,
      ...(hayOtra ? { accion: { tipo: "ver" as const, fase: otra } } : {}),
    },
  ];
  // Defensivo: sólo una fase conocida es una propuesta (un payload viejo o un `{}` no lo son).
  const propuesta = etapa?.planner === "pilot" || etapa?.planner === "field" ? etapa.planner : null;
  if (propuesta && propuesta !== fase && (propuesta === "field" || hayPiloto)) {
    chips.push({
      id: "alinear",
      label: `Planner: ${NOMBRE[propuesta]} · Alinear`,
      tone: "warn",
      detail: `El Planner propone la etapa ${NOMBRE[propuesta]} y aquí estás en ${NOMBRE[fase]}. Alinear abre la corrida de ${NOMBRE[propuesta]}; nada cambia sin ese clic.`,
      accion: { tipo: "ver", fase: propuesta },
    });
  }
  if (hayPiloto && !campoConMuestra) {
    chips.push({
      id: "crear-campo",
      label: "Crear Campo real",
      tone: "info",
      detail: "Campo real todavía no tiene muestra: créalo desde el piloto. Copia el diseño del piloto sobre el de Campo real y evita sus titulares (la regla se cambia en Manzanas).",
      accion: { tipo: "crear-campo" },
    });
  }
  return chips;
}
