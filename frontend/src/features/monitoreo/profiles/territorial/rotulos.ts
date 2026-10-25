import { pctConEspacio } from "../../core/formatoComun";

/**
 * Formato y rótulos del modo territorial en el lenguaje común del revamp
 * (estándar §2a, 5c): cifras es-PE con coma de miles, porcentajes con un
 * decimal y espacio antes del signo, y ninguna clave del motor en pantalla.
 *
 * El motor publica distritos en mayúsculas y sin tildes («SAN MARTIN DE
 * PORRES»), tramos de edad como claves («18-29», «60+») y aplicadores como
 * «P824 · Nombre». Todo lo que se pinta pasa por aquí; `clavesSinRotulo`
 * falla si algo se escapa.
 */

export function fmt(value: unknown, sinDato = "—"): string {
  if (value == null || value === "") return sinDato;
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(n) : sinDato;
}

/** Con signo: «+1», «−1», «0». */
export function fmtConSigno(value: number): string {
  if (value > 0) return `+${fmt(value)}`;
  if (value < 0) return `−${fmt(Math.abs(value))}`;
  return "0";
}

export const pct = (value: unknown, sinDato = "—") => pctConEspacio(value, sinDato);

/** Porcentaje entero para insignias («107 %»). */
export function pctEntero(parte: number, total: number): string {
  if (!(total > 0)) return "—";
  return pctConEspacio(Math.round((parte / total) * 100)).replace(/\.0 %$/, " %");
}

const PALABRAS_CON_TILDE: Record<string, string> = {
  martin: "Martín",
  rimac: "Rímac",
  lurin: "Lurín",
  ancon: "Ancón",
  "santa maria": "Santa María",
  peru: "Perú",
  jesus: "Jesús",
  maria: "María",
};

const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "el"]);

/** «SAN MARTIN DE PORRES» → «San Martín de Porres». */
export function nombreDeDistrito(raw: unknown): string {
  const texto = String(raw ?? "").trim();
  if (!texto) return "Sin distrito";
  // El motor agrupa aparte los partes cuya UMP no cruza con la ruta.
  if (/^sin[\s_]*cruce[\s_]*(con[\s_]*)?ump$/i.test(texto)) return "UMP sin cruce con la ruta";
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((palabra, indice) => {
      const limpia = palabra.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (indice > 0 && CONECTORES.has(limpia)) return limpia;
      const conTilde = PALABRAS_CON_TILDE[limpia];
      if (conTilde) return conTilde;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

/** «18-29» → «18 a 29»; «60+» → «60 o más»; «Hombre» queda igual. */
export function rotuloDeCelda(raw: unknown): string {
  const texto = String(raw ?? "").trim();
  const rango = texto.match(/^(\d+)\s*[-_–]\s*(\d+)$/);
  if (rango) return `${rango[1]} a ${rango[2]}`;
  const abierto = texto.match(/^(\d+)\s*(\+|_mas|o mas|y mas)$/i);
  if (abierto) return `${abierto[1]} o más`;
  if (!texto) return "Sin dato";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Rótulo en minúscula para dentro de una frase: «30 a 44 años», «mujer». */
export function celdaEnFrase(raw: unknown): string {
  const rotulo = rotuloDeCelda(raw);
  return /^\d/.test(rotulo) ? `${rotulo} años` : rotulo.toLowerCase();
}

/**
 * El aplicador como lo muestra hoy la app: código y nombre («P132 · Nombre»).
 * Mostrar sólo el código queda como pregunta abierta para Gonzalo (plan T2).
 */
export function rotuloDeAplicador(raw: unknown): string {
  const texto = String(raw ?? "").trim();
  if (!texto) return "—";
  if (/^(sin responsable|sin asignar|no asignado)$/i.test(texto.split(/\s*·\s*/)[0]?.trim() ?? "")) return "Sin asignar";
  return texto;
}

/** «UMP 143» o «143» → «143». */
export function numeroDeUmp(raw: unknown): string {
  return String(raw ?? "").replace(/^UMP\s*/i, "").trim();
}

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

/**
 * «dd/mm» de una fecha del motor: ISO («2026-06-13») o la etiqueta larga
 * («13 Junio 05:46pm»). Vacío si no se reconoce.
 */
export function diaYMes(raw: unknown): string {
  const texto = String(raw ?? "").trim();
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    // Con hora viene en UTC: el día es el de Lima, no el de Greenwich.
    const fecha = new Date(texto);
    if (!Number.isNaN(fecha.getTime())) {
      return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    }
  }
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const largo = texto.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]+)/);
  if (largo) {
    const mes = MESES[largo[2].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()];
    if (mes) return `${largo[1].padStart(2, "0")}/${mes}`;
  }
  return "";
}

/**
 * «dd/mm hh:mm» en hora de Lima (UTC−5, sin horario de verano) de una marca del
 * motor. Una marca sin zona se toma como ya local. No depende del ICU del
 * entorno: Lima no cambia de huso.
 */
export function fechaYHoraDeLima(raw: unknown): string {
  const texto = String(raw ?? "").trim();
  if (!texto) return "";
  const conZona = /([zZ]|[+-]\d{2}:?\d{2})$/.test(texto);
  const local = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!conZona && local) return `${local[3]}/${local[2]} ${local[4]}:${local[5]}`;
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return diaYMes(texto);
  const lima = new Date(fecha.getTime() - 5 * 3_600_000);
  const dos = (valor: number) => String(valor).padStart(2, "0");
  return `${dos(lima.getUTCDate())}/${dos(lima.getUTCMonth() + 1)} ${dos(lima.getUTCHours())}:${dos(lima.getUTCMinutes())}`;
}

/**
 * «a, b y c»: une datos en una frase en vez de pegarlos con «·» (estándar §2,
 * escritura profesional). Ignora los vacíos.
 */
export function enumerar(partes: ReadonlyArray<string | null | undefined | false>): string {
  const limpias = partes.map((parte) => (parte ? String(parte).trim() : "")).filter(Boolean);
  if (limpias.length <= 1) return limpias[0] ?? "";
  return `${limpias.slice(0, -1).join(", ")} y ${limpias.at(-1)}`;
}
