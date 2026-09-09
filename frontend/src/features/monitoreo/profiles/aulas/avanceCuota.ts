import type {
  MonitoreoAulasAvanceCuota,
  MonitoreoAulasAvanceCuotaFacultad,
  MonitoreoAulasAvanceCuotaTotal,
} from "../../../../api/monitoreo";
import { fmt, pctPerfil } from "./kpisDeAulas";

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
  /** Siempre «Cuota del estudio»: la cantidad no cambia de nombre según de dónde salga. */
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

/**
 * Distingue el `null` con significado —sin cuota— de un número de verdad.
 *
 * Exportado porque es la frontera de TODO el bloque `avance_cuota`: el JSON de
 * R serializa sus campos a veces como string —`meta_operativa` llegó como
 * `"NA"` con «Todas las facultades" (A17, 2026-08-31)— y quien lea el bloque
 * fuera de este módulo (la pestaña de Rendimiento le pasa la sobremuestra al
 * gráfico) tiene que normalizar con la MISMA regla: número finito o `null`.
 */
export function numeroONulo(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}


/** Porcentaje con coma decimal y a lo sumo un decimal; sin cap. */
/**
 * **El porcentaje se escribe como lo escribe el Perú.**
 *
 * Aquí había un formateador propio que forzaba la coma decimal —`87,4`— con un
 * `.replace(".", ",")`. Es la convención de España; la de Perú, que es la que
 * `Intl` aplica bajo `es-PE` y la que usa el resto del perfil, pone **punto
 * decimal y coma de millar**: `2,668` alumnos avanzan un `88.1 %`.
 *
 * El resultado era que la misma pestaña de Cuotas publicaba «88.1 %» en la
 * tabla por facultad y «88,1%» en la barra de tres centímetros más arriba —dos
 * notaciones para la misma cifra, y con la coma haciendo de decimal en una y de
 * millar en la otra, que es lo que obliga a releer—. Se usa `pctPerfil()`, que
 * ya es el formateador de la casa y añade el espacio antes del signo.
 */

/**
 * **La tasa se nombra, no se escribe en griego.**
 *
 * El chip decía «cuota del diseño · τ 0,53». Es la misma cantidad que Cálculo
 * de muestra publica —`tasa_esperada` es el `tau` que ese módulo trazó por
 * facultad, con `source = "calc-muestra"`—, y allá ya se decidió no publicar la
 * letra: «la tasa de efectividad se nombra, no se escribe en griego… quien
 * recibe la app veía "τ 53%" sin saber ni qué es ni de dónde viene»
 * (`CalculoPropuestasTab.tsx`). Monitoreo se quedó con la letra, así que el
 * mismo número tenía dos presentaciones según el módulo.
 *
 * Se dice en porcentaje porque es lo que la vuelve legible sin definición: «53
 * %» se entiende como *de cada cien alumnos elegibles del aula responden 53*;
 * «0,53» obliga a preguntar 0,53 de qué.
 *
 * Cuando no hay una tasa única —el motor deja `NA` si las facultades tienen
 * tasas distintas, para no promediar a escondidas lo que el diseño trazó por
 * separado— se dice eso mismo. Antes iba un «—», que se decidió «más fiel que
 * ocultarla»: se conserva la intención de no ocultarla y se sustituye el guion,
 * que no significa nada, por el hecho.
 */
function tasaDeEfectividadTexto(tasa: number | null): string {
  if (tasa == null) return "tasa de efectividad sin valor único";
  return `tasa de efectividad ${pctPerfil(tasa * 100)}`;
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
      lectura: "sin cursos-horario sorteados",
      titulo: [
        "El sorteo no le asignó aulas: su cuota no puede salir del plan actual. Es un hueco del diseño de campo, no retraso del equipo.",
        ...notas,
      ].join(" · "),
      aria: `${facultad}: sin cursos-horario sorteados para su cuota`,
    };
  }

  // **El porcentaje viaja con la frecuencia que lo produce.**
  //
  // Gonzalo, 2026-09-08, señalando el «faltan · 31.5 %» de Estudios Generales
  // Ciencias: «debería decir "Faltan X · 57 % (15 de 25)"». La fracción ya
  // existía, pero vivía en la otra punta de la fila —bajo el nombre de la
  // facultad, a 190 px y una columna de distancia—, así que la cifra fuerte
  // (276, que es la BRECHA) quedaba pegada a un porcentaje (31.5 %, que es el
  // AVANCE) sin nada que dijera de qué eran. Dos marcos contrarios juntos y
  // ningún denominador a la vista.
  //
  // Por eso se mueve, no se duplica: `subtexto` deja de repetir la fracción y
  // se queda con las mermas. Un mismo par de números en dos sitios de la misma
  // fila es la forma más barata de que un día digan cosas distintas.
  const fraccion = `${fmt(validas)} de ${fmt(cuota ?? 0)}`;
  return {
    ...base,
    subtexto: notas.join(" · "),
    cumplida,
    cifra: cumplida ? null : fmt(brecha),
    lectura: cumplida
      ? `cuota cumplida · ${pctPerfil(avance ?? 0)} (${fraccion})`
      : `faltan · ${pctPerfil(avance ?? 0)} (${fraccion})`,
    titulo: notas.join(" · "),
    aria: `${facultad}: ${pctPerfil(avance ?? 0)} de su cuota del diseño, ${fraccion}`,
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
    : `cuota del diseño · ${tasaDeEfectividadTexto(numeroONulo(bloque.tasa_esperada))}`;
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
  if (huerfanas > 0) notasTotal.push(`${fmt(huerfanas)} sin curso-horario del plan`);
  /**
   * **La cantidad tiene un nombre; de dónde sale lo dice el chip.**
   *
   * Era «Cuota del diseño» / «Meta del plan», y en la misma cabecera conviven ya
   * el título «Cumplimiento de la cuota del estudio» y el chip «cuota del diseño
   * · tasa de efectividad 53.0 %»: tres rótulos para dos cosas, con dos de ellos
   * diciendo lo mismo. `AulasCuotasResumen` —compartido por otras cuatro
   * pestañas— llamaba «Cuota del estudio» a esta misma cantidad, y **es la misma
   * de verdad**: medido, 2.500 y 2.668 en las dos.
   *
   * Y «diseño» hacía de dos cosas a la vez: de dónde salió la META, y lo que se
   * esperaba aportar con las aulas calculadas —lo que el motor llama `previsto`
   * y el encargo llama «lo diseñado»—. Reservarlo para lo segundo es lo que
   * permite distinguir las tres cantidades del estudio: la meta, lo diseñado y
   * lo que se espera según el rendimiento.
   */
  const etiqueta = "Cuota del estudio";

  return {
    procedencia,
    vacio: null,
    total: {
      etiqueta,
      cuota: numero(t.cuota),
      validas: numero(t.respuestas_validas),
      brecha: Math.max(0, numero(t.brecha)),
      avance: avanceTotal,
      avanceTexto: pctPerfil(avanceTotal),
      relleno: Math.max(0, Math.min(100, avanceTotal)),
      // La procedencia entra en el aria porque quien no ve la pantalla no ve el
      // chip que la declara, y sin ella «de la cuota del estudio» suena igual
      // con el denominador del diseño que con el del plan degradado.
      aria: `${pctPerfil(avanceTotal)} de la ${etiqueta.toLowerCase()} · ${procedencia.chip}`,
      notas: notasTotal,
    },
    filas,
    cumplidas: filas.filter((f) => f.cumplida).length,
    sinCuota: filas.filter((f) => f.estado === "sin_cuota").length,
  };
}
