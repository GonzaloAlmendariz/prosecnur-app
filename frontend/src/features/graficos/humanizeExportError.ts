import { GraficadorRef, PlanJson, Slide } from "../../api/client";
import { SLIDE_LABELS } from "./store";

// Interpreta errores crudos de R/prosecnur al exportar PPT/Word y los
// traduce a mensajes accionables. Si ningún patrón matchea, devuelve
// el error original envuelto en algo legible.
//
// Mantenemos la humanización en frontend (no en backend) para que los
// patrones sean fácil de iterar y se puedan cruzar con el plan actual
// (ej. inferir qué slide / slot causó el error).
//
// Patrones cubiertos (80% de errores típicos):
//   - 'argument "var" is missing, with no default' → slot sin variable
//   - "object 'xxx' not found" (o `object '...' not found`) → variable
//     renombrada o borrada del instrumento
//   - "non-numeric argument to binary operator" → variable no numérica
//     usada en graficador que espera números (media, boxplot, etc.)
//   - "Graficador no registrado: xxx" → paquete prosecnur desactualizado

export type HumanizedError = {
  message: string;
  hint?: string;
  slideRef?: { id: string; label: string };
};

export function humanizeGraficosExportError(raw: string, plan: PlanJson): HumanizedError {
  // Quitar el prefijo "[E_CODE] " si viene envuelto por el handle() del client.
  const msg = raw.replace(/^\[[A-Z_]+\]\s*/, "");

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
        message: `El gráfico "${culprit.graficador}" del slide "${culprit.slideLabel}" no tiene "${argName}" configurado.`,
        hint: `Abre el slide, selecciona el slot y elige una variable para "${argName}".`,
        slideRef: { id: culprit.slideId, label: culprit.slideLabel },
      };
    }
    return {
      message: `Falta el argumento "${argName}" en algún gráfico del plan.`,
      hint: "Revisa los slots de cada slide: probablemente alguno quedó sin variable asignada.",
    };
  }

  // 2) object 'xxx' not found --------------------------------------------
  const notFoundMatch = /object ['"`](\w+)['"`] not found/.exec(msg);
  if (notFoundMatch) {
    const objName = notFoundMatch[1];
    const culprit = findSlideWithVariable(plan, objName);
    const where = culprit ? ` (usada en "${culprit.slideLabel}")` : "";
    return {
      message: `La variable "${objName}" no existe en los datos cargados${where}.`,
      hint: "Puede ser que la renombraste en la Fase 1 o que se llama distinto en el XLSForm. Cámbiala en el slot afectado.",
      slideRef: culprit ? { id: culprit.slideId, label: culprit.slideLabel } : undefined,
    };
  }

  // 3) non-numeric argument to binary operator --------------------------
  if (/non-numeric argument to binary operator/.test(msg)) {
    return {
      message: "Estás usando una variable no numérica en un graficador que requiere números (media, rango, boxplot).",
      hint: "Revisa los graficadores `p_numerico`, `p_boxplot`, `p_media_rango`: la variable tiene que ser integer o decimal.",
    };
  }

  // 4) Graficador desconocido -------------------------------------------
  const unknownGrafMatch = /Graficador no registrado:\s*(\S+)/.exec(msg);
  if (unknownGrafMatch) {
    return {
      message: `El graficador "${unknownGrafMatch[1]}" no existe en tu versión de prosecnur.`,
      hint: "Probablemente importaste un plan de una versión más nueva. Actualiza el paquete o elimina ese graficador del plan.",
    };
  }

  // 5) needs at least N rows / zero-length / empty data ------------------
  if (/zero-length|needs at least|no cases in data|empty/i.test(msg)) {
    return {
      message: "Un gráfico quedó sin datos después de aplicar los filtros.",
      hint: "Revisa los filtros del graficador o el cruce — probablemente estás restringiendo a un subconjunto vacío.",
    };
  }

  // 6) cannot open file / file not found (casi siempre iconos) ----------
  if (/cannot open file|No such file or directory/.test(msg)) {
    return {
      message: "Un archivo referenciado por el plan no se pudo abrir.",
      hint: "Si usas slides de población con íconos, verifica que los PNGs estén subidos en Configuración global → Iconos.",
    };
  }

  // Fallback: mostrar el mensaje sin prefijo de código ------------------
  return {
    message: msg,
    hint: "Si el mensaje no es claro, revisa la consola del servidor para ver el stacktrace completo.",
  };
}

function findSlideWithMissingArg(plan: PlanJson, argName: string):
  | { slideId: string; slideLabel: string; graficador: string }
  | null {
  for (const slide of plan.slides) {
    const payload = slide.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      const v = payload[key];
      if (isGraficadorRef(v)) {
        const args = v.args ?? {};
        const argVal = args[argName];
        if (argVal === undefined || argVal === null || argVal === "") {
          return {
            slideId: slide.id,
            slideLabel: labelForSlide(slide),
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
  for (const slide of plan.slides) {
    const payload = slide.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      const v = payload[key];
      if (isGraficadorRef(v) && referencesVariable(v, varName)) {
        return { slideId: slide.id, slideLabel: labelForSlide(slide) };
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

function labelForSlide(slide: Slide): string {
  const title = typeof slide.payload?.titulo === "string" ? (slide.payload.titulo as string) : "";
  const tipo = SLIDE_LABELS[slide.tipo] ?? slide.tipo;
  if (title) return `${tipo} — ${title}`;
  return tipo;
}
