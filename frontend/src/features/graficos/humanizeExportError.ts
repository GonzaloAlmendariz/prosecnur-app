import type { GraficadorRef, PlanJson } from "../../api/graficos";
import { ACCION_RECARGAR_BORRADOR, CODIGO_BORRADOR_STALE, MENSAJE_CONFLICTO_BORRADOR } from "./conflictoBorrador";
import { nombreTipoLamina, rotuloLamina } from "./rotuloLamina";

// Interpreta errores crudos de R/prosecnur al exportar PPT/Word y los
// traduce a mensajes accionables. Si ningún patrón matchea, devuelve
// el error original envuelto en algo legible.
//
// Mantenemos la humanización en frontend (no en backend) para que los
// patrones sean fácil de iterar y se puedan cruzar con el plan actual
// (ej. inferir qué lámina / espacio causó el error). Los textos nombran la
// lámina con `rotuloLamina` («Lámina 3 · “título”»), como el backend; el id
// viaja aparte en `slideRef.id`.
//
// Patrones cubiertos (80% de errores típicos):
//   - 'argument "var" is missing, with no default' → slot sin variable
//   - "object 'xxx' not found" (o `object '...' not found`) → variable
//     renombrada o borrada del instrumento
//   - "non-numeric argument to binary operator" → variable no numérica
//     usada en graficador que espera números (media, boxplot, etc.)
//   - "Graficador no registrado: xxx" → paquete prosecnur desactualizado
//   - E_GRAFICOS_CONSOLIDADO_DRAFT_STALE → otra pestaña o persona guardó el informe compartido (A7 H3)

export type HumanizedError = {
  message: string;
  hint?: string;
  slideRef?: { id: string; label: string };
  /** El error tal como llegó del motor, para copiar o mandar a soporte; nunca es el texto principal. */
  detalle?: string;
};

export function humanizeGraficosExportError(raw: string, plan: PlanJson): HumanizedError {
  // Quitar el prefijo legado "[E_CODE] " y el sufijo canónico " · E_CODE" del client.
  const detalle = raw.replace(/^\[[A-Z_]+\]\s*/, "").replace(/\s*·\s*(?:E_|HTTP_)[A-Z0-9_]+\s*$/, "").trim();
  // El código se mira en el crudo, antes de quitarle el sufijo: es la única marca segura del 409 de revisión vieja.
  if (raw.includes(CODIGO_BORRADOR_STALE) || raw.includes(MENSAJE_CONFLICTO_BORRADOR)) {
    return {
      message: MENSAJE_CONFLICTO_BORRADOR,
      hint: `Usa «${ACCION_RECARGAR_BORRADOR}» en el aviso y vuelve a exportar.`,
      ...(detalle ? { detalle } : {}),
    };
  }
  return { ...humanizar(sinEnvolturaCallr(detalle), plan), ...(detalle ? { detalle } : {}) };
}

/**
 * El worker `callr` envuelve el error real: «! in callr subprocess. Caused by error: ! Base 'x': …». Para reconocerlo
 * hay que quedarse con la causa, sin los «!» de rlang.
 */
export function sinEnvolturaCallr(msg: string): string {
  const causa = /Caused by error[^:]*:\s*([\s\S]*)$/i.exec(msg);
  const texto = causa ? causa[1] : msg;
  return texto.replace(/^\s*!\s*/gm, "").replace(/\s+/g, " ").trim();
}

function humanizar(msg: string, plan: PlanJson): HumanizedError {
  // 0) Preguntas agrupadas por tema sin nombre de grupo ---------------------
  // «Base 'estudiantes': modo='var_cruce': cuando `vars` es lista, debe ser una lista nombrada.» (también el radar en
  // modo `box`): el gráfico compara grupos de preguntas y alguno quedó sin su tema.
  const gruposSinNombre = /(?:Base ['"`]([^'"`]+)['"`]:\s*)?(?:[\w.]+\()?modo\s*=\s*['"`]?(\w+)['"`]?\)?:\s*cuando `?vars`? es lista, debe ser una lista nombrada/i.exec(msg);
  if (gruposSinNombre) {
    const base = gruposSinNombre[1] ? ` de la base «${gruposSinNombre[1]}»` : "";
    const culprit = findSlideWithUnnamedGroups(plan, gruposSinNombre[2]);
    const donde = culprit ? `${culprit.slideLabel}: un gráfico` : "Un gráfico";
    return {
      message: `${donde}${base} compara grupos de preguntas, pero los grupos quedaron sin el nombre de su tema.`,
      hint: "Abre el gráfico y vuelve a armar los grupos de preguntas, poniéndole un tema a cada uno.",
      slideRef: culprit ? { id: culprit.slideId, label: culprit.slideLabel } : undefined,
    };
  }

  // 1) argument "xxx" is missing ----------------------------------------
  const missingMatch = /argument "(\w+)" is missing, with no default/.exec(msg);
  if (missingMatch) {
    const argName = missingMatch[1];
    // Buscar el primer slide que tiene algún slot con un graficador
    // que referencia este arg (ej. `var` missing → primer graficador
    // donde args.var es undefined/"").
    const culprit = findSlideWithMissingArg(plan, argName);
    if (culprit) {
      return {
        message: `${culprit.slideLabel}: un gráfico quedó sin variable.`,
        hint: "Abre la lámina, selecciona el espacio del gráfico y elige una variable.",
        slideRef: { id: culprit.slideId, label: culprit.slideLabel },
      };
    }
    return {
      message: "Algún gráfico del informe quedó sin variable.",
      hint: "Revisa los espacios de gráfico de cada lámina: probablemente alguno quedó sin variable asignada.",
    };
  }

  // 2) object 'xxx' not found --------------------------------------------
  const notFoundMatch = /object ['"`](\w+)['"`] not found/.exec(msg);
  if (notFoundMatch) {
    const objName = notFoundMatch[1];
    const culprit = findSlideWithVariable(plan, objName);
    const where = culprit ? ` (usada en ${culprit.slideLabel})` : "";
    return {
      message: `La variable «${objName}» no existe en los datos cargados${where}.`,
      hint: "Puede que la hayas renombrado en la carga o que se llame distinto en el formulario. Cámbiala en el gráfico afectado.",
      slideRef: culprit ? { id: culprit.slideId, label: culprit.slideLabel } : undefined,
    };
  }

  // 3) non-numeric argument to binary operator --------------------------
  if (/non-numeric argument to binary operator/.test(msg)) {
    return {
      message: "Un gráfico que necesita números (media, rango, diagrama de caja) usa una variable que no es numérica.",
      hint: "Revisa los gráficos numéricos del informe: la variable tiene que ser un número entero o decimal.",
    };
  }

  // 4) Graficador desconocido -------------------------------------------
  const unknownGrafMatch = /Graficador no registrado:\s*(\S+)/.exec(msg);
  if (unknownGrafMatch) {
    return {
      message: "El informe usa un tipo de gráfico que esta versión de Prosecnur no reconoce.",
      hint: "Probablemente importaste un plan de una versión más nueva. Actualiza la aplicación o quita ese gráfico del informe.",
    };
  }

  // 5) needs at least N rows / zero-length / empty data ------------------
  if (/zero-length|needs at least|no cases in data|empty/i.test(msg)) {
    return {
      message: "Un gráfico quedó sin datos después de aplicar los filtros.",
      hint: "Revisa los filtros o el cruce del gráfico: probablemente dejan un subconjunto vacío.",
    };
  }

  // 6) Iconos de slides de población ------------------------------------
  const iconMissingMatch = /Icono no encontrado:\s*['"`]?([^'"`.]+)['"`]?/i.exec(msg);
  if (iconMissingMatch) {
    return {
      message: "Un ícono del informe ya no está disponible en el catálogo.",
      hint: "Vuelve a elegir un ícono en Configuración global → Íconos, o deja el campo en (ninguno) para exportar sin ícono.",
    };
  }

  // El backend nombra la lámina por su tipo visible: «La lámina «Objetivo con ícono» requiere un ícono.»
  // (router_graficos.R). Se acepta también la forma vieja «La slide 'p_slide_…' requiere un icono».
  const iconRequiredMatch = /La (?:lámina|slide) [«'"`]([^»'"`]+)[»'"`] requiere un [ií]cono/i.exec(msg);
  if (iconRequiredMatch) {
    return {
      message: `Una lámina «${labelForSlideType(iconRequiredMatch[1])}» necesita un ícono.`,
      hint: "Selecciona un PNG en Configuración global → Íconos. En las láminas de población puedes dejarlo en (ninguno), pero esta plantilla lo requiere.",
    };
  }

  if (/icono['"`]?\s+debe ser.*ppt_element|['"`]icono['"`]\s+debe ser.*ppt_element/i.test(msg)) {
    return {
      message: "Una lámina tiene un ícono vacío o inválido.",
      hint: "Deja el campo en (ninguno) para exportar sin ícono, o selecciona un PNG subido en Configuración global → Íconos.",
    };
  }

  // 7) cannot open file / file not found (casi siempre iconos) ----------
  if (/cannot open file|No such file or directory/.test(msg)) {
    return {
      message: "Un archivo referenciado por el plan no se pudo abrir.",
      hint: "Si usas láminas de población con íconos, verifica que los PNG estén subidos en Configuración global → Íconos.",
    };
  }

  // Fallback: nunca el error crudo como texto principal; va en `detalle` ----
  return {
    message: "No se pudo generar el informe. Revisa la lámina indicada o vuelve a intentarlo; el detalle quedó en el registro.",
    hint: "Si se repite, copia el detalle técnico y envíalo a soporte.",
  };
}

function findSlideWithUnnamedGroups(plan: PlanJson, modo: string):
  | { slideId: string; slideLabel: string }
  | null {
  for (const [indice, slide] of plan.slides.entries()) {
    for (const v of Object.values(slide.payload as Record<string, unknown>)) {
      if (isGraficadorRef(v) && v.args?.modo === modo && Array.isArray(v.args?.vars)) {
        return { slideId: slide.id, slideLabel: rotuloLamina(slide, indice) };
      }
    }
  }
  return null;
}

function findSlideWithMissingArg(plan: PlanJson, argName: string):
  | { slideId: string; slideLabel: string; graficador: string }
  | null {
  for (const [indice, slide] of plan.slides.entries()) {
    const payload = slide.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      const v = payload[key];
      if (isGraficadorRef(v)) {
        const args = v.args ?? {};
        const argVal = args[argName];
        if (argVal === undefined || argVal === null || argVal === "") {
          return {
            slideId: slide.id,
            slideLabel: rotuloLamina(slide, indice),
            graficador: v.graficador,
          };
        }
      }
    }
  }
  return null;
}

function findSlideWithVariable(plan: PlanJson, varName: string):
  | { slideId: string; slideLabel: string }
  | null {
  for (const [indice, slide] of plan.slides.entries()) {
    const payload = slide.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      const v = payload[key];
      if (isGraficadorRef(v) && referencesVariable(v, varName)) {
        return { slideId: slide.id, slideLabel: rotuloLamina(slide, indice) };
      }
    }
  }
  return null;
}

function referencesVariable(graf: GraficadorRef, varName: string): boolean {
  const args = graf.args ?? {};
  for (const key of ["var", "cruces", "cruce"]) {
    if (args[key] === varName) return true;
  }
  const vars = args["vars"];
  if (Array.isArray(vars) && vars.includes(varName)) return true;
  return false;
}

function isGraficadorRef(v: unknown): v is GraficadorRef {
  return !!v && typeof v === "object" && "graficador" in (v as object);
}

/** El backend nuevo ya manda el nombre visible («Objetivo con ícono»); el viejo, el tipo interno `p_slide_*`. */
function labelForSlideType(tipo: string): string {
  return /^p_slide_/.test(tipo) ? nombreTipoLamina(tipo) : tipo;
}
