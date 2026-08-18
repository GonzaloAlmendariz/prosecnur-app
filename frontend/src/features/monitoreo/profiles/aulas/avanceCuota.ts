import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasAvanceCuotaFacultad,
  MonitoreoAulasAvanceCuotaTotal,
} from "../../../../api/monitoreo";

/**
 * Cumplimiento contra la cuota del DISEÑO, listo para pintar.
 *
 * El motor publica el bloque entero —total, filas y su procedencia— y aquí
 * sólo se PROYECTA: orden, anchos de barra y redacción. Nada se recalcula: ni
 * sumas ni porcentajes, que ya vienen hechos y con el denominador correcto
 * (la cuota de alumnos del diseño, no la meta del plan, que suma
 * `expected_valid` por aula y es más alta por diseño).
 *
 * Cuando la vigencia del diseño se degrada —obsoleta o sin diseño— el
 * denominador cae a la meta del plan y el chip lo declara; el motivo viaja al
 * `title`, no se pierde.
 */

export type ProcedenciaDeCuota = {
  /** El chip del encabezado: contra qué se está midiendo. */
  chip: string;
  /** El porqué de la degradación o del sello; va al title/aria-label. */
  detalle: string;
  /** Verdadero cuando el denominador cayó a la meta del plan. */
  degradada: boolean;
};

export type TotalDeAvanceCuota = {
  /** «Cuota del diseño» o «Meta del plan», según la procedencia. */
  etiqueta: string;
  cuota: number;
  validas: number;
  brecha: number;
  /** El porcentaje del motor, SIN cap: puede superar 100. */
  avance: number;
  avanceTexto: string;
  /** Ancho del relleno de la barra; capado a 100 sólo para pintar. */
  relleno: number;
  aria: string;
  /** Lecturas secundarias —fuera de universo, sin aula del plan—; nunca se ocultan. */
  notas: string[];
};

export type FilaDeAvanceCuota = {
  facultad: string;
  clave: string;
  cuota: number | null;
  validas: number;
  brecha: number;
  /** SIN cap; `null` cuando la facultad no tiene cuota en el diseño. */
  avance: number | null;
  /** Ancho del carril, proporcional a la cuota contra la más alta. */
  carril: number;
  /** Ancho del relleno dentro del carril; capado a 100 sólo para pintar. */
  relleno: number;
  estado: "ok" | "sin_aulas_en_plan" | "sin_cuota";
  cumplida: boolean;
  /** La cifra fuerte de la derecha; `null` cuando no hay resta que mostrar. */
  cifra: string | null;
  /** El resto de la lectura de la derecha, ya redactado. */
  lectura: string;
  /** Bajo el nombre: cuántas van de cuántas, más las lecturas secundarias. */
  subtexto: string;
  /** Explicación larga para el title del renglón; `""` cuando no hace falta. */
  titulo: string;
  aria: string;
};

export type VistaDeAvanceCuota = {
  procedencia: ProcedenciaDeCuota;
  /** Clasificación del vacío (C3/C5); `null` cuando hay datos que pintar. */
  vacio: string | null;
  total: TotalDeAvanceCuota | null;
  filas: FilaDeAvanceCuota[];
  cumplidas: number;
  sinCuota: number;
};

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Distingue el `null` con significado —sin cuota— de un número de verdad. */
function numeroONulo(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

const fmt = (n: number) => n.toLocaleString("es-PE");

/** Porcentaje con coma decimal y a lo sumo un decimal; sin cap. */
function pctTexto(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

/** τ con coma decimal; «—» cuando difiere por facultad, más fiel que ocultarla. */
function tauTexto(tasa: number | null): string {
  if (tasa == null) return "—";
  return tasa.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

function notasDeFila(bruta: MonitoreoAulasAvanceCuotaFacultad): string[] {
  const notas: string[] = [];
  const fuera = numero(bruta.fuera_universo);
  const sinSexo = numero(bruta.respuestas_sin_sexo);
  if (fuera > 0) notas.push(`${fmt(fuera)} fuera de universo`);
  if (sinSexo > 0) notas.push(`${fmt(sinSexo)} sin sexo`);
  return notas;
}

function fila(bruta: MonitoreoAulasAvanceCuotaFacultad): Omit<FilaDeAvanceCuota, "carril"> {
  const facultad = texto(bruta.facultad) || "Sin facultad";
  const clave = texto(bruta.faculty_key) || facultad;
  const cuota = numeroONulo(bruta.cuota);
  const estadoBruto = texto(bruta.estado);
  // Sin cuota manda aunque el estado no lo diga: sin denominador no se inventa
  // un porcentaje.
  const sinCuota = estadoBruto === "sin_cuota" || cuota == null;
  // Anotado para que el literal no se ensanche a `string` al entrar al objeto.
  const estado: FilaDeAvanceCuota["estado"] =
    sinCuota ? "sin_cuota" : estadoBruto === "sin_aulas_en_plan" ? "sin_aulas_en_plan" : "ok";
  const validas = numero(bruta.respuestas_validas);
  const brecha = sinCuota ? 0 : Math.max(0, numero(bruta.brecha));
  const avance = sinCuota ? null : numero(bruta.avance_pct);
  const notas = notasDeFila(bruta);
  const cumplida = estado === "ok" && brecha === 0;

  if (estado === "sin_cuota") {
    return {
      facultad, clave, cuota: null, validas, brecha, avance: null,
      relleno: 0, estado, cumplida: false,
      cifra: null,
      lectura: "sin cuota del diseño",
      subtexto: [`${fmt(validas)} recogidas`, ...notas].join(" · "),
      titulo: [
        "Facultad del plan sin cuota en el diseño: no hay denominador contra el que medirla.",
        ...notas,
      ].join(" · "),
      aria: `${facultad}: sin cuota del diseño`,
    };
  }

  const base = {
    facultad, clave, cuota, validas, brecha, avance,
    // Sólo el ANCHO se capa a 100; la cifra sigue diciendo la verdad.
    relleno: Math.max(0, Math.min(100, avance ?? 0)),
    estado,
    subtexto: [`${fmt(validas)} de ${fmt(cuota ?? 0)}`, ...notas].join(" · "),
  };

  if (estado === "sin_aulas_en_plan") {
    // Hueco estructural del sorteo, no retraso de campo: la redacción lo dice
    // para que no se lea como una facultad a la que el equipo no ha llegado.
    return {
      ...base, cumplida: false,
      cifra: brecha > 0 ? fmt(brecha) : null,
      lectura: "sin aulas sorteadas",
      titulo: [
        "El sorteo no le asignó aulas: su cuota no puede salir del plan actual. Es un hueco del diseño de campo, no retraso del equipo.",
        ...notas,
      ].join(" · "),
      aria: `${facultad}: sin aulas sorteadas para su cuota`,
    };
  }

  return {
    ...base, cumplida,
    cifra: cumplida ? null : fmt(brecha),
    lectura: cumplida ? `cuota cumplida · ${pctTexto(avance ?? 0)}%` : `faltan · ${pctTexto(avance ?? 0)}%`,
    titulo: notas.join(" · "),
    aria: `${facultad}: ${pctTexto(avance ?? 0)}% de su cuota del diseño`,
  };
}

export function avanceCuota(bloque?: MonitoreoAulasAvanceCuota | null): VistaDeAvanceCuota {
  // El vacío se clasifica, no se calla (C5): un payload sin el bloque es un
  // diseño que no publicó metas, no una pantalla rota.
  if (!bloque) {
    return {
      procedencia: { chip: "sin metas publicadas", detalle: "", degradada: false },
      vacio: "El diseño no publicó metas para este estudio.",
      total: null,
      filas: [],
      cumplidas: 0,
      sinCuota: 0,
    };
  }

  const vigencia = texto(bloque.vigencia);
  const fuente = texto(bloque.fuente);
  const motivo = texto(bloque.motivo);
  // Degradada = el denominador ya no es la cuota del diseño. La fuente también
  // cuenta, por si un payload declara `plan_expected` con vigencia rara.
  const degradada = vigencia === "obsoleta" || vigencia === "sin_diseno" || fuente === "plan_expected";
  const chipBase = degradada
    ? "contra la meta del plan"
    : `cuota del diseño · τ ${tauTexto(numeroONulo(bloque.tasa_esperada))}`;
  const procedencia: ProcedenciaDeCuota = {
    chip: vigencia === "no_verificable" ? `${chipBase} (sello sin verificar)` : chipBase,
    detalle: motivo,
    degradada,
  };

  const brutas = Array.isArray(bloque.facultades) ? bloque.facultades : [];
  if (!brutas.length) {
    return {
      procedencia,
      vacio: "Sin plan importado: no hay facultades contra las que medir la cuota.",
      total: null,
      filas: [],
      cumplidas: 0,
      sinCuota: 0,
    };
  }

  const parciales = brutas
    .map(fila)
    // Primero la que más lejos está: es el orden con el que se decide a dónde
    // va el equipo mañana. Las filas sin cuota no tienen brecha definida y
    // bajan al final, ordenadas por nombre.
    .sort((a, b) => b.brecha - a.brecha || a.facultad.localeCompare(b.facultad, "es"));

  // La cuota más alta marca la escala de los carriles; las filas sin cuota no
  // entran a la escala —no tienen denominador— ni a ningún total.
  const tope = parciales.reduce((max, f) => Math.max(max, f.cuota ?? 0), 0);
  const filas: FilaDeAvanceCuota[] = parciales.map((f) => ({
    ...f,
    carril: f.cuota != null && tope > 0 ? Math.max(8, (100 * f.cuota) / tope) : 0,
  }));

  const t: Partial<MonitoreoAulasAvanceCuotaTotal> = bloque.total ?? {};
  const avanceTotal = numero(t.avance_pct);
  const notasTotal: string[] = [];
  const fueraTotal = numero(t.fuera_universo);
  const huerfanas = numero(t.huerfanas);
  if (fueraTotal > 0) notasTotal.push(`${fmt(fueraTotal)} fuera de universo`);
  if (huerfanas > 0) notasTotal.push(`${fmt(huerfanas)} sin aula del plan`);
  const etiqueta = degradada ? "Meta del plan" : "Cuota del diseño";

  return {
    procedencia,
    vacio: null,
    total: {
      etiqueta,
      cuota: numero(t.cuota),
      validas: numero(t.respuestas_validas),
      brecha: Math.max(0, numero(t.brecha)),
      avance: avanceTotal,
      avanceTexto: pctTexto(avanceTotal),
      relleno: Math.max(0, Math.min(100, avanceTotal)),
      aria: `${pctTexto(avanceTotal)}% de la ${etiqueta.toLowerCase()}`,
      notas: notasTotal,
    },
    filas,
    cumplidas: filas.filter((f) => f.cumplida).length,
    sinCuota: filas.filter((f) => f.estado === "sin_cuota").length,
  };
}
