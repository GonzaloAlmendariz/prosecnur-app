import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { facultadEnPalabras } from "../../../../../lib/nombresDeFacultad";
import { MES_CORTO } from "../../../mesesEnPalabras";
import { avanceCuota, numeroONulo } from "../avanceCuota";
import { fmt, pctPerfil } from "../kpisDeAulas";
import { readinessDeAulas } from "../navegacion/readinessDeAulas";

/**
 * Avance › Resumen de Cursos-horario (ficha A1 de
 * `docs/qa/revamp-monitoreo/aulas.md`), listo para pintar.
 *
 * Todo sale del tablero que ya publica el motor —`avance_cuota.total`, sus
 * `facultades`, el invariante del bloque y `ritmo_diario`—. Aquí sólo se
 * proyecta: orden, rótulos y geometría del gráfico. La única cuenta propia es
 * el avance contra la meta operativa, que el motor no publica como porcentaje
 * y la ficha pide (cuentan ÷ meta operativa).
 *
 * Un dato que no llega se dice como «—» con su causa, nunca como un 0 que
 * parezca medido.
 */

export const MARCA_RESUMEN_AULAS = readinessDeAulas("avance", "resumen");

type Tono = "ok" | "aviso" | "neutro";

export type EjeDelResumen = {
  clave: string;
  /** «Facultad», «Nivel». */
  etiqueta: string;
  /** «Facultades», «Niveles». */
  plural: string;
  /** «Sin facultad», «Sin nivel». */
  sin: string;
};

export type DatoSecundario = { rotulo: string; valor: string; titulo?: string };

export type Protagonista = {
  /** Efectivas en celdas de la cuota; `null` si el bloque no llegó. */
  cuentan: number | null;
  muestra: number | null;
  /** Fracción para el anillo, capada a 1 sólo para pintar. */
  proporcion: number;
  /** El porcentaje del motor, sin cap: «133.1 %», o «—». */
  avanceTexto: string;
  chip: { tono: Tono; texto: string };
  secundarios: [DatoSecundario, DatoSecundario];
  /** Por qué no hay cifra, cuando no la hay. */
  causa: string | null;
};

export type ParteDelInvariante = {
  clave: string;
  rotulo: string;
  /** `null` = la parte no viajó en el payload: se pinta «—». */
  valor: number | null;
  principal: boolean;
};

export type Invariante = {
  /** Efectivas del estudio; `null` si el motor no publicó el total. */
  total: number | null;
  partes: ParteDelInvariante[];
  /** Sólo cuando las partes NO suman el total. */
  descuadre: string | null;
};

export type DiaDelGrafico = {
  fecha: string;
  etiqueta: string;
  validas: number;
  acumulado: number;
  /** Geometría en porcentaje del lienzo (0–100). */
  x: number;
  ancho: number;
  yDia: number;
  yAcumulado: number;
  /** Cifra que va sobre la barra del día; vacía cuando el día no tuvo efectivas. */
  rotuloDia: string;
};

export type MetaDelGrafico = { clave: string; rotulo: string; valor: number; y: number };

export type Ritmo =
  | { tipo: "sin-dato"; causa: string }
  | { tipo: "sin-dias"; causa: string }
  | {
    tipo: "serie";
    resumen: string;
    dias: DiaDelGrafico[];
    metas: MetaDelGrafico[];
    /** Marcas del eje Y, de abajo arriba, con su altura en %. */
    marcasY: Array<{ valor: number; texto: string; y: number }>;
    /** Fechas bajo las barras, raleadas para que quepan; la última siempre va. */
    marcasX: Array<{ x: number; texto: string }>;
    /** Dónde arranca, en % del lienzo, la banda de las barras del día. */
    bandaDia: number;
    trazo: string;
    aria: string;
  };

export type TarjetaDeGrupo = {
  clave: string;
  /** El valor del eje tal como lo publica el motor; es el que va al `foco`. */
  valor: string;
  nombre: string;
  /** «109.9 %» o «—» cuando no hay cuota. */
  avanceTexto: string;
  /** «443 de 403», «57 de 62, faltan 5», «140 efectivas fuera del diseño». */
  lectura: string;
  /** Ancho del relleno, capado a 100. */
  relleno: number;
  tono: Tono;
  /** La tarjeta no tiene cuota contra la que medirse. */
  sinCuota: boolean;
  aria: string;
};

export type ModeloResumenAulas = {
  /** Clasificación del estado de la vista. */
  estado: "sin-tablero" | "sin-avance" | "sin-efectivas" | "listo";
  eje: EjeDelResumen;
  protagonista: Protagonista;
  invariante: Invariante;
  ritmo: Ritmo;
  grupos: { titulo: string; tarjetas: TarjetaDeGrupo[]; vacio: string | null };
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** El eje de la cuota que declara el estudio (facultad, nivel, carrera); facultad si el corte no lo trae. */
export function ejeDe(dashboard: MonitoreoAulasDashboard | null): EjeDelResumen {
  const eje = dashboard?.avance_cuota?.eje ?? null;
  const etiqueta = texto(eje?.etiqueta) || "Facultad";
  return {
    clave: texto(eje?.clave) || "facultad",
    etiqueta,
    plural: texto(eje?.etiqueta_plural) || `${etiqueta}es`,
    sin: texto(eje?.etiqueta_sin) || `Sin ${etiqueta.toLocaleLowerCase("es")}`,
  };
}

/** «9» de un eje por nivel se lee «Nivel 9»; una facultad en mayúsculas, normalizada. */
export function nombreDelGrupo(valor: string, eje: EjeDelResumen): string {
  const v = valor.trim();
  if (/^\d+$/.test(v)) return `${eje.etiqueta} ${fmt(Number(v))}`;
  return facultadEnPalabras(v) || v;
}

/** «el nivel 9», «Derecho»: cómo se nombra un grupo dentro de una frase. */
function grupoEnFrase(nombre: string, eje: EjeDelResumen): string {
  const etiqueta = eje.etiqueta.toLocaleLowerCase("es");
  if (nombre.toLocaleLowerCase("es").startsWith(`${etiqueta} `)) {
    return `el ${etiqueta}${nombre.slice(etiqueta.length)}`;
  }
  return nombre;
}

/** «7 set» desde un `YYYY-MM-DD`, sin pasar por `Date` (el huso lo movería). */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  const mes = MES_CORTO[Number(m[2]) - 1];
  return mes ? `${fmt(Number(m[3]))} ${mes}` : iso;
}

/**
 * El techo del eje: cuatro tramos de un paso «redondo» (1, 2, 2.5 o 5 por una
 * potencia de diez) que cubren el valor más alto. 3,750 da 4,000; 644 da 800.
 */
export function techoDelEje(maximo: number): number {
  if (!Number.isFinite(maximo) || maximo <= 0) return 4;
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= crudo - 1e-9) ?? 10 * potencia;
  return paso * 4;
}

function protagonistaDe(
  dashboard: MonitoreoAulasDashboard | null,
  eje: EjeDelResumen,
  efectivasDelEstudio: number | null,
): Protagonista {
  const bloque = dashboard?.avance_cuota ?? null;
  const vacioSecundario: [DatoSecundario, DatoSecundario] = [
    { rotulo: "Meta operativa", valor: "—" },
    { rotulo: "Efectivas del estudio", valor: "—" },
  ];
  if (!bloque || !bloque.total) {
    return {
      cuentan: null,
      muestra: null,
      proporcion: 0,
      avanceTexto: "—",
      chip: { tono: "neutro", texto: "Sin avance contra la cuota" },
      secundarios: vacioSecundario,
      causa: dashboard
        ? "El tablero de este corte no trae el avance contra la cuota del diseño."
        : "Todavía no hay tablero calculado para este estudio.",
    };
  }
  const t = bloque.total;
  const cuentan = numeroONulo(t.respuestas_validas);
  const muestra = numeroONulo(t.cuota);
  const avance = numeroONulo(t.avance_pct);
  const brecha = numeroONulo(t.brecha);
  const vista = avanceCuota(bloque);
  const conBrecha = vista.filas.filter((f) => f.estado !== "fuera_del_diseno" && f.estado !== "sin_cuota" && f.brecha > 0);

  let chip: Protagonista["chip"];
  if (!cuentan) {
    chip = { tono: "neutro", texto: "Aún no hay efectivas" };
  } else if (muestra == null) {
    chip = { tono: "neutro", texto: "Sin cuota del diseño" };
  } else if (conBrecha.length === 1) {
    const f = conBrecha[0];
    chip = { tono: "aviso", texto: `Faltan ${fmt(f.brecha)} en ${grupoEnFrase(nombreDelGrupo(f.facultad, eje), eje)}` };
  } else if (conBrecha.length > 1) {
    const falta = brecha ?? conBrecha.reduce((s, f) => s + f.brecha, 0);
    chip = {
      tono: "aviso",
      texto: `Faltan ${fmt(falta)} en ${fmt(conBrecha.length)} ${eje.plural.toLocaleLowerCase("es")}`,
    };
  } else if (brecha != null && brecha > 0) {
    chip = { tono: "aviso", texto: `Faltan ${fmt(brecha)} para la muestra` };
  } else {
    chip = { tono: "ok", texto: "Muestra cumplida" };
  }

  const metaOperativa = numeroONulo(bloque.meta_operativa);
  const efectivasTexto = efectivasDelEstudio == null ? "—" : fmt(efectivasDelEstudio);
  let secundarios: [DatoSecundario, DatoSecundario];
  if (metaOperativa != null && metaOperativa > 0 && (muestra == null || metaOperativa > muestra)) {
    const pct = cuentan == null ? null : (100 * cuentan) / metaOperativa;
    const falta = cuentan == null ? null : Math.max(0, metaOperativa - cuentan);
    secundarios = [
      { rotulo: `Meta operativa de ${fmt(metaOperativa)}`, valor: pct == null ? "—" : pctPerfil(pct) },
      falta === 0
        ? { rotulo: "Faltan para cumplirla", valor: "Cumplida" }
        : { rotulo: "Faltan para cumplirla", valor: falta == null ? "—" : fmt(falta) },
    ];
  } else {
    secundarios = [
      {
        rotulo: "Efectivas del estudio",
        valor: efectivasTexto,
        titulo: "Incluye las que no caen en ninguna celda de la cuota",
      },
      { rotulo: "Sobremuestra", valor: "Sin declarar", titulo: "El diseño no publica una meta operativa por encima de la muestra" },
    ];
  }

  return {
    cuentan,
    muestra,
    proporcion: avance == null ? 0 : Math.max(0, Math.min(1, avance / 100)),
    avanceTexto: avance == null ? "—" : `${fmt(Math.round(avance))} %`,
    chip,
    secundarios,
    causa: muestra == null ? "El diseño no declara una cuota total: no hay denominador." : null,
  };
}

type PartesBrutas = Partial<Record<"en_celdas" | "duplicadas" | "sin_eje" | "fuera_universo" | "huerfanas" | "sin_celda", unknown>>;

/** `invariante.partes` del motor, que el tipo del payload todavía no declara. */
function partesDelMotor(invariante: unknown): PartesBrutas | null {
  if (!invariante || typeof invariante !== "object") return null;
  const partes = (invariante as { partes?: unknown }).partes;
  return partes && typeof partes === "object" ? (partes as PartesBrutas) : null;
}

function invarianteDe(dashboard: MonitoreoAulasDashboard | null, eje: EjeDelResumen): Invariante {
  const t = dashboard?.avance_cuota?.total ?? null;
  const inv = t?.invariante ?? null;
  const partes = partesDelMotor(inv);
  // La parte del motor manda; si no viajó, el campo hermano del total.
  const leer = (clave: keyof PartesBrutas, respaldo: unknown) =>
    numeroONulo(partes?.[clave] ?? respaldo);
  const lista: ParteDelInvariante[] = [
    { clave: "en_celdas", rotulo: "Efectivas en celdas de la cuota", valor: leer("en_celdas", t?.respuestas_validas), principal: true },
    { clave: "duplicadas", rotulo: "Respondieron dos veces", valor: leer("duplicadas", t?.duplicadas), principal: false },
    {
      clave: "sin_eje",
      rotulo: eje.clave === "facultad" ? eje.sin : `${eje.sin} en el padrón`,
      valor: leer("sin_eje", t?.sin_eje),
      principal: false,
    },
    { clave: "fuera_universo", rotulo: "Fuera del universo", valor: leer("fuera_universo", t?.fuera_universo), principal: false },
    { clave: "huerfanas", rotulo: "Sin curso-horario del plan", valor: leer("huerfanas", t?.huerfanas), principal: false },
    {
      clave: "sin_celda",
      rotulo: `En ${eje.plural.toLocaleLowerCase("es")} sin meta`,
      valor: leer("sin_celda", t?.sin_celda),
      principal: false,
    },
  ];
  const totalDelMotor = numeroONulo(inv?.total);
  const completas = lista.every((p) => p.valor != null);
  const total = totalDelMotor ?? (t && completas ? lista.reduce((s, p) => s + (p.valor ?? 0), 0) : null);
  const descuadre = inv && inv.ok === false
    ? `Las partes suman ${fmt(numeroONulo(inv.suma) ?? 0)} y las efectivas son ${fmt(numeroONulo(inv.total) ?? 0)}` +
      ((numeroONulo(inv.solapadas) ?? 0) > 0 ? `; ${fmt(numeroONulo(inv.solapadas) ?? 0)} están en dos lugares` : "")
    : null;
  return { total, partes: lista, descuadre };
}

/** La curva acumulada ocupa de 0 a este % del alto; la banda del día, de BANDA_DIA a 100. */
const ZONA_ACUMULADO = 66;
const BANDA_DIA = 74;
/** Fechas que entran bajo el gráfico sin pisarse en el ancho más angosto (1280). */
const FECHAS_QUE_CABEN = 14;

function ritmoDe(dashboard: MonitoreoAulasDashboard | null, protagonista: Protagonista, metaOperativa: number | null): Ritmo {
  const ritmo = dashboard?.ritmo_diario ?? null;
  if (!ritmo || !Array.isArray(ritmo.dias)) {
    return { tipo: "sin-dato", causa: "Este corte no trae la serie diaria: la publica el motor al traer respuestas." };
  }
  const brutos = ritmo.dias
    .map((d) => ({
      fecha: texto(d?.fecha),
      validas: numeroONulo(d?.validas) ?? 0,
      acumulado: numeroONulo(d?.acumulado) ?? 0,
    }))
    .filter((d) => d.fecha);
  if (!brutos.length) {
    return { tipo: "sin-dias", causa: "Aún no hay efectivas con fecha de envío." };
  }

  const metas: Array<{ clave: string; rotulo: string; valor: number }> = [];
  if (protagonista.muestra != null && protagonista.muestra > 0) {
    metas.push({ clave: "muestra", rotulo: "Muestra", valor: protagonista.muestra });
  }
  if (metaOperativa != null && metaOperativa > (protagonista.muestra ?? 0)) {
    metas.push({ clave: "operativa", rotulo: "Meta operativa", valor: metaOperativa });
  }
  // Dos zonas en el mismo marco: arriba la curva acumulada con su eje y las
  // metas; abajo, una banda con las barras del día a escala propia y su cifra
  // encima. En una sola escala el mejor día (466) era el 11 % de 4,000 y las
  // barras se leían como ruido al pie del gráfico.
  const maximo = Math.max(...brutos.map((d) => d.acumulado), ...metas.map((m) => m.valor));
  const techo = techoDelEje(maximo);
  const techoDia = techoDelEje(Math.max(1, ...brutos.map((d) => d.validas)));
  const n = brutos.length;
  const paso = 100 / n;
  const y = (valor: number) => ZONA_ACUMULADO - (ZONA_ACUMULADO * Math.max(0, valor)) / techo;
  const yDia = (valor: number) => 100 - ((100 - BANDA_DIA) * Math.max(0, valor)) / techoDia;
  const dias: DiaDelGrafico[] = brutos.map((d, i) => ({
    ...d,
    etiqueta: fechaCorta(d.fecha),
    x: paso * (i + 0.5),
    ancho: Math.min(paso * 0.62, 6),
    yDia: yDia(d.validas),
    yAcumulado: y(d.acumulado),
    rotuloDia: d.validas > 0 ? fmt(d.validas) : "",
  }));
  const trazo = dias.map((d, i) => `${i ? "L" : "M"}${d.x.toFixed(2)} ${d.yAcumulado.toFixed(2)}`).join(" ");
  const marcasY = [0, 1, 2, 3, 4].map((k) => {
    const valor = (techo * k) / 4;
    return { valor, texto: fmt(valor), y: y(valor) };
  });
  const cada = Math.ceil(n / FECHAS_QUE_CABEN);
  const marcasX = dias
    .filter((_, i) => i === n - 1 || (i % cada === 0 && n - 1 - i >= cada))
    .map((d) => ({ x: d.x, texto: d.etiqueta }));

  const diasConCampo = numeroONulo(ritmo.dias_con_campo) ?? brutos.filter((d) => d.validas > 0).length;
  const mejor = ritmo.mejor_dia && texto(ritmo.mejor_dia.fecha)
    ? { etiqueta: fechaCorta(texto(ritmo.mejor_dia.fecha)), validas: numeroONulo(ritmo.mejor_dia.validas) ?? 0 }
    : null;
  const dias1 = diasConCampo === 1 ? "1 día con campo" : `${fmt(diasConCampo)} días con campo`;
  const resumen = mejor ? `${dias1}; el mejor, el ${mejor.etiqueta} con ${fmt(mejor.validas)}` : dias1;
  const ultimo = dias[n - 1];
  return {
    tipo: "serie",
    resumen,
    dias,
    metas: metas.map((m) => ({ ...m, y: y(m.valor) })),
    marcasY,
    marcasX,
    bandaDia: BANDA_DIA,
    trazo,
    aria: `Efectivas acumuladas por día: ${fmt(ultimo.acumulado)} al ${ultimo.etiqueta}, en ${dias1}` +
      (metas.length ? `; ${metas.map((m) => `${m.rotulo.toLocaleLowerCase("es")} de ${fmt(m.valor)}`).join(" y ")}` : ""),
  };
}

function gruposDe(dashboard: MonitoreoAulasDashboard | null, eje: EjeDelResumen): ModeloResumenAulas["grupos"] {
  const titulo = `Por ${eje.etiqueta.toLocaleLowerCase("es")}`;
  const bloque = dashboard?.avance_cuota ?? null;
  if (!bloque) return { titulo, tarjetas: [], vacio: "El tablero no trae el avance por grupo de la cuota." };
  const vista = avanceCuota(bloque);
  if (!vista.filas.length) return { titulo, tarjetas: [], vacio: vista.vacio ?? "Sin grupos en la cuota del diseño." };

  const rango = (estado: string) => (estado === "fuera_del_diseno" ? 2 : estado === "sin_cuota" ? 1 : 0);
  const filas = [...vista.filas].sort((a, b) =>
    rango(a.estado) - rango(b.estado)
    || (a.avance ?? 0) - (b.avance ?? 0)
    || a.facultad.localeCompare(b.facultad, "es", { numeric: true }));

  const tarjetas = filas.map((f): TarjetaDeGrupo => {
    const nombre = nombreDelGrupo(f.facultad, eje);
    if (f.estado === "fuera_del_diseno") {
      const lectura = `${fmt(f.validas)} ${f.validas === 1 ? "efectiva" : "efectivas"} fuera del diseño`;
      return {
        clave: f.clave, valor: f.facultad, nombre, avanceTexto: "—", lectura, relleno: 0, tono: "neutro", sinCuota: true,
        aria: `${nombre}: ${lectura}, no cuentan para ninguna cuota`,
      };
    }
    if (f.estado === "sin_cuota" || f.cuota == null) {
      const lectura = `${fmt(f.validas)} sin cuota en el diseño`;
      return {
        clave: f.clave, valor: f.facultad, nombre, avanceTexto: "—", lectura, relleno: 0, tono: "neutro", sinCuota: true,
        aria: `${nombre}: ${lectura}`,
      };
    }
    const fraccion = `${fmt(f.validas)} de ${fmt(f.cuota)}`;
    const lectura = f.cumplida ? fraccion : `${fraccion}, faltan ${fmt(f.brecha)}`;
    const avanceTexto = pctPerfil(f.avance ?? 0);
    return {
      clave: f.clave,
      valor: f.facultad,
      nombre,
      avanceTexto,
      lectura: f.estado === "sin_aulas_en_plan" ? `${lectura}; sin cursos-horario sorteados` : lectura,
      relleno: f.relleno,
      tono: f.cumplida ? "ok" : "aviso",
      sinCuota: false,
      aria: `${nombre}: ${avanceTexto}, ${lectura}`,
    };
  });
  return { titulo, tarjetas, vacio: null };
}

export function construirResumenAulas(dashboard: MonitoreoAulasDashboard | null): ModeloResumenAulas {
  const eje = ejeDe(dashboard);
  const invariante = invarianteDe(dashboard, eje);
  const protagonista = protagonistaDe(dashboard, eje, invariante.total);
  const metaOperativa = numeroONulo(dashboard?.avance_cuota?.meta_operativa);
  const ritmo = ritmoDe(dashboard, protagonista, metaOperativa);
  const grupos = gruposDe(dashboard, eje);
  const estado: ModeloResumenAulas["estado"] = !dashboard
    ? "sin-tablero"
    : !dashboard.avance_cuota?.total
      ? "sin-avance"
      : !protagonista.cuentan && !invariante.total
        ? "sin-efectivas"
        : "listo";
  return { estado, eje, protagonista, invariante, ritmo, grupos };
}

/**
 * La marca de readiness de la pestaña: `false` sólo mientras carga, la
 * dirección cuando pintó contenido real y `vacio:<motivo>` en un terminal sin
 * contenido, para no colgar la captura (readinessAnidada).
 */
export function readinessDelResumen(modelo: ModeloResumenAulas | null, cargando: boolean): string {
  if (cargando || !modelo) return "false";
  if (modelo.estado === "listo") return MARCA_RESUMEN_AULAS;
  return `vacio:${modelo.estado}`;
}
