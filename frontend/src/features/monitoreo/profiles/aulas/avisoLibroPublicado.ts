import type { TonoAviso } from "./avisoLibroImportado";
import { fmt } from "./kpisDeAulas";

/**
 * Qué pasó con cada hoja al publicar el libro en el Sheets del operativo.
 *
 * La regla de dueño —«Aulas Agendadas» y «Aulas Aplicadas (Campo)» son del
 * equipo; «Base de control» es de la app— la cumple el motor, pero si la UI no
 * la cuenta, una hoja `respetada` se lee como una hoja que falló. Por eso
 * `respetada` lleva SIEMPRE su motivo: es la decisión de Gonzalo hecha
 * visible, no una omisión.
 *
 * La lista de acciones es ABIERTA a propósito: una acción que este código no
 * conoce viaja con su nombre en vez de tragarse la hoja —la lección más cara
 * del repo son las listas cerradas que descartan en silencio—.
 *
 * Tercera pieza de la familia: generar dice qué salió, importar qué entró,
 * publicar qué quedó escrito (y qué se respetó).
 */
export type HojaDelLibroPublicada = {
  hoja?: string;
  accion?: string;
  /** Filas de DATOS (sin cabeceras); en `respetada`, las que el equipo ya tiene. */
  filas?: number | null;
  /**
   * Los rótulos que el motor produce y esa hoja NO tiene. Sólo los trae una
   * `respetada`: es lo que la protección del equipo deja fuera.
   */
  rotulos_retenidos?: string[] | null;
};

/**
 * **Una hoja respetada puede estar a la que le falta una columna entera.**
 *
 * Medido el 2026-09-18 sobre CCSS Perfil 2026-II, con el campo a cuatro días: el
 * libro del motor ganó la columna CARRERA, y las cuatro hojas que por eso
 * crecieron son justo las del equipo. Republicar devolvía cuatro «respetada» —
 * que es la conducta correcta, hay gente tecleando ahí— y ninguna señal de que
 * la columna con la que se distingue una carrera de otra se quedó fuera.
 * Respetar la hoja no cambia; callar lo que no llegó, sí.
 *
 * Se nombran hasta tres y se cuenta el resto: la cabecera entera de «Aulas
 * Agendadas» son decenas de rótulos y un aviso que los enumera todos no se lee.
 */
function conRetenidos(rotulos: string[] | null | undefined): string {
  const limpios = (rotulos ?? []).map((r) => String(r ?? "").trim()).filter(Boolean);
  if (!limpios.length) return "";
  const cabeza = limpios.slice(0, 3).map((r) => `«${r}»`).join(", ");
  const resto = limpios.length - Math.min(3, limpios.length);
  return `; no le llegó ${cabeza}${resto > 0 ? ` y ${fmt(resto)} más` : ""}`;
}

function conFilas(filas: number | null | undefined): string {
  const n = Number(filas);
  if (!Number.isFinite(n)) return "";
  return n === 1 ? " (1 fila)" : ` (${fmt(n)} filas)`;
}

// Exportada porque `avisoConversacion` cuenta la mitad publicada del sync con
// LA MISMA voz: dos redacciones de la regla de dueño divergirían tarde o
// temprano (la lección de «dos capas, dos lecturas de la misma regla»).
export function fraseDeHoja(h: HojaDelLibroPublicada): string {
  const nombre = String(h.hoja ?? "").trim() || "Una hoja sin nombre";
  const accion = String(h.accion ?? "").trim();
  switch (accion) {
    case "actualizada":
      return `«${nombre}» actualizada${conFilas(h.filas)}`;
    case "sembrada":
      // Sólo pasa cuando la pestaña no existía o estaba vacía: la primera y
      // única vez que la app escribe en una hoja que no es suya.
      return `«${nombre}» sembrada${conFilas(h.filas)}`;
    case "sin_cambios":
      return `«${nombre}» sin cambios`;
    case "respetada":
      return `«${nombre}» respetada${conFilas(h.filas)}: la llena el equipo, no la app`
        + conRetenidos(h.rotulos_retenidos);
    default:
      return accion
        ? `«${nombre}» ${accion}${conFilas(h.filas)}`
        : `«${nombre}» sin acción declarada`;
  }
}

/**
 * Lo que publicar LEYÓ del equipo antes de escribir (A1, loop 2026-09-07).
 *
 * Desde `732c4221` el motor importa las hojas del equipo en el mismo acto de
 * publicar, y el recibo lo cuenta: `ok` con su `resumen`, `error` cuando el
 * Sheets no se dejó leer (se publica igual, con lo que la sesión tenía), u
 * `omitida` cuando quien llamó ya había leído. El día 1 de campo el encargado
 * llevaba siete partes tecleados y la Base de control publicada enseñaba uno;
 * nada en pantalla decía si se había leído. Esta frase es esa señal.
 */
export type LecturaPreviaDelLibro = {
  ok?: boolean;
  omitida?: boolean;
  error?: string;
  resumen?: {
    unidades?: number | null;
    partes_de_campo?: number | null;
    filas_de_control?: number | null;
  } | null;
};

function cuenta(n: number | null | undefined, uno: string, varios: string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return `0 ${varios}`;
  return v === 1 ? `1 ${uno}` : `${fmt(v)} ${varios}`;
}

/**
 * La frase de la lectura previa, o vacía cuando no hay nada que contar
 * (omitida, o un recibo anterior a esta señal). Cada aviso dice causa y
 * salida: si falló, la salida es «Traer respuestas» cuando el enlace responda.
 */
export function fraseDeLecturaPrevia(lp: LecturaPreviaDelLibro | null | undefined): {
  texto: string;
  tono: TonoAviso;
} {
  if (!lp || lp.omitida) return { texto: "", tono: "ok" };
  if (lp.ok) {
    const r = lp.resumen ?? {};
    return {
      texto:
        `Antes de escribir se leyó lo del equipo: ${cuenta(r.partes_de_campo, "parte de campo", "partes de campo")}` +
        ` y ${cuenta(r.filas_de_control, "fila de control", "filas de control")}.`,
      tono: "ok",
    };
  }
  const causa = String(lp.error ?? "").trim();
  return {
    texto:
      `No se pudo leer el Sheets antes de publicar${causa ? ` (${causa})` : ""}: ` +
      "se publicó con lo que la app ya tenía. Para traer lo que el equipo tecleó, usa Traer respuestas cuando el enlace responda.",
    tono: "atencion",
  };
}

/** Lo que se adoptó de la hoja de los aplicadores antes de rehacer «Asignación». */
export type AdopcionDeLaDistribucion = {
  ok?: boolean;
  omitida?: boolean;
  motivo?: string;
  error?: string;
  hoja?: string;
  /** Todas las pestañas de las que se adoptó, una por semana. */
  hojas?: string[] | null;
  adoptadas?: number;
};

/**
 * Cómo se nombra el destino de la adopción.
 *
 * Con una pestaña por semana, decir «Semana 1» cuando se congelaron dos es
 * contar la mitad de lo que se hizo — y la mitad que falta es justamente la
 * que las diecinueve personas ya tienen leída.
 */
function dondeSeAdoptó(ad: AdopcionDeLaDistribucion): string {
  const hojas = (ad.hojas ?? []).map((h) => String(h).trim()).filter(Boolean);
  if (hojas.length > 1) {
    return `${hojas.slice(0, -1).map((h) => `«${h}»`).join(", ")} y «${hojas[hojas.length - 1]}»`;
  }
  const una = hojas[0] ?? String(ad.hoja ?? "").trim();
  return una ? `«${una}»` : "la hoja de los aplicadores";
}

/**
 * La frase de la adopción, o vacía cuando el recibo no la trae.
 *
 * **Se dice aunque no cambie nada**, y en concreto se dice cuando NO adoptó:
 * publicar rehace «Asignación de aplicadores», y si no leyó la hoja de los 22
 * lo hace con un sorteo nuevo que no tiene por qué caer donde cayó el
 * comunicado. El 2026-09-09 eso dejó 38 de 85 aulas con dos aplicadores
 * distintos entre las dos hojas, y nadie lo vio hasta el día siguiente.
 */
export function fraseDeAdopcion(ad: AdopcionDeLaDistribucion | null | undefined): {
  texto: string;
  tono: TonoAviso;
} {
  if (!ad) return { texto: "", tono: "ok" };
  if (ad.ok) {
    const n = Number(ad.adoptadas ?? 0);
    return {
      texto: `Se adoptó lo que el coordinador dejó escrito en ${dondeSeAdoptó(ad)}: ${cuenta(n, "asignación", "asignaciones")}, que el sorteo ya no mueve.`,
      tono: "ok",
    };
  }
  if (ad.motivo === "sin_destino") {
    return {
      texto:
        "No se leyó la hoja de los aplicadores porque el proyecto no recuerda su enlace: «Asignación de aplicadores» se rehízo con el reparto de la app, que puede no coincidir con lo que el coordinador cambió a mano. Pega su enlace una vez en Asignación.",
      tono: "atencion",
    };
  }
  const causa = String(ad.error ?? "").trim();
  return {
    texto:
      `No se pudo leer la hoja de los aplicadores${causa ? ` (${causa})` : ""}: ` +
      "«Asignación de aplicadores» se rehízo con el reparto de la app y puede contradecirla.",
    tono: "atencion",
  };
}

export function avisoLibroPublicado(res: {
  hojas?: HojaDelLibroPublicada[] | null;
  destino_guardado?: boolean;
  lectura_previa?: LecturaPreviaDelLibro | null;
  adopcion_distribucion?: AdopcionDeLaDistribucion | null;
  /**
   * Hojas de la APP que salieron con bastante menos contenido del que tenían.
   * Vacío es lo normal. Con entradas hay que mirar: el 2026-09-12 una
   * publicación dejó «Base de control» sin 3.555 celdas y el recibo dijo
   * «actualizada» igual — encoger y actualizar se veían lo mismo.
   */
  encogidas?: ReadonlyArray<{ hoja: string; antes: number; ahora: number }> | null;
}): { texto: string; tono: TonoAviso } {
  const hojas = res.hojas ?? [];
  if (!hojas.length) {
    // Sin resumen no se finge un verde: algo se publicó pero no se sabe qué.
    return {
      texto: "La publicación terminó pero no dijo qué pasó con cada hoja.",
      tono: "atencion",
    };
  }
  const lectura = fraseDeLecturaPrevia(res.lectura_previa);
  const adopcion = fraseDeAdopcion(res.adopcion_distribucion);
  const encogidas = (res.encogidas ?? []).filter((e) => e && e.antes > e.ahora);
  const partes = [
    ...(lectura.texto ? [lectura.texto] : []),
    ...(adopcion.texto ? [adopcion.texto] : []),
    `Libro publicado: ${hojas.map(fraseDeHoja).join(" · ")}.`,
    // **Lo que encogió va con sus dos cifras.** «Se actualizó» sobre una hoja
    // que perdió la mitad del contenido es cierto y es inútil: lo que hay que
    // poder decidir es si tocaba revisar antes de que alguien lo note solo.
    ...(encogidas.length
      ? [
          `${encogidas.length === 1 ? "Una hoja salió" : `${encogidas.length} hojas salieron`} con bastante menos contenido del que tenía: ` +
            encogidas
              .map((e) => `«${e.hoja}» de ${cuenta(e.antes, "fila", "filas")} a ${cuenta(e.ahora, "fila", "filas")}`)
              .join("; ") +
            ". Conviene mirarlas antes de darlas por buenas.",
        ]
      : []),
  ];
  if (res.destino_guardado) {
    partes.push("El enlace quedó guardado: leer y publicar lo usarán sin volver a pedirlo.");
  }
  // **El tono se lo lleva el que peor esté.** Con `lectura.tono` a secas, una
  // adopción fallida —que deja «Asignación de aplicadores» contradiciendo a la
  // hoja de los 22— se pintaba en verde porque la lectura del libro sí había
  // ido bien, y eso es exactamente cómo un aviso deja de mirarse.
  // Y una hoja que encogió pesa igual que los otros dos: es lo que puede
  // haber perdido trabajo.
  const tono: TonoAviso = encogidas.length ||
    lectura.tono === "atencion" || adopcion.tono === "atencion"
    ? "atencion"
    : lectura.tono;
  return { texto: partes.join(" "), tono };
}

/**
 * El recibo de releer el cruce con el otro estudio.
 *
 * Dice las tres cosas que decide quien lo pulsa: **cuántas unidades comparten
 * algo**, **de qué tipo** —que es lo que separa «su docente ya habló con
 * alguien» de «ya aplicaron en esa aula»— y **si el libro vivo se pudo leer**.
 * Lo tercero no es un detalle técnico: sin él el cruce no puede afirmar quién
 * fue contactado, y un recibo que lo calle da por medido lo que no se midió.
 */
export function avisoTraslapeRecalculado(res: {
  traslape?: {
    unidades?: number;
    con_traslape?: number;
    por_veredicto?: Record<string, number> | null;
    etiqueta?: string;
  } | null;
  libro_leido?: boolean;
  aulas_del_otro?: number;
}): { texto: string; tono: TonoAviso } {
  const t = res.traslape ?? {};
  const con = Number(t.con_traslape ?? 0) || 0;
  const total = Number(t.unidades ?? 0) || 0;
  const quien = (t.etiqueta ?? "").trim() || "el otro estudio";
  if (!total) {
    return {
      texto: `El cruce con ${quien} no devolvió ninguna unidad: revisa la fuente declarada.`,
      tono: "atencion",
    };
  }
  /**
   * **El veredicto sin la cola que repite el estudio.** El motor los redacta
   * enteros —«AULA EN EL PLAN DE HSVG»— porque cada uno viaja solo, en su celda
   * del libro. Aquí van cuatro seguidos en una frase que ya empieza diciendo
   * «Cruce con HSVG», así que la cola se repite cinco veces; y al pasarlos a
   * minúscula el nombre del estudio salía «hsvg», que no es como se escribe.
   * Mismo recorte que hace la lista de la reserva dirigida con su celda.
   */
  const sinLaCola = (v: string) => {
    const texto = v.toLocaleLowerCase("es").trim();
    const cola = quien.toLocaleLowerCase("es");
    for (const sufijo of [` de ${cola}`, ` en ${cola}`]) {
      if (texto.endsWith(sufijo)) return texto.slice(0, -sufijo.length);
    }
    // Si el motor cambia la redacción no casa, y se muestra entero: mutilarlo
    // por una posición adivinada sería peor que repetir el nombre.
    return texto;
  };
  const partes = Object.entries(t.por_veredicto ?? {})
    // De mayor a menor: la lista existe para que el primero sea el que más pesa.
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k, v]) => `${fmt(v)} ${sinLaCola(k)}`);
  const detalle = partes.length ? ` — ${partes.join(", ")}` : "";
  // El libro NO leído no es un fallo del cruce: es un alcance menor, y el tono
  // lo dice sin convertirlo en error.
  const sinLibro = res.libro_leido === false
    ? ` No se pudo leer el libro vivo de ${quien}, así que el cruce dice quién está en su plan pero no a quién ya contactaron.`
    : "";
  return {
    texto: `Cruce con ${quien} releído: ${fmt(con)} de ${fmt(total)} unidades comparten algo${detalle}.${sinLibro}`,
    tono: res.libro_leido === false ? "atencion" : "ok",
  };
}
