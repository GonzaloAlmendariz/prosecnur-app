// Exportar e importar el plan de gráficos por secciones (C12). Lógica pura: qué secciones existen, qué viaja en el
// archivo, cómo se combina lo entrante con lo actual y cómo se nombra el archivo. La usan por igual la barra de
// Láminas (menú ⋯) y la barra del Editor anterior: no hay otra copia de estas reglas.
//
// Decisión 30 (docs/qa/paridad-retiro-editor-anterior-f6-2026-10-11.md): el archivo suma `estilo_cliente`,
// `documento_word` y `auto_otros_slides`, y deja de ofrecer «Guías de edición» (`debug_ph`) y «Vista de trabajo»
// (`view_mode`, `inspector_tab`, `density`, `canvas_viewport`). Esas claves persistidas pasan OPACAS: ni se exportan ni
// se importan, y una importación conserva las del proyecto tal cual (igual que su `_unknown`).
//
// `estilo_cliente` sigue el ADR 0094: el archivo lleva sólo las decisiones (diff contra el recetario) y los logos por
// `file_id`. Un JSON no transporta el PNG: al importar, el logo cuyo `file_id` no existe en el proyecto se descarta y la
// confirmación lo avisa (`resumenImportacion`).

import {
  ESTILO_LUGARES_LOGO,
  estiloClienteRecetario,
  normalizeEstiloCliente,
  type EstiloCliente,
  type EstiloLugarLogo,
  type EstiloRol,
} from "../../../api/graficosEstilo";

export type GraficosJsonSectionId =
  | "plan"
  | "auto_otros_slides"
  | "presets"
  | "w_presets"
  | "documento_word"
  | "estilo_cliente"
  | "paletas"
  | "iconos"
  | "overrides_reusables"
  | "scope_rules";

export type SeccionesJson = Record<GraficosJsonSectionId, boolean>;

export type ModoImportacionJson = "merge" | "replace";

export type SeccionJson = { id: GraficosJsonSectionId; label: string; help: string };

export const GRAFICOS_JSON_SECTIONS: readonly SeccionJson[] = [
  { id: "plan", label: "Láminas", help: "Orden y contenido de cada lámina." },
  { id: "auto_otros_slides", label: "Láminas de «Otros»", help: "Si el PPT agrega las respuestas «Otros»." },
  { id: "presets", label: "Estilo para PPT", help: "Bases visuales para PowerPoint." },
  { id: "w_presets", label: "Estilo para Word", help: "Formato de gráficos y tablas." },
  { id: "documento_word", label: "Documento Word", help: "Portada, apertura, redondeo y contacto." },
  { id: "estilo_cliente", label: "Identidad", help: "Logos y letra; un logo sólo se aplica si ya está en el proyecto." },
  { id: "paletas", label: "Colores", help: "Paletas de respuestas y categorías, con sus vínculos a listas." },
  { id: "iconos", label: "Íconos", help: "Recursos para láminas de población." },
  { id: "overrides_reusables", label: "Estilos reutilizables", help: "Ajustes guardados para varios gráficos." },
  { id: "scope_rules", label: "Reglas por caso", help: "Ajustes por lista, gráfico o slide." },
];

const IDS_SECCIONES = new Set<string>(GRAFICOS_JSON_SECTIONS.map((s) => s.id));

export function todasLasSecciones(valor: boolean): SeccionesJson {
  return Object.fromEntries(GRAFICOS_JSON_SECTIONS.map((s) => [s.id, valor])) as SeccionesJson;
}

export const SECCIONES_JSON_POR_DEFECTO: SeccionesJson = todasLasSecciones(true);

export function seccionesElegidas(secciones: SeccionesJson): SeccionJson[] {
  return GRAFICOS_JSON_SECTIONS.filter((s) => secciones[s.id]);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const actual = out[key];
    out[key] = isRecord(actual) && isRecord(value) ? deepMerge(actual, value) : value;
  }
  return out as T;
}

// --- estilo_cliente: sólo decisiones (ADR 0094) ------------------------------------------------------------------------

/**
 * Espejo de `.graficos_estilo_cliente_solo_decisiones` (api/R/graficos_estilo_cliente.R): fuera el `ambito` (no es estilo:
 * es del proyecto que lo guarda), el paso y los roles iguales a lo que heredarían, los logos iguales al default y los
 * contenedores vacíos; `version` sólo si queda algo. Lo desconocido se conserva. `{}` = «todo del recetario».
 */
export function estiloClienteDecisiones(estilo: unknown, defaults?: EstiloCliente | null): EstiloCliente {
  const x = normalizeEstiloCliente(estilo);
  const ref = defaults ?? estiloClienteRecetario();
  const pasoDef = ref.letra?.paso ?? "estandar";
  const out: EstiloCliente = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === "version" || k === "ambito" || k === "letra" || k === "logos") continue;
    out[k] = v;
  }
  const logos: Partial<Record<EstiloLugarLogo, { file_id: string; nombre?: string }>> = {};
  for (const lugar of ESTILO_LUGARES_LOGO) {
    const e = x.logos?.[lugar];
    if (e?.file_id && e.file_id !== ref.logos?.[lugar]?.file_id) logos[lugar] = e;
  }
  if (Object.keys(logos).length > 0) out.logos = logos;
  if (x.letra) {
    const letra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x.letra)) if (k !== "paso" && k !== "roles") letra[k] = v;
    const paso = x.letra.paso;
    if (paso && paso !== pasoDef) letra.paso = paso;
    const pasoEfectivo = paso ?? pasoDef;
    const roles: Record<string, string> = {};
    for (const [rol, p] of Object.entries(x.letra.roles ?? {})) {
      const heredado = ref.letra?.roles?.[rol as EstiloRol] ?? pasoEfectivo;
      if (p && p !== heredado) roles[rol] = p;
    }
    if (Object.keys(roles).length > 0) letra.roles = roles;
    if (Object.keys(letra).length > 0) out.letra = letra;
  }
  return Object.keys(out).length > 0 ? { version: 1, ...out } : {};
}

/** `file_id` de los logos que ya usa el proyecto (lo que viaja en `files/` del `.pulso`). */
export function fileIdsDeLogos(estilo: unknown): Set<string> {
  const x = normalizeEstiloCliente(estilo);
  const out = new Set<string>();
  for (const lugar of ESTILO_LUGARES_LOGO) {
    const fid = x.logos?.[lugar]?.file_id;
    if (fid) out.add(fid);
  }
  return out;
}

const LUGAR_HUMANO: Record<EstiloLugarLogo, string> = {
  portada_izquierda: "portada, izquierda",
  portada_derecha: "portada, derecha",
  contraportada: "contraportada",
};

export type LogoDescartado = { lugar: EstiloLugarLogo; fileId: string; rotulo: string };

/** Logos del archivo cuyo `file_id` no existe en el proyecto: un JSON no lleva el PNG, así que no se pueden aplicar. */
export function logosSinArchivo(entrante: unknown, existentes: ReadonlySet<string>): LogoDescartado[] {
  const x = normalizeEstiloCliente(entrante);
  const out: LogoDescartado[] = [];
  for (const lugar of ESTILO_LUGARES_LOGO) {
    const e = x.logos?.[lugar];
    if (!e?.file_id || existentes.has(e.file_id)) continue;
    out.push({ lugar, fileId: e.file_id, rotulo: e.nombre ? `«${e.nombre}» (${LUGAR_HUMANO[lugar]})` : LUGAR_HUMANO[lugar] });
  }
  return out;
}

function sinLogos(estilo: EstiloCliente, descartados: readonly LogoDescartado[]): EstiloCliente {
  if (!descartados.length || !estilo.logos) return estilo;
  const logos = { ...estilo.logos };
  for (const d of descartados) delete logos[d.lugar];
  const out: EstiloCliente = { ...estilo, logos };
  if (Object.keys(logos).length === 0) delete out.logos;
  return out;
}

// --- Exportar ---------------------------------------------------------------------------------------------------------

export function pickGraficosConfigSections(
  cfg: Record<string, unknown>,
  sections: SeccionesJson,
  mode: ModoImportacionJson,
  opciones: { estiloClienteDefaults?: EstiloCliente | null } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { version: "graficos/4" };
  if (sections.plan) out.plan = cfg.plan;
  if (sections.auto_otros_slides) out.auto_otros_slides = cfg.auto_otros_slides === true;
  if (sections.presets) out.presets = cfg.presets;
  if (sections.w_presets) out.w_presets = cfg.w_presets;
  if (sections.documento_word) out.documento_word = cfg.documento_word;
  if (sections.estilo_cliente) out.estilo_cliente = estiloClienteDecisiones(cfg.estilo_cliente, opciones.estiloClienteDefaults);
  if (sections.paletas) {
    out.paletas = cfg.paletas;
    // ADR 0097: los vínculos `lista → paleta` son parte de la sección Colores; sin ellos una paleta de otro proyecto
    // llegaría huérfana. Sólo decisiones (el normalizador ya los dejó así).
    out.paletas_vinculos = isRecord(cfg.paletas_vinculos) ? cfg.paletas_vinculos : {};
  }
  if (sections.iconos) out.iconos = cfg.iconos;
  if (sections.overrides_reusables) out.overrides_reusables = cfg.overrides_reusables;
  if (sections.scope_rules) out.scope_rules = cfg.scope_rules;
  if (cfg._unknown && mode === "replace") out._unknown = cfg._unknown;
  return out;
}

export function syncGlobalScopeRules(cfg: Record<string, unknown>, sections: SeccionesJson): Record<string, unknown> {
  // Copia: `cfg.scope_rules` puede ser el mismo objeto que el de la config actual (reemplazo por `...actual`).
  const scopeRules: Record<string, unknown> = isRecord(cfg.scope_rules) ? { ...cfg.scope_rules } : {};
  const global: Record<string, unknown> = isRecord(scopeRules.global) ? { ...scopeRules.global } : {};
  if (sections.presets) global.presets = cfg.presets;
  if (sections.paletas) global.paletas = cfg.paletas;
  if (sections.overrides_reusables) global.overrides_reusables = cfg.overrides_reusables;
  // `.graficos_delivery_options()` lee `scope_rules.global` antes que la raíz (configSnapshot.ts): si unas reglas
  // importadas traen otro valor, le ganarían al interruptor sin avisar. La raíz manda siempre.
  if (typeof cfg.auto_otros_slides === "boolean") global.auto_otros_slides = cfg.auto_otros_slides;
  scopeRules.global = global;
  cfg.scope_rules = scopeRules;
  return cfg;
}

/** El archivo que se descarga: sobre `graficos/4` con las secciones elegidas y su lista en `export_scope`. */
export function armarExportacionJson(
  cfg: Record<string, unknown>,
  secciones: SeccionesJson,
  ahora: Date,
  opciones: { estiloClienteDefaults?: EstiloCliente | null } = {},
): { texto: string; nombreArchivo: string } {
  const elegidas = seccionesElegidas(secciones);
  const payload = {
    version: "graficos/4",
    exported_at: ahora.toISOString(),
    export_scope: elegidas.map((s) => s.id),
    config: pickGraficosConfigSections(cfg, secciones, "replace", opciones),
  };
  const alcance = elegidas.length === GRAFICOS_JSON_SECTIONS.length ? "completo" : "parcial";
  return { texto: JSON.stringify(payload, null, 2), nombreArchivo: `pulso_graficos_${alcance}_${ahora.getTime()}.json` };
}

// --- Importar ---------------------------------------------------------------------------------------------------------

/**
 * Secciones que el archivo declara traer (`export_scope` del sobre, que el normalizador guarda en
 * `_unknown.__bundle`). `null` si el archivo no lo declara (editado a mano o anterior al sobre): entonces se confía en
 * lo que traiga, salvo en las tres secciones nuevas, que el normalizador rellena con su default y sólo cuentan si traen
 * algo propio — si no, un archivo viejo apagaría «Otros» o borraría el estilo del cliente sin haberlos mencionado.
 */
function seccionesDelArchivo(entrante: Record<string, unknown>): Set<string> | null {
  const unknown = isRecord(entrante._unknown) ? entrante._unknown : {};
  const bundle = isRecord(unknown.__bundle) ? unknown.__bundle : {};
  if (!Array.isArray(bundle.export_scope)) return null;
  return new Set(bundle.export_scope.filter((x): x is string => typeof x === "string" && IDS_SECCIONES.has(x)));
}

function traeSeccion(entrante: Record<string, unknown>, id: GraficosJsonSectionId, declaradas: Set<string> | null): boolean {
  if (declaradas) return declaradas.has(id);
  if (id === "auto_otros_slides") return entrante.auto_otros_slides === true;
  if (id === "estilo_cliente") return Object.keys(estiloClienteDecisiones(entrante.estilo_cliente)).length > 0;
  if (id === "documento_word") return isRecord(entrante.documento_word) && Object.keys(entrante.documento_word).length > 0;
  return true;
}

export type ResumenImportacion = {
  /** Lo elegido que de verdad se escribe. */
  efectivas: SeccionesJson;
  /** Elegidas que el archivo no trae: quedan como están. */
  ausentes: SeccionJson[];
  /** Logos del archivo que no se aplican porque su PNG no está en el proyecto. */
  logosDescartados: LogoDescartado[];
};

/**
 * Qué hará la importación, sin escribir: la usan la composición y la confirmación, así que el aviso dice exactamente lo
 * que se descarta. `existentes` son los `file_id` de logo presentes en el proyecto; por defecto, los que usa `actual`.
 */
export function resumenImportacion(
  actual: Record<string, unknown>,
  entrante: Record<string, unknown>,
  secciones: SeccionesJson,
  existentes: ReadonlySet<string> = fileIdsDeLogos(actual.estilo_cliente),
): ResumenImportacion {
  const declaradas = seccionesDelArchivo(entrante);
  const efectivas = todasLasSecciones(false);
  const ausentes: SeccionJson[] = [];
  for (const s of seccionesElegidas(secciones)) {
    if (traeSeccion(entrante, s.id, declaradas)) efectivas[s.id] = true;
    else ausentes.push(s);
  }
  const logosDescartados = efectivas.estilo_cliente ? logosSinArchivo(entrante.estilo_cliente, existentes) : [];
  return { efectivas, ausentes, logosDescartados };
}

/**
 * Lo que se envía al importar: las secciones elegidas del archivo, combinadas con lo actual (`merge`) o en su lugar
 * (`replace`), con las reglas globales sincronizadas. `actual` y `entrante` ya pasaron por `normalizeGraficosConfig`.
 * Las claves opacas del proyecto (decisión 30) y su `_unknown` no se tocan: no son una sección que se haya elegido.
 */
export function componerImportacion(
  actual: Record<string, unknown>,
  entrante: Record<string, unknown>,
  secciones: SeccionesJson,
  modo: ModoImportacionJson,
  existentes?: ReadonlySet<string>,
): Record<string, unknown> {
  const resumen = resumenImportacion(actual, entrante, secciones, existentes);
  const elegido = pickGraficosConfigSections(entrante, resumen.efectivas, modo);
  delete elegido._unknown;
  if (resumen.efectivas.estilo_cliente) {
    const estilo = sinLogos(elegido.estilo_cliente as EstiloCliente, resumen.logosDescartados);
    // El ámbito es del proyecto que importa, no del archivo: se conserva el actual.
    const ambito = normalizeEstiloCliente(actual.estilo_cliente).ambito;
    elegido.estilo_cliente = ambito ? { ...estilo, ambito } : estilo;
  }
  const siguiente = modo === "replace" ? { ...actual, ...elegido } : deepMerge(actual, elegido);
  return syncGlobalScopeRules(siguiente, resumen.efectivas);
}

export function rotuloSeccionesImportadas(n: number): string {
  return `${n} ${n === 1 ? "sección importada" : "secciones importadas"}`;
}
