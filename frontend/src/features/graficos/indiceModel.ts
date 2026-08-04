// =============================================================================
// indiceModel.ts — modelo estructurado del slide de Índice (B47/G-5)
// =============================================================================
// El motor (`p_slide_indice`) habla en 4 campos de texto plano: `secciones`
// (una por línea), `subtemas` (uno por línea), `subindices` ("Sección: subtema"
// por línea) e `iconos_focos` (nombres internos en orden). El builder edita
// una estructura jerárquica y este módulo traduce en ambos sentidos SIN
// cambiar el contrato del motor: el payload sigue siendo el mismo.

export type IndiceSeccion = {
  titulo: string;
  /** Nombre interno del ícono del foco (catálogo de ppt_assets/indice_icons). */
  icono: string | null;
  subtemas: string[];
};

export type IndiceModel = {
  secciones: IndiceSeccion[];
};

/** La plantilla PPT trae 5 focos: las secciones extra no llevan ícono. */
export const MAX_FOCOS = 5;

/** Catálogo de íconos elegibles — espejo de api/inst/ppt_assets/indice_icons.
 *  `lucide` es solo el preview en la UI; el motor recibe `name`. */
export const INDICE_ICONOS: Array<{ name: string; label: string; lucide: string }> = [
  { name: "target-arrow", label: "Objetivo", lucide: "Target" },
  { name: "clipboard-list", label: "Metodología", lucide: "ClipboardList" },
  { name: "circle-user-round", label: "Perfil", lucide: "CircleUserRound" },
  { name: "chart-column", label: "Resultados", lucide: "BarChart3" },
  { name: "artificial-intelligence", label: "Inteligencia artificial", lucide: "Sparkles" },
  { name: "lightbulb", label: "Hallazgos", lucide: "Lightbulb" },
  { name: "bullseye", label: "Metas", lucide: "Crosshair" },
  { name: "bar-chart-line-fill", label: "Indicadores", lucide: "BarChart" },
  { name: "clipboard-data-fill", label: "Datos", lucide: "ClipboardCheck" },
  { name: "person-vcard-fill", label: "Actores", lucide: "Contact" },
];

/** Íconos que el motor usa cuando nadie elige (orden fijo de los 5 focos). */
export const INDICE_ICONOS_DEFAULT = [
  "target-arrow",
  "clipboard-list",
  "circle-user-round",
  "chart-column",
  "artificial-intelligence",
];

function lineas(value: unknown): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value.map((v) => String(v ?? "")) : String(value).split(/\r?\n/);
  return raw.map((l) => l.trim()).filter((l) => l.length > 0);
}

/** Parsea el payload plano del slide al modelo jerárquico. Tolerante: líneas
 *  de subíndice sin "Sección:" reconocible cuelgan de la última sección. */
export function parseIndicePayload(payload: Record<string, unknown> | null | undefined): IndiceModel {
  const p = payload ?? {};
  const secciones = lineas(p.secciones);
  const iconos = lineas(p.iconos_focos);
  const subindices = lineas(p.subindices);
  const subtemasSueltos = lineas(p.subtemas);

  const model: IndiceModel = {
    secciones: secciones.map((titulo, i) => ({
      titulo,
      icono: iconos[i] ?? null,
      subtemas: [],
    })),
  };

  const porTitulo = new Map<string, IndiceSeccion>();
  model.secciones.forEach((s) => porTitulo.set(s.titulo.toLowerCase(), s));

  const asignados = new Set<string>();
  for (const linea of subindices) {
    const idx = linea.indexOf(":");
    const seccion = idx > 0 ? linea.slice(0, idx).trim().toLowerCase() : "";
    const subtema = idx > 0 ? linea.slice(idx + 1).trim() : linea;
    const target = porTitulo.get(seccion) ?? model.secciones[model.secciones.length - 1];
    if (target && subtema) {
      target.subtemas.push(subtema);
      asignados.add(subtema.toLowerCase());
    }
  }

  // Subtemas sueltos (sin subíndice que los asocie): cuelgan de la última
  // sección, igual que hace el motor.
  const ultima = model.secciones[model.secciones.length - 1];
  if (ultima) {
    for (const st of subtemasSueltos) {
      if (!asignados.has(st.toLowerCase())) ultima.subtemas.push(st);
    }
  }

  return model;
}

/** Serializa el modelo al payload plano que el motor entiende. */
export function serializeIndiceModel(model: IndiceModel): {
  secciones: string;
  subtemas: string;
  subindices: string;
  iconos_focos: string;
} {
  const secciones = model.secciones.filter((s) => s.titulo.trim().length > 0);
  const subLineas: string[] = [];
  const subtemasFlat: string[] = [];
  for (const s of secciones) {
    for (const st of s.subtemas) {
      const limpio = st.trim();
      if (!limpio) continue;
      subLineas.push(`${s.titulo.trim()}: ${limpio}`);
      subtemasFlat.push(limpio);
    }
  }

  // Íconos: en orden de sección, hasta MAX_FOCOS. Los huecos usan el default
  // de su posición para que el motor no corra el mapeo.
  const iconos: string[] = [];
  const conIcono = secciones.slice(0, MAX_FOCOS);
  const algunoElegido = conIcono.some((s) => s.icono && s.icono.trim().length > 0);
  if (algunoElegido) {
    conIcono.forEach((s, i) => {
      iconos.push((s.icono && s.icono.trim()) || INDICE_ICONOS_DEFAULT[i] || INDICE_ICONOS_DEFAULT[0]);
    });
  }

  return {
    secciones: secciones.map((s) => s.titulo.trim()).join("\n"),
    subtemas: subtemasFlat.join("\n"),
    subindices: subLineas.join("\n"),
    iconos_focos: iconos.join("\n"),
  };
}

/** Movimiento de secciones (subir/bajar) sin mutar el modelo original. */
export function moverSeccion(model: IndiceModel, index: number, delta: -1 | 1): IndiceModel {
  const destino = index + delta;
  if (index < 0 || index >= model.secciones.length) return model;
  if (destino < 0 || destino >= model.secciones.length) return model;
  const secciones = [...model.secciones];
  const [s] = secciones.splice(index, 1);
  secciones.splice(destino, 0, s);
  return { secciones };
}
