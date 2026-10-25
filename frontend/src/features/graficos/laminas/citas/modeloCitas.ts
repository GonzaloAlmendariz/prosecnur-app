// Modelo puro de la tarjeta de aprobación de citas (O3b-b, TXT-8/9). `citas_aprobadas` lleva ids u objetos
// {id, texto, sic} (api/R/texto_citas.R). La tarjeta guarda siempre objetos y valida la edición antes de guardar con la
// misma regla del backend (`.citas_validar_edicion`): un recorte del original («[…]» donde se quita algo) o una
// corrección leve (tildes, mayúsculas o hasta dos letras en palabras de cuatro o más, sin palabras nuevas).

export const TOPE_CITAS = 5;
export const ELISION = "[…]";

export type CitaAprobada = { id: string; texto?: string; sic?: true | string[] };

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const compactar = (s: string) => s.replace(/\s+/g, " ").trim();

export function leerAprobadas(valor: unknown): CitaAprobada[] {
  const out: CitaAprobada[] = [];
  for (const it of Array.isArray(valor) ? valor : []) {
    const id = typeof it === "string" ? it.trim() : esObjeto(it) && typeof it.id === "string" ? it.id.trim() : "";
    if (!id || out.some((c) => c.id === id)) continue;
    const c: CitaAprobada = { id };
    if (esObjeto(it)) {
      if (typeof it.texto === "string" && it.texto.trim()) c.texto = it.texto;
      const palabras = Array.isArray(it.sic) ? it.sic.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
      if (palabras.length) c.sic = palabras;
      else if (it.sic === true) c.sic = true;
    }
    out.push(c);
  }
  return out;
}

export function emitirAprobadas(lista: readonly CitaAprobada[]): CitaAprobada[] {
  return lista.map((c) => ({ id: c.id, ...(c.texto ? { texto: c.texto } : {}), ...(c.sic ? { sic: c.sic } : {}) }));
}

export function aprobar(lista: CitaAprobada[], id: string): CitaAprobada[] {
  if (lista.length >= TOPE_CITAS || lista.some((c) => c.id === id)) return lista;
  return [...lista, { id }];
}

export function quitar(lista: readonly CitaAprobada[], id: string): CitaAprobada[] {
  return lista.filter((c) => c.id !== id);
}

export function mover(lista: readonly CitaAprobada[], id: string, delta: -1 | 1): CitaAprobada[] {
  const i = lista.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return [...lista];
  const out = [...lista];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function actualizar(lista: readonly CitaAprobada[], id: string, cambio: Partial<Omit<CitaAprobada, "id">>): CitaAprobada[] {
  return lista.map((c) => {
    if (c.id !== id) return c;
    const n: CitaAprobada = { ...c, ...cambio };
    if (!n.texto) delete n.texto;
    if (!n.sic || (Array.isArray(n.sic) && !n.sic.length)) delete n.sic;
    return n;
  });
}

// ---------------------------------------------------------------------------
// Recorte: el comentario en oraciones y fragmentos (cortes tras «.», «!», «?», «…», «,», «;» o «:»).
// ---------------------------------------------------------------------------

export function segmentosCita(texto: string): string[] {
  const ws = compactar(texto).split(" ").filter(Boolean);
  const out: string[] = [];
  let actual: string[] = [];
  for (const w of ws) {
    actual.push(w);
    if (/[.!?…,;:]["”»)]*$/.test(w)) { out.push(actual.join(" ")); actual = []; }
  }
  if (actual.length) out.push(actual.join(" "));
  return out;
}

/** Lo elegido, en su orden, con «[…]» donde se quitó algo (al inicio, en medio o al final). */
export function armarRecorte(segmentos: readonly string[], elegidos: readonly boolean[]): string {
  if (!elegidos.some(Boolean)) return "";
  const partes: string[] = [];
  let hueco = false;
  segmentos.forEach((s, i) => {
    if (!elegidos[i]) { hueco = true; return; }
    if (hueco) {
      if (partes.length) partes[partes.length - 1] = partes[partes.length - 1].replace(/[,;:]+$/, "");
      partes.push(ELISION);
      hueco = false;
    }
    partes.push(s);
  });
  if (hueco) {
    partes[partes.length - 1] = partes[partes.length - 1].replace(/[,;:]+$/, "");
    partes.push(ELISION);
  }
  return partes.join(" ");
}

// ---------------------------------------------------------------------------
// Validación: espejo de `.citas_validar_edicion` (api/R/texto_citas.R).
// ---------------------------------------------------------------------------

export type Validacion = { ok: boolean; tipo: Array<"recorte" | "correccion">; texto: string; motivo: string };

const FIN_ORACION = /[.!?…]["”»)]*$/;
const sinTildes = (s: string) => s.replace(/[áéíóúüñàèìòù]/g, (c) => "aeiouunaeiou"["áéíóúüñàèìòù".indexOf(c)]);
const nucleo = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const bordeIni = (w: string) => /^[^\p{L}\p{N}]*/u.exec(w)?.[0] ?? "";
const bordeFin = (w: string) => (nucleo(w) ? /[^\p{L}\p{N}]*$/u.exec(w)?.[0] ?? "" : "");
const largo = (s: string) => [...s].length;

function distancia(a: string, b: string): number {
  const x = [...a]; const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}

function compararPalabra(o: string, e: string, primero: boolean, ultimo: boolean): "igual" | "correccion" | null {
  if (o === e) return "igual";
  if (!primero && bordeIni(o) !== bordeIni(e)) return null;
  if (!ultimo && bordeFin(o) !== bordeFin(e)) return null;
  const no = nucleo(o); const ne = nucleo(e);
  if (no === ne || (primero && no.toLowerCase() === ne.toLowerCase())) return "igual";
  if (!no || !ne) return null;
  if (sinTildes(no.toLowerCase()) === sinTildes(ne.toLowerCase())) return "correccion";
  if (largo(no) >= 4 && distancia(no.toLowerCase(), ne.toLowerCase()) <= 2) return "correccion";
  return null;
}

export function validarEdicion(original: string, editado: string): Validacion {
  const o = compactar(original);
  let e = compactar(editado.replace(/\[\s*(\.\.\.|…)\s*\]/g, ELISION));
  e = e.replace(/^["“”«»]+\s*|\s*["“”«»]+$/g, "").trim();
  const rechazo = (motivo: string): Validacion => ({ ok: false, tipo: [], texto: o, motivo });
  if (!e) return rechazo("viene vacía");
  if (e === o) return { ok: true, tipo: [], texto: o, motivo: "" };
  const ot = o.split(" ");
  const iniEl = /^\s*\[…\]\s*/.test(e); const finEl = /\s*\[…\]\s*$/.test(e);
  const partes = e.split(/\s*\[…\]\s*/).map((p) => p.trim()).filter((p) => nucleo(p) !== "" && /[\p{L}\p{N}]/u.test(p));
  if (!partes.length) return rechazo("no conserva ninguna palabra del comentario");
  let pos = 0; let ini = -1; let fin = -1; let cambios = 0; let usadas = 0;
  for (const parte of partes) {
    const ft = parte.split(" "); const m = ft.length; let hallado = false;
    for (let s = pos; s + m <= ot.length; s++) {
      const r = ft.map((w, j) => compararPalabra(ot[s + j], w, j === 0, j === m - 1));
      if (r.includes(null)) continue;
      hallado = true; if (ini < 0) ini = s;
      fin = s + m - 1; pos = fin + 1; cambios += r.filter((x) => x === "correccion").length; usadas += m;
      break;
    }
    if (!hallado) {
      const clave = (w: string) => sinTildes(nucleo(w).toLowerCase());
      const del = new Set(ot.map(clave));
      const nuevas = [...new Set(ft.map(clave))].filter((w) => w && !del.has(w));
      return rechazo(nuevas.length ? `trae palabras que el comentario no tiene: «${nuevas.slice(0, 3).join("», «")}»`
        : "cambia el orden de las palabras o más de dos letras de una");
    }
  }
  if (ini > 0 && !iniEl && !FIN_ORACION.test(ot[ini - 1])) return rechazo("empieza a media frase sin «[…]»");
  if (fin < ot.length - 1 && !finEl && !FIN_ORACION.test(ot[fin])) return rechazo("termina a media frase sin «[…]»");
  if (cambios > Math.max(1, Math.floor(usadas / 3))) return rechazo(`corrige ${cambios} de ${usadas} palabras`);
  const recorte = partes.length > 1 || ini > 0 || fin < ot.length - 1;
  return { ok: true, tipo: [...(recorte ? ["recorte" as const] : []), ...(cambios > 0 ? ["correccion" as const] : [])], texto: e, motivo: "" };
}
