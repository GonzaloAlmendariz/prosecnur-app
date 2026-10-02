/**
 * Lo que la cabecera de Muestra general y Acreditación sabe sin React: en qué
 * punto está el diseño (estado + siguiente condición) y qué cifras vigentes
 * muestra la banda «Diseño vigente».
 *
 * La banda sólo publica lo que ya existe —marco declarado, n del motor,
 * corrida sorteada—; nunca una estimación. Sin dato, dice «—» y por qué.
 */
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import {
  normalizeCalcMuestraMemoriaCalculo,
  type CalcMuestraGeneralCorrida,
  type CalcMuestraGeneralMarco,
} from "../../../api/calcMuestraGeneral";
import { criterioSalida } from "../criterioSalida";
import { presentResultadoPrecision } from "../resultadoPrecision";
import { fmtInt, fmtPct, safeNumber } from "../sharedCore";
import { tecnicaDelActor } from "./actores";
import { productoLabel, tecnicaCalculadaLabel, tecnicaProducto } from "./catalogos";
import {
  campoMetaDelActor,
  esTecnicaDeElementos,
  etiquetaMetodo,
  formatearFechaLocal,
  hashCorto,
  modalidadDeTecnica,
  nDesfasado,
} from "./modelo";
import { precisionEnPalabras } from "./modeloParametros";
import { hayResultado, type ModoMesa } from "./secciones";
import { CLAVE_SIN_ESTRATO } from "./tituloCorrida";

// ---------------------------------------------------------------------------
// Estado de la mesa y siguiente condición
// ---------------------------------------------------------------------------

export type ClaveEstadoMesa =
  | "leyendo"
  | "sin-marco"
  | "sin-calculo"
  | "sin-memoria"
  | "sin-sorteo"
  | "desactualizado"
  | "parcial"
  | "listo";

export type TonoEstadoMesa = "pendiente" | "alerta" | "ok";

export type AccionSiguiente =
  | { tipo: "seccion"; seccion: string; etiqueta: string }
  | { tipo: "calcular"; etiqueta: string };

export type EstadoMesa = {
  clave: ClaveEstadoMesa;
  tono: TonoEstadoMesa;
  /** Rótulo corto del chip: «Falta calcular», «Diseño completo». */
  etiqueta: string;
  /** La siguiente condición en una frase; `null` si no hay nada que hacer. */
  siguiente: string | null;
  accion: AccionSiguiente | null;
};

const irA = (seccion: string, etiqueta: string): AccionSiguiente => ({ tipo: "seccion", seccion, etiqueta });
const CALCULAR: AccionSiguiente = { tipo: "calcular", etiqueta: "Calcular" };

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${fmtInt(n)} ${n === 1 ? singular : pluralTexto}`;
}

/** N del componente: el del archivo declarado manda; si no, el del marco del estudio. */
export function nDelMarco(
  comp: Pick<CalcMuestraComponente, "marco"> | null,
  marco: Pick<CalcMuestraGeneralMarco, "N"> | null,
): number {
  if (marco && marco.N > 0) return marco.N;
  return safeNumber(comp?.marco?.marco_validado, 0);
}

// ---------------------------------------------------------------------------
// Sorteo vigente: una sola definición para banda, fichas, estado y Selección
// ---------------------------------------------------------------------------

export type MotivoDesactualizado = "marco" | "calculo" | "n" | "tecnica";

export type VigenciaSorteo =
  | {
      estado: "sin-sorteo";
      /**
       * Hay una corrida guardada pero la técnica actual no se sortea: la
       * corrida es de un diseño anterior y no cuenta. `null` si no hay corrida.
       */
      huerfana?: string | null;
    }
  | { estado: "vigente" }
  | {
      estado: "desactualizado";
      motivo: MotivoDesactualizado;
      /** Qué cambió, en una frase con cifras. */
      texto: string;
      /** El n a campo vigente cuando el motivo es `n`. */
      nCampo: number | null;
    };

const MODALIDAD_EN_PALABRAS: Record<"censo" | "probabilistica", string> = {
  censo: "cobertura censal",
  probabilistica: "muestra probabilística",
};

/**
 * Un sorteo cuenta como vigente sólo si responde al diseño actual: la técnica
 * actual se sortea y con la misma modalidad, se hizo sobre el mismo marco
 * (huella y N), el componente sigue calculado y, fuera del censo, con el
 * mismo n a campo. Una corrida guardada que ya no cumple eso existe, pero no
 * es «sorteado».
 *
 * Si la técnica actual no se sortea (no da π), la corrida vieja no es un
 * «sorteo viejo» sino ningún sorteo: «Sorteo viejo» invita a sortear de nuevo
 * y Selección no lo ofrece para esa técnica (E15 P6). Si la técnica se sortea
 * pero con otra modalidad (censo ↔ probabilística), sí es un sorteo viejo.
 */
export function vigenciaSorteo(args: {
  comp: CalcMuestraComponente | null;
  corrida: CalcMuestraGeneralCorrida | null;
  marco?: Pick<CalcMuestraGeneralMarco, "marco_hash" | "N"> | null;
}): VigenciaSorteo {
  const { comp, corrida } = args;
  const marco = args.marco ?? null;
  if (!corrida) return { estado: "sin-sorteo", huerfana: null };
  const c = corrida.corrida;
  if (comp && !tecnicaDelActor(comp.tecnica).sorteable) {
    return {
      estado: "sin-sorteo",
      huerfana: `La técnica actual no admite selección aleatoria: la selección guardada (${MODALIDAD_EN_PALABRAS[c.modalidad]}) es de un diseño anterior y no cuenta.`,
    };
  }
  if (marco?.marco_hash && c.marco_hash && marco.marco_hash !== c.marco_hash) {
    return {
      estado: "desactualizado",
      motivo: "marco",
      texto: `El marco cambió después del sorteo (huella ${hashCorto(c.marco_hash, 8)} → ${hashCorto(marco.marco_hash, 8)}).`,
      nCampo: null,
    };
  }
  if (!comp || !hayResultado([comp])) {
    return {
      estado: "desactualizado",
      motivo: "calculo",
      texto: "La selección quedó de un cálculo que ya no existe: calcula de nuevo.",
      nCampo: null,
    };
  }
  const modalidadActual = modalidadDeTecnica(comp.tecnica);
  if (modalidadActual !== "sin_sorteo" && modalidadActual !== c.modalidad) {
    return {
      estado: "desactualizado",
      motivo: "tecnica",
      texto: `La selección se hizo como ${MODALIDAD_EN_PALABRAS[c.modalidad]}; la técnica actual pide ${MODALIDAD_EN_PALABRAS[modalidadActual]}.`,
      nCampo: null,
    };
  }
  if (c.modalidad === "censo") {
    const N = nDelMarco(comp, marco);
    if (N > 0 && safeNumber(c.N, 0) > 0 && Math.round(N) !== Math.round(c.N)) {
      return {
        estado: "desactualizado",
        motivo: "marco",
        texto: `El marco tiene ${fmtInt(N)} unidades; la selección ordenó ${fmtInt(c.N)}.`,
        nCampo: null,
      };
    }
    return { estado: "vigente" };
  }
  const desfase = nDesfasado(corrida, comp);
  if (desfase != null) {
    return {
      estado: "desactualizado",
      motivo: "n",
      texto: `La muestra a contactar es ${fmtInt(desfase)}; la selección usó ${fmtInt(corrida.n_fuente)}.`,
      nCampo: desfase,
    };
  }
  return { estado: "vigente" };
}

/** `true` si la técnica exige memoria de cálculo y el resultado guardado no la trae. */
export function faltaMemoria(comp: Pick<CalcMuestraComponente, "tecnica" | "resultado">): boolean {
  if (!esTecnicaDeElementos(comp.tecnica) || !comp.resultado) return false;
  return normalizeCalcMuestraMemoriaCalculo(comp.resultado.memoria_calculo).length === 0;
}

/** Muestra general: marco → cálculo → sorteo, con el primer eslabón que falta. */
export function estadoMesaGeneral(args: {
  comp: CalcMuestraComponente | null;
  marco: CalcMuestraGeneralMarco | null;
  corrida: CalcMuestraGeneralCorrida | null;
  cargado: boolean;
}): EstadoMesa {
  const { comp, marco, corrida, cargado } = args;
  if (!comp || !(nDelMarco(comp, marco) > 0)) {
    return {
      clave: "sin-marco",
      tono: "pendiente",
      etiqueta: "Falta el marco muestral",
      siguiente: "Declara el archivo de unidades y sus columnas.",
      accion: irA("marco", "Ir a Marco"),
    };
  }
  if (!hayResultado([comp])) {
    return {
      clave: "sin-calculo",
      tono: "pendiente",
      etiqueta: "Falta calcular",
      siguiente: "Calcula el n con los parámetros de Método.",
      accion: CALCULAR,
    };
  }
  if (faltaMemoria(comp)) {
    return {
      clave: "sin-memoria",
      tono: "alerta",
      etiqueta: "Falta la memoria",
      siguiente: "El n guardado no trae su memoria de cálculo: vuelve a calcular.",
      accion: { tipo: "calcular", etiqueta: "Recalcular" },
    };
  }
  const modalidad = modalidadDeTecnica(comp.tecnica);
  if (modalidad === "sin_sorteo") {
    return {
      clave: "listo",
      tono: "ok",
      etiqueta: "n calculado",
      siguiente: "Esta técnica no selecciona unidades: el n es la entrega.",
      accion: irA("resultados", "Ver Resultados"),
    };
  }
  if (!cargado) {
    return { clave: "leyendo", tono: "pendiente", etiqueta: "n calculado", siguiente: "Leyendo la última selección…", accion: null };
  }
  if (!marco) {
    return {
      clave: "sin-sorteo",
      tono: "pendiente",
      etiqueta: "Falta el archivo",
      siguiente: "La selección sale del archivo de unidades: decláralo en Marco.",
      accion: irA("marco", "Ir a Marco"),
    };
  }
  if (!corrida) {
    return {
      clave: "sin-sorteo",
      tono: "pendiente",
      etiqueta: "Falta seleccionar",
      siguiente: modalidad === "censo"
        ? "Ordena el marco al azar para el contacto."
        : "Selecciona la muestra a contactar con una semilla reproducible.",
      accion: irA("seleccion", "Ir a Selección"),
    };
  }
  const vigencia = vigenciaSorteo({ comp, corrida, marco });
  if (vigencia.estado === "desactualizado") {
    return {
      clave: "desactualizado",
      tono: "alerta",
      etiqueta: "Selección desactualizada",
      siguiente: vigencia.texto,
      accion: irA("seleccion", "Seleccionar de nuevo"),
    };
  }
  return {
    clave: "listo",
    tono: "ok",
    etiqueta: "Diseño completo",
    siguiente: "Calculado y sorteado: listo para el reporte.",
    accion: irA("resultados", "Ver Resultados"),
  };
}

/** Acreditación: el estado agregado de los actores, con el eslabón más atrasado. */
export function estadoMesaAcreditacion(args: {
  componentes: readonly CalcMuestraComponente[];
  corridas: Readonly<Record<string, CalcMuestraGeneralCorrida>>;
  marcos?: Readonly<Record<string, CalcMuestraGeneralMarco>>;
  cargado: boolean;
}): EstadoMesa {
  const { componentes, corridas, cargado } = args;
  const marcos = args.marcos ?? {};
  if (componentes.length === 0) {
    return {
      clave: "sin-marco",
      tono: "pendiente",
      etiqueta: "Sin actores",
      siguiente: "Agrega los actores del estudio.",
      accion: irA("actores", "Ir a Actores"),
    };
  }
  const conN = componentes.filter((c) => nDelMarco(c, null) > 0);
  if (conN.length === 0) {
    return {
      clave: "sin-marco",
      tono: "pendiente",
      etiqueta: "Falta el N",
      siguiente: "Declara el marco (N) de cada actor.",
      accion: irA("actores", "Ir a Actores"),
    };
  }
  const sinCalculo = conN.filter((c) => !hayResultado([c]));
  if (sinCalculo.length > 0) {
    return {
      clave: "sin-calculo",
      tono: "pendiente",
      etiqueta: "Falta calcular",
      siguiente: `${plural(sinCalculo.length, "actor con N", "actores con N")} sin n calculado.`,
      accion: CALCULAR,
    };
  }
  const sorteables = conN.filter((c) => tecnicaDelActor(c.tecnica).sorteable);
  if (sorteables.length > 0 && !cargado) {
    return { clave: "leyendo", tono: "pendiente", etiqueta: "n calculado", siguiente: "Leyendo las selecciones…", accion: null };
  }
  const desactualizados = sorteables.filter((c) => (
    vigenciaSorteo({ comp: c, corrida: corridas[c.id] ?? null, marco: marcos[c.id] ?? null }).estado === "desactualizado"
  ));
  if (desactualizados.length > 0) {
    return {
      clave: "desactualizado",
      tono: "alerta",
      etiqueta: "Selección desactualizada",
      siguiente: `${plural(desactualizados.length, "actor tiene", "actores tienen")} una selección que ya no responde a su marco, su n o su técnica.`,
      accion: irA("seleccion", "Ir a Selección"),
    };
  }
  const sinSorteo = sorteables.filter((c) => !corridas[c.id]);
  if (sinSorteo.length > 0) {
    return {
      clave: "sin-sorteo",
      tono: "pendiente",
      etiqueta: "Falta seleccionar",
      siguiente: `Falta seleccionar ${fmtInt(sinSorteo.length)} de ${plural(sorteables.length, "actor con π", "actores con π")}.`,
      accion: irA("seleccion", "Ir a Selección"),
    };
  }
  const sinN = componentes.length - conN.length;
  if (sinN > 0) {
    return {
      clave: "parcial",
      tono: "pendiente",
      etiqueta: "Actores sin N",
      siguiente: `${plural(sinN, "actor queda", "actores quedan")} fuera del cálculo por no tener marco.`,
      accion: irA("actores", "Ir a Actores"),
    };
  }
  return {
    clave: "listo",
    tono: "ok",
    etiqueta: "Diseño completo",
    siguiente: "Todos los actores calculados: listo para el reporte.",
    accion: irA("resultados", "Ver Resultados"),
  };
}

/** La acción no lleva a la sección en la que ya se está. */
export function accionVisible(estado: EstadoMesa, seccionActual: string): AccionSiguiente | null {
  const accion = estado.accion;
  if (!accion) return null;
  if (accion.tipo === "seccion" && accion.seccion === seccionActual) return null;
  return accion;
}

// ---------------------------------------------------------------------------
// Cifras de la banda
// ---------------------------------------------------------------------------

export type CifraBanda = {
  clave: string;
  label: string;
  value: string;
  detalle?: string;
  origen?: "motor";
  hero?: boolean;
  tono?: "ok" | "alerta";
  monospace?: boolean;
};

/** Estratos declarados: los del archivo, si no los del cálculo, si no los del estudio. */
export function estratosDeclarados(
  comp: Pick<CalcMuestraComponente, "marco" | "resultado"> | null,
  marco: Pick<CalcMuestraGeneralMarco, "columnas" | "estratos"> | null,
): number {
  if (marco) return marco.columnas.estrato ? marco.estratos.length : 0;
  const distribucion = (comp?.resultado?.distribucion_estratos ?? []).filter((e) => e.estrato !== CLAVE_SIN_ESTRATO);
  if (distribucion.length > 0) return distribucion.length;
  return comp?.marco?.estratos?.length ?? 0;
}

/**
 * El margen alcanzado frente al pedido: una sola lectura para la tarjeta de la
 * banda y el veredicto de Resultados. `cumple` es `null` si no se pueden
 * comparar (sin π, sin margen pedido o sin cálculo).
 */
export function margenComparado(comp: CalcMuestraComponente): {
  alcanzado: string;
  pedido: string | null;
  cumple: boolean | null;
} {
  const r = comp.resultado ?? null;
  const precision = presentResultadoPrecision({
    naturaleza: comp.naturaleza,
    precisionAlcanzada: r?.precision_alcanzada,
    coberturaObjetivo: r?.cobertura_objetivo,
  });
  const valor = r ? precisionEnPalabras(comp, precision.value) : "—";
  const pedido = safeNumber(comp.parametros?.e, NaN);
  const alcanzado = safeNumber(r?.precision_alcanzada, NaN);
  const comparable = comp.naturaleza === "prob" && Number.isFinite(pedido) && Number.isFinite(alcanzado) && pedido > 0;
  return {
    alcanzado: valor !== "—" && !valor.startsWith("±") ? `±${valor}` : valor,
    pedido: Number.isFinite(pedido) ? `±${fmtPct(pedido)}` : null,
    cumple: comparable ? alcanzado <= pedido * (1 + 1e-6) : null,
  };
}

function cifraMargen(comp: CalcMuestraComponente): CifraBanda {
  // Una técnica operativa (cobertura censal, barrido) no tiene margen: lo que
  // publica es la cobertura objetivo. Se rotulaba «Margen alcanzado ±50.0% ·
  // pedido ±5.0%» (2026-09-27).
  if (comp.naturaleza === "operativo") {
    const cobertura = safeNumber(comp.resultado?.cobertura_objetivo ?? comp.parametros?.cobertura_objetivo, NaN);
    return {
      clave: "margen",
      label: "Cobertura objetivo",
      value: Number.isFinite(cobertura) ? fmtPct(cobertura) : "—",
      detalle: "sin margen de error",
      origen: comp.resultado ? "motor" : undefined,
    };
  }
  const m = margenComparado(comp);
  const noAlcanza = m.cumple === false;
  return {
    clave: "margen",
    label: "Margen alcanzado",
    value: m.alcanzado,
    detalle: comp.naturaleza === "no_prob"
      ? "no aplica sin π"
      : m.pedido ? `pedido ${m.pedido}${noAlcanza ? " · no se alcanza" : ""}` : undefined,
    // El sello «cifra validada» se lee como «cumple»: con un margen que no
    // alcanza el pedido se omite y la tarjeta queda en alerta (L4).
    origen: comp.resultado && !noAlcanza ? "motor" : undefined,
    tono: m.cumple == null ? undefined : m.cumple ? "ok" : "alerta",
  };
}

// Las causas que el motor redacta cuando el margen no alcanza el pedido: el
// marco topado (`.cm_general_aviso_margen_topado`) y el piso o el mínimo de 2
// por estrato (`.cm_calc_estratificado`). Se citan tal cual, sin el cierre
// genérico que las acompaña en `advertencia`.
const CAUSAS_MARGEN = [
  /Abordando el marco completo.*?acepta ese margen\./,
  /Con (?:el piso|el mínimo).*?supera el declarado.*?: sube n(?: o baja el piso)?\./,
];

/** Por qué el margen no alcanza el pedido, para decirlo donde se decide (Método). */
export function avisoMargenGeneral(comp: CalcMuestraComponente | null): string | null {
  if (!comp) return null;
  const m = margenComparado(comp);
  if (m.cumple !== false) return null;
  const advertencia = comp.resultado?.advertencia ?? "";
  for (const causa of CAUSAS_MARGEN) {
    const hallada = advertencia.match(causa);
    if (hallada) return hallada[0];
  }
  return `El n no alcanza el margen pedido: ${m.alcanzado} frente a ${m.pedido ?? "—"}.`;
}

/** Las cifras de Muestra general; en Selección suma la corrida. */
export function cifrasDisenoGeneral(args: {
  comp: CalcMuestraComponente | null;
  marco: CalcMuestraGeneralMarco | null;
  corrida: CalcMuestraGeneralCorrida | null;
  seccion: string;
}): CifraBanda[] {
  const { comp, marco, corrida, seccion } = args;
  const N = nDelMarco(comp, marco);
  const k = estratosDeclarados(comp, marco);
  const r = comp?.resultado ?? null;
  const calculado = Boolean(comp && hayResultado([comp]));
  const tasa = safeNumber(r?.tasa_respuesta_esperada ?? comp?.parametros?.tasa_respuesta, NaN);
  const sobre = safeNumber(comp?.parametros?.oversample_pct, 0);

  const cifras: CifraBanda[] = [
    {
      clave: "N",
      label: "Tamaño del marco (N)",
      value: N > 0 ? fmtInt(N) : "—",
      detalle: marco
        ? `${marco.hoja ? `${marco.hoja} · ` : ""}huella ${hashCorto(marco.marco_hash, 8)}`
        : N > 0 ? "sin archivo declarado" : "sin declarar",
    },
    {
      clave: "estratos",
      label: "Estratos",
      value: k > 0 ? fmtInt(k) : "Sin estrato",
      detalle: marco?.columnas.estrato ? `columna ${marco.columnas.estrato}` : k > 0 ? "del cálculo" : "marco sin estratos",
    },
    {
      clave: "n",
      label: "Casos completos",
      value: calculado ? fmtInt(r?.n_objetivo) : "—",
      detalle: calculado ? "encuestas completas" : "sin calcular",
      origen: calculado ? "motor" : undefined,
      hero: true,
    },
    {
      clave: "campo",
      label: "Muestra a contactar",
      value: calculado ? fmtInt(r?.n_operativo) : "—",
      detalle: calculado && Number.isFinite(tasa)
        ? `respuesta ${fmtPct(tasa)}${sobre > 0 ? ` · +${fmtPct(sobre)}` : ""}`
        : calculado ? "casos a abordar" : "sin calcular",
      origen: calculado ? "motor" : undefined,
    },
  ];
  if (comp) cifras.push(cifraMargen(comp));
  if (comp) {
    cifras.push({
      clave: "tecnica",
      label: "Técnica",
      // El «·» va pegado a la técnica (espacio duro): suelto, en la banda
      // compacta de 1024 px caía solo en una línea y la cifra ocupaba tres.
      value: tecnicaCalculadaLabel(comp).replace(" · ", "\u00a0· "),
      detalle: productoLabel(tecnicaProducto(comp)),
    });
  }

  if (seccion === "seleccion") {
    const vigencia = vigenciaSorteo({ comp, corrida, marco });
    // Una corrida de una técnica que ya no se sortea no se publica (E15 P6).
    const c = vigencia.estado === "sin-sorteo" ? null : corrida?.corrida ?? null;
    cifras.push(
      {
        clave: "semilla",
        label: "Semilla",
        value: c ? String(c.semilla) : "—",
        detalle: c ? (c.modalidad === "censo" ? "orden de contacto" : etiquetaMetodo(c.metodo)) : "sin selección",
        monospace: true,
      },
      {
        clave: "sorteo",
        // Rótulo de una palabra, como el resto de la fila: «Titulares +
        // reservas» se partía en dos líneas y descuadraba las alturas (C2).
        label: c?.modalidad === "censo" ? "A contactar" : "Selección",
        value: c
          ? c.modalidad === "censo" ? fmtInt(c.n_titulares) : `${fmtInt(c.n_titulares)} + ${fmtInt(c.n_reservas)}`
          : "—",
        detalle: c && corrida
          ? [
              c?.modalidad === "censo" ? null : "principales + reemplazos",
              vigencia.estado === "desactualizado" ? "desactualizado" : formatearFechaLocal(corrida.sorteado_at),
            ].filter(Boolean).join(" · ")
          : "sin selección",
        tono: vigencia.estado === "desactualizado" ? "alerta" : undefined,
      },
    );
  }
  return cifras;
}

/** La cadena del diseño en una línea: marco → completas → a campo → sorteo. */
export function cadenaDisenoGeneral(args: {
  comp: CalcMuestraComponente | null;
  marco: CalcMuestraGeneralMarco | null;
  corrida: CalcMuestraGeneralCorrida | null;
}): string[] {
  const { comp, marco, corrida } = args;
  const N = nDelMarco(comp, marco);
  const pasos = [N > 0 ? `Marco ${fmtInt(N)}` : "Marco sin declarar"];
  if (comp && hayResultado([comp])) {
    pasos.push(`${fmtInt(comp.resultado?.n_objetivo)} completas`, `${fmtInt(comp.resultado?.n_operativo)} a contactar`);
  } else {
    pasos.push("n por calcular");
  }
  if (corrida && vigenciaSorteo({ comp, corrida, marco }).estado !== "sin-sorteo") {
    pasos.push(`semilla ${corrida.corrida.semilla}`);
  }
  return pasos;
}

// ---------------------------------------------------------------------------
// Acreditación
// ---------------------------------------------------------------------------

export type FaseActor = "sin-n" | "sin-calculo" | "calculado" | "sin-sorteo" | "sorteado" | "desactualizado";

export type ActorBanda = {
  id: string;
  nombre: string;
  tecnica: string;
  /**
   * «sorteado» sólo con un sorteo vigente (`vigenciaSorteo`); una corrida
   * guardada que ya no responde al marco o al n es «desactualizado».
   */
  fase: FaseActor;
  resumen: string;
};

export const FASE_ACTOR_ETIQUETA: Record<FaseActor, string> = {
  "sin-n": "Sin N",
  "sin-calculo": "Por calcular",
  calculado: "Calculado",
  "sin-sorteo": "Sin selección",
  sorteado: "Seleccionado",
  desactualizado: "Selección desactualizada",
};

function nombreActor(c: Pick<CalcMuestraComponente, "actor" | "actor_id" | "id">): string {
  return c.actor?.trim() || c.actor_id?.trim() || c.id;
}

type CorridasPorId = Readonly<Record<string, CalcMuestraGeneralCorrida>>;
type MarcosPorId = Readonly<Record<string, CalcMuestraGeneralMarco>>;

/** Los conteos de sorteo de Acreditación: la tarjeta, la cadena y el estado leen éstos. */
export function conteoSorteosAcreditacion(args: {
  componentes: readonly CalcMuestraComponente[];
  corridas: CorridasPorId;
  marcos?: MarcosPorId;
}): { sorteables: number; vigentes: number; desactualizados: number } {
  const marcos = args.marcos ?? {};
  const sorteables = args.componentes.filter((c) => nDelMarco(c, null) > 0 && tecnicaDelActor(c.tecnica).sorteable);
  let vigentes = 0;
  let desactualizados = 0;
  for (const c of sorteables) {
    const v = vigenciaSorteo({ comp: c, corrida: args.corridas[c.id] ?? null, marco: marcos[c.id] ?? null });
    if (v.estado === "vigente") vigentes += 1;
    else if (v.estado === "desactualizado") desactualizados += 1;
  }
  return { sorteables: sorteables.length, vigentes, desactualizados };
}

export function faseDelActor(
  c: CalcMuestraComponente,
  corrida: CalcMuestraGeneralCorrida | null,
  marco: CalcMuestraGeneralMarco | null,
): FaseActor {
  if (!(nDelMarco(c, null) > 0)) return "sin-n";
  if (!hayResultado([c])) return "sin-calculo";
  // Lo mismo que Selección: una técnica sin π dice «Sin sorteo», tenga o no
  // una corrida de un diseño anterior (E15 P6).
  if (!tecnicaDelActor(c.tecnica).sorteable) return "sin-sorteo";
  const v = vigenciaSorteo({ comp: c, corrida, marco });
  if (v.estado === "vigente") return "sorteado";
  if (v.estado === "desactualizado") return "desactualizado";
  return "calculado";
}

export function cifrasDisenoAcreditacion(args: {
  componentes: readonly CalcMuestraComponente[];
  corridas: CorridasPorId;
  marcos?: MarcosPorId;
}): { totales: CifraBanda[]; actores: ActorBanda[]; cadena: string[] } {
  const { componentes, corridas } = args;
  const marcos = args.marcos ?? {};
  const conN = componentes.filter((c) => nDelMarco(c, null) > 0);
  const calculados = componentes.filter((c) => hayResultado([c]));
  const sorteos = conteoSorteosAcreditacion({ componentes, corridas, marcos });
  const suma = (lista: readonly CalcMuestraComponente[], valor: (c: CalcMuestraComponente) => unknown) =>
    lista.reduce((acc, c) => acc + safeNumber(valor(c), 0), 0);

  const totales: CifraBanda[] = [
    {
      clave: "actores",
      label: "Actores",
      value: fmtInt(componentes.length),
      detalle: `${fmtInt(conN.length)} con N · ${fmtInt(calculados.length)} calculados`,
    },
    {
      clave: "N",
      label: "Tamaño declarado (N)",
      value: conN.length > 0 ? fmtInt(suma(conN, (c) => c.marco?.marco_validado)) : "—",
      detalle: conN.length > 0 ? "suma de los marcos" : "sin marcos",
    },
    {
      clave: "n",
      label: "Casos completos",
      value: calculados.length > 0 ? fmtInt(suma(calculados, (c) => c.resultado?.n_objetivo)) : "—",
      detalle: calculados.length > 0 ? "suma de los actores" : "sin calcular",
      origen: calculados.length > 0 ? "motor" : undefined,
      hero: true,
    },
    {
      clave: "campo",
      label: "Muestra a contactar",
      value: calculados.length > 0 ? fmtInt(suma(calculados, (c) => c.resultado?.n_operativo)) : "—",
      detalle: calculados.length > 0 ? "casos a abordar" : "sin calcular",
      origen: calculados.length > 0 ? "motor" : undefined,
    },
    {
      clave: "sorteo",
      label: "Seleccionados",
      value: sorteos.sorteables > 0 ? `${fmtInt(sorteos.vigentes)} de ${fmtInt(sorteos.sorteables)}` : "—",
      detalle: sorteos.sorteables === 0
        ? "ninguna técnica selecciona unidades"
        : sorteos.desactualizados > 0
          ? `${plural(sorteos.desactualizados, "selección desactualizada", "selecciones desactualizadas")}`
          : "vigentes, de los actores con π",
      tono: sorteos.desactualizados > 0 ? "alerta" : undefined,
    },
  ];

  const actores: ActorBanda[] = componentes.map((c) => {
    const N = nDelMarco(c, null);
    const fase = faseDelActor(c, corridas[c.id] ?? null, marcos[c.id] ?? null);
    const resumen = fase === "sin-n"
      ? "sin N"
      : fase === "sin-calculo"
        ? `N ${fmtInt(N)} · por calcular`
        : `n ${fmtInt(c.resultado?.n_objetivo)} de ${fmtInt(N)}`;
    return { id: c.id, nombre: nombreActor(c), tecnica: tecnicaCalculadaLabel(c), fase, resumen };
  });

  const cadena = [
    `${fmtInt(componentes.length)} ${componentes.length === 1 ? "actor" : "actores"}`,
    `${fmtInt(conN.length)} con N`,
    `${fmtInt(calculados.length)} calculados`,
    sorteos.sorteables > 0
      ? `${fmtInt(sorteos.vigentes)} de ${fmtInt(sorteos.sorteables)} seleccionados`
      : "sin selección",
  ];

  return { totales, actores, cadena };
}

/** Nombre accesible completo de la ficha de un actor: el visible se recorta. */
export function etiquetaFichaActor(a: ActorBanda): string {
  return `${a.nombre}: ${FASE_ACTOR_ETIQUETA[a.fase]}, ${a.resumen}, ${a.tecnica}. Ir a su Selección.`;
}

// ---------------------------------------------------------------------------
// Resultados: la columna «Ajuste»
// ---------------------------------------------------------------------------

/**
 * Lo que ajusta el n de cada fila. En Acreditación, una muestra de elementos
 * (MAS, estratificado, sistemático) se infla por la respuesta esperada: eso
 * es lo que se lee, con su margen —como en la tabla de Actores—, no la
 * «cobertura» que el cuadro deja en su valor por defecto.
 */
export function ajusteDeResultado(
  comp: CalcMuestraComponente,
  modo: "marco_disponible" | "acreditacion",
): { texto: string; nota: string | null } {
  if (modo === "acreditacion" && comp.resultado && campoMetaDelActor(comp).tipo === "respuesta") {
    const tasa = safeNumber(comp.resultado.tasa_respuesta_esperada ?? comp.parametros?.tasa_respuesta, NaN);
    const e = safeNumber(comp.parametros?.e, NaN);
    return {
      texto: Number.isFinite(tasa) ? `Respuesta esperada ${fmtPct(tasa)}` : "Respuesta esperada —",
      nota: Number.isFinite(e) && e > 0 ? `margen ±${fmtPct(e)}` : null,
    };
  }
  return { texto: criterioSalida(comp), nota: null };
}

// ---------------------------------------------------------------------------
// Acreditación › Contexto: qué le falta al reporte
// ---------------------------------------------------------------------------

export type RequisitoReporte = {
  clave: string;
  etiqueta: string;
  listo: boolean;
  /** Estado corto: «Completo», «Falta», «2 de 3». */
  estado: string;
  /** Sección donde se completa, si no es Contexto. */
  seccion?: string;
};

const TITULO_POR_DEFECTO = "estudio sin título";

export function requisitosReporteAcreditacion(args: {
  titulo: string;
  institucion: string;
  fuente: string;
  alcance: string;
  componentes: readonly CalcMuestraComponente[];
}): RequisitoReporte[] {
  const { componentes } = args;
  const texto = (v: string) => v.trim().length > 0;
  const campo = (clave: string, etiqueta: string, listo: boolean): RequisitoReporte => ({
    clave, etiqueta, listo, estado: listo ? "Completo" : "Falta",
  });
  const conN = componentes.filter((c) => nDelMarco(c, null) > 0).length;
  const calculados = componentes.filter((c) => hayResultado([c])).length;
  const total = componentes.length;
  return [
    campo("titulo", "Título", texto(args.titulo) && args.titulo.trim().toLowerCase() !== TITULO_POR_DEFECTO),
    campo("institucion", "Institución", texto(args.institucion)),
    campo("fuente", "Fuente de los marcos", texto(args.fuente)),
    campo("alcance", "Programas y alcance", texto(args.alcance)),
    {
      clave: "marcos",
      etiqueta: "Marco (N) por actor",
      listo: total > 0 && conN === total,
      estado: total > 0 ? `${fmtInt(conN)} de ${fmtInt(total)}` : "Sin actores",
      seccion: "actores",
    },
    {
      clave: "calculo",
      etiqueta: "n calculado",
      listo: total > 0 && calculados === total,
      estado: total > 0 ? `${fmtInt(calculados)} de ${fmtInt(total)}` : "Sin actores",
      seccion: "resultados",
    },
  ];
}

// ---------------------------------------------------------------------------
// Veredicto de Resultados (E15 P7): la conclusión antes que la tabla, como
// `CoberturaObjetivoStrip` en aulas. Sólo cifras que ya existen.
// ---------------------------------------------------------------------------

export type VeredictoResultados = {
  tono: "ok" | "alerta" | "neutral";
  titulo: string;
  /** Las cifras del veredicto en una línea. */
  detalle: string;
  /** Qué falta, con nombre; `null` si nada. */
  falta: string | null;
};

function listaConNombre(items: readonly string[], max = 3): string {
  const visibles = items.slice(0, max);
  const resto = items.length - visibles.length;
  if (resto > 0) return `${visibles.join(", ")} y ${fmtInt(resto)} más`;
  if (visibles.length <= 1) return visibles.join("");
  return `${visibles.slice(0, -1).join(", ")} y ${visibles[visibles.length - 1]}`;
}

function veredictoGeneral(componentes: readonly CalcMuestraComponente[]): VeredictoResultados | null {
  const calculados = componentes.filter((c) => hayResultado([c]));
  if (calculados.length === 0) return null;
  const suma = (campo: "n_objetivo" | "n_operativo") =>
    calculados.reduce((acc, c) => acc + safeNumber(c.resultado?.[campo], 0), 0);
  const nTexto = `${fmtInt(suma("n_objetivo"))} completas · ${fmtInt(suma("n_operativo"))} a contactar`;
  const sinCalcular = componentes.filter((c) => !hayResultado([c]));

  if (componentes.length === 1) {
    const comp = calculados[0];
    const m = margenComparado(comp);
    if (m.cumple == null) {
      return {
        tono: "neutral",
        titulo: "n calculado",
        detalle: comp.naturaleza === "no_prob" ? `${nTexto} · sin π no hay margen` : nTexto,
        falta: null,
      };
    }
    return {
      tono: m.cumple ? "ok" : "alerta",
      titulo: m.cumple ? "El n cumple el margen pedido" : "El n no alcanza el margen pedido",
      detalle: `${nTexto} · margen ${m.alcanzado} frente a ${m.pedido ?? "—"} pedido`,
      falta: null,
    };
  }

  const noCumplen = calculados.filter((c) => margenComparado(c).cumple === false);
  if (sinCalcular.length > 0) {
    return {
      tono: "alerta",
      titulo: `${sinCalcular.length === 1 ? "Falta" : "Faltan"} ${fmtInt(sinCalcular.length)} de ${plural(componentes.length, "componente", "componentes")} por calcular`,
      detalle: nTexto,
      falta: `Falta: ${listaConNombre(sinCalcular.map(nombreActor))}.`,
    };
  }
  if (noCumplen.length > 0) {
    return {
      tono: "alerta",
      titulo: `${fmtInt(noCumplen.length)} de ${plural(componentes.length, "componente", "componentes")} no ${noCumplen.length === 1 ? "alcanza" : "alcanzan"} su margen`,
      detalle: nTexto,
      falta: `Falta: ${listaConNombre(noCumplen.map(nombreActor))}.`,
    };
  }
  return { tono: "ok", titulo: "Todos los componentes calculados", detalle: nTexto, falta: null };
}

function veredictoAcreditacion(args: {
  componentes: readonly CalcMuestraComponente[];
  corridas: CorridasPorId;
  marcos: MarcosPorId;
  cargado: boolean;
}): VeredictoResultados | null {
  const { componentes, corridas, marcos, cargado } = args;
  const total = componentes.length;
  const calculados = componentes.filter((c) => hayResultado([c]));
  if (calculados.length === 0) return null;
  const sorteos = conteoSorteosAcreditacion({ componentes, corridas, marcos });
  const sinCalcular = componentes
    .filter((c) => !hayResultado([c]))
    .map((c) => `${nombreActor(c)} (${nDelMarco(c, null) > 0 ? "por calcular" : "sin N"})`);
  const sinSortear = componentes
    .filter((c) => hayResultado([c]) && nDelMarco(c, null) > 0 && tecnicaDelActor(c.tecnica).sorteable)
    .flatMap((c) => {
      const v = vigenciaSorteo({ comp: c, corrida: corridas[c.id] ?? null, marco: marcos[c.id] ?? null });
      if (v.estado === "vigente") return [];
      return [`${nombreActor(c)} (${v.estado === "desactualizado" ? "selección desactualizada" : "sin seleccionar"})`];
    });
  const leyendo = !cargado && sorteos.sorteables > 0;
  const sorteoTexto = sorteos.sorteables === 0
    ? "ninguna técnica selecciona unidades"
    : leyendo
      ? "leyendo los sorteos…"
      : `${fmtInt(sorteos.vigentes)} de ${fmtInt(sorteos.sorteables)} seleccionados`;
  const detalle = `${fmtInt(calculados.length)} de ${fmtInt(total)} calculados · ${sorteoTexto}`;

  if (sinCalcular.length > 0) {
    return {
      tono: "alerta",
      titulo: `${sinCalcular.length === 1 ? "Falta" : "Faltan"} ${fmtInt(sinCalcular.length)} de ${plural(total, "actor", "actores")} por calcular`,
      detalle,
      falta: `Falta: ${listaConNombre(sinCalcular)}.`,
    };
  }
  if (leyendo) return { tono: "neutral", titulo: "Todos los actores calculados", detalle, falta: null };
  if (sinSortear.length > 0) {
    return {
      tono: "alerta",
      titulo: `Falta seleccionar ${fmtInt(sinSortear.length)} de ${plural(sorteos.sorteables, "actor", "actores")} con π`,
      detalle,
      falta: `Falta: ${listaConNombre(sinSortear)}.`,
    };
  }
  return {
    tono: "ok",
    titulo: sorteos.sorteables > 0 ? "Todos los actores calculados y seleccionados" : "Todos los actores calculados",
    detalle,
    falta: null,
  };
}

/**
 * Resultados abre con su conclusión: en Muestra general, el n y el margen
 * alcanzado frente al pedido; en Acreditación, cuántos actores están
 * calculados y sorteados y cuál falta. `null` sin ningún cálculo: ese vacío lo
 * dice el panel (C3).
 */
export function veredictoResultados(args: {
  modo: ModoMesa;
  componentes: readonly CalcMuestraComponente[];
  corridas?: CorridasPorId;
  marcos?: MarcosPorId;
  cargado?: boolean;
}): VeredictoResultados | null {
  if (args.modo === "acreditacion") {
    return veredictoAcreditacion({
      componentes: args.componentes,
      corridas: args.corridas ?? {},
      marcos: args.marcos ?? {},
      cargado: args.cargado ?? true,
    });
  }
  return veredictoGeneral(args.componentes);
}
