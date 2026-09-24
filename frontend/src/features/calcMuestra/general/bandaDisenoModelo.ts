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
  formatearFechaUtc,
  hashCorto,
  modalidadDeTecnica,
  nDesfasado,
} from "./modelo";
import { precisionEnPalabras } from "./modeloParametros";
import { hayResultado } from "./secciones";
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

export type MotivoDesactualizado = "marco" | "calculo" | "n";

export type VigenciaSorteo =
  | { estado: "sin-sorteo" }
  | { estado: "vigente" }
  | {
      estado: "desactualizado";
      motivo: MotivoDesactualizado;
      /** Qué cambió, en una frase con cifras. */
      texto: string;
      /** El n a campo vigente cuando el motivo es `n`. */
      nCampo: number | null;
    };

/**
 * Un sorteo cuenta como vigente sólo si responde al diseño actual: se hizo
 * sobre el mismo marco (huella y N), el componente sigue calculado y, fuera
 * del censo, con el mismo n a campo. Una corrida guardada que ya no cumple
 * eso existe, pero no es «sorteado»: es un sorteo desactualizado.
 */
export function vigenciaSorteo(args: {
  comp: CalcMuestraComponente | null;
  corrida: CalcMuestraGeneralCorrida | null;
  marco?: Pick<CalcMuestraGeneralMarco, "marco_hash" | "N"> | null;
}): VigenciaSorteo {
  const { comp, corrida } = args;
  const marco = args.marco ?? null;
  if (!corrida) return { estado: "sin-sorteo" };
  const c = corrida.corrida;
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
      texto: "El sorteo quedó de un cálculo que ya no existe: calcula de nuevo.",
      nCampo: null,
    };
  }
  if (c.modalidad === "censo") {
    const N = nDelMarco(comp, marco);
    if (N > 0 && safeNumber(c.N, 0) > 0 && Math.round(N) !== Math.round(c.N)) {
      return {
        estado: "desactualizado",
        motivo: "marco",
        texto: `El marco tiene ${fmtInt(N)} unidades; el sorteo ordenó ${fmtInt(c.N)}.`,
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
      texto: `El n a campo es ${fmtInt(desfase)}; el sorteo usó ${fmtInt(corrida.n_fuente)}.`,
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
      etiqueta: "Falta el marco",
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
      siguiente: "Esta técnica no sortea unidades: el n es la entrega.",
      accion: irA("resultados", "Ver Resultados"),
    };
  }
  if (!cargado) {
    return { clave: "leyendo", tono: "pendiente", etiqueta: "n calculado", siguiente: "Leyendo el último sorteo…", accion: null };
  }
  if (!marco) {
    return {
      clave: "sin-sorteo",
      tono: "pendiente",
      etiqueta: "Falta el archivo",
      siguiente: "El sorteo sale del archivo de unidades: decláralo en Marco.",
      accion: irA("marco", "Ir a Marco"),
    };
  }
  if (!corrida) {
    return {
      clave: "sin-sorteo",
      tono: "pendiente",
      etiqueta: "Falta sortear",
      siguiente: modalidad === "censo"
        ? "Ordena el marco al azar para el contacto."
        : "Sortea el n a campo con una semilla reproducible.",
      accion: irA("seleccion", "Ir a Selección"),
    };
  }
  const vigencia = vigenciaSorteo({ comp, corrida, marco });
  if (vigencia.estado === "desactualizado") {
    return {
      clave: "desactualizado",
      tono: "alerta",
      etiqueta: "Sorteo desactualizado",
      siguiente: vigencia.texto,
      accion: irA("seleccion", "Sortear de nuevo"),
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
    return { clave: "leyendo", tono: "pendiente", etiqueta: "n calculado", siguiente: "Leyendo los sorteos…", accion: null };
  }
  const desactualizados = sorteables.filter((c) => (
    vigenciaSorteo({ comp: c, corrida: corridas[c.id] ?? null, marco: marcos[c.id] ?? null }).estado === "desactualizado"
  ));
  if (desactualizados.length > 0) {
    return {
      clave: "desactualizado",
      tono: "alerta",
      etiqueta: "Sorteo desactualizado",
      siguiente: `${plural(desactualizados.length, "actor tiene", "actores tienen")} un sorteo que ya no responde a su marco o a su n.`,
      accion: irA("seleccion", "Ir a Selección"),
    };
  }
  const sinSorteo = sorteables.filter((c) => !corridas[c.id]);
  if (sinSorteo.length > 0) {
    return {
      clave: "sin-sorteo",
      tono: "pendiente",
      etiqueta: "Falta sortear",
      siguiente: `Falta sortear ${fmtInt(sinSorteo.length)} de ${plural(sorteables.length, "actor con π", "actores con π")}.`,
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

function cifraMargen(comp: CalcMuestraComponente): CifraBanda {
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
    clave: "margen",
    label: "Margen alcanzado",
    value: valor !== "—" && !valor.startsWith("±") ? `±${valor}` : valor,
    detalle: comp.naturaleza === "no_prob"
      ? "no aplica sin π"
      : Number.isFinite(pedido) ? `pedido ±${fmtPct(pedido)}` : undefined,
    origen: r ? "motor" : undefined,
    tono: comparable ? (alcanzado <= pedido * (1 + 1e-6) ? "ok" : "alerta") : undefined,
  };
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
      label: "N del marco",
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
      label: "n completas",
      value: calculado ? fmtInt(r?.n_objetivo) : "—",
      detalle: calculado ? "encuestas logradas" : "sin calcular",
      origen: calculado ? "motor" : undefined,
      hero: true,
    },
    {
      clave: "campo",
      label: "n a campo",
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
    const c = corrida?.corrida ?? null;
    const vigencia = vigenciaSorteo({ comp, corrida, marco });
    cifras.push(
      {
        clave: "semilla",
        label: "Semilla",
        value: c ? String(c.semilla) : "—",
        detalle: c ? (c.modalidad === "censo" ? "orden de contacto" : etiquetaMetodo(c.metodo)) : "sin sorteo",
        monospace: true,
      },
      {
        clave: "sorteo",
        // Rótulo de una palabra, como el resto de la fila: «Titulares +
        // reservas» se partía en dos líneas y descuadraba las alturas (C2).
        label: c?.modalidad === "censo" ? "A contactar" : "Sorteo",
        value: c
          ? c.modalidad === "censo" ? fmtInt(c.n_titulares) : `${fmtInt(c.n_titulares)} + ${fmtInt(c.n_reservas)}`
          : "—",
        detalle: corrida
          ? [
              c?.modalidad === "censo" ? null : "titulares + reservas",
              vigencia.estado === "desactualizado" ? "desactualizado" : formatearFechaUtc(corrida.sorteado_at),
            ].filter(Boolean).join(" · ")
          : "sin sorteo",
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
    pasos.push(`${fmtInt(comp.resultado?.n_objetivo)} completas`, `${fmtInt(comp.resultado?.n_operativo)} a campo`);
  } else {
    pasos.push("n por calcular");
  }
  if (corrida) pasos.push(`semilla ${corrida.corrida.semilla}`);
  return pasos;
}

// ---------------------------------------------------------------------------
// Acreditación
// ---------------------------------------------------------------------------

export type FaseActor = "sin-n" | "sin-calculo" | "calculado" | "sorteado" | "desactualizado";

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
  sorteado: "Sorteado",
  desactualizado: "Sorteo viejo",
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
      label: "N declarado",
      value: conN.length > 0 ? fmtInt(suma(conN, (c) => c.marco?.marco_validado)) : "—",
      detalle: conN.length > 0 ? "suma de los marcos" : "sin marcos",
    },
    {
      clave: "n",
      label: "n completas",
      value: calculados.length > 0 ? fmtInt(suma(calculados, (c) => c.resultado?.n_objetivo)) : "—",
      detalle: calculados.length > 0 ? "suma de los actores" : "sin calcular",
      origen: calculados.length > 0 ? "motor" : undefined,
      hero: true,
    },
    {
      clave: "campo",
      label: "n a campo",
      value: calculados.length > 0 ? fmtInt(suma(calculados, (c) => c.resultado?.n_operativo)) : "—",
      detalle: calculados.length > 0 ? "casos a abordar" : "sin calcular",
      origen: calculados.length > 0 ? "motor" : undefined,
    },
    {
      clave: "sorteo",
      label: "Sorteados",
      value: sorteos.sorteables > 0 ? `${fmtInt(sorteos.vigentes)} de ${fmtInt(sorteos.sorteables)}` : "—",
      detalle: sorteos.sorteables === 0
        ? "ninguna técnica sortea"
        : sorteos.desactualizados > 0
          ? `${plural(sorteos.desactualizados, "sorteo viejo", "sorteos viejos")}`
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
      ? `${fmtInt(sorteos.vigentes)} de ${fmtInt(sorteos.sorteables)} sorteados`
      : "sin sorteo",
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
