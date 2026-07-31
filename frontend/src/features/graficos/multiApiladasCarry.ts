// Acarreo de la selección entre intenciones del constructor de
// multi-apiladas.
//
// Medido en la app antes de esta unidad: elegir dos preguntas, pasar a
// "Combinar bloques" y volver dejaba "Ninguna pregunta seleccionada", y
// cuatro Cmd+Z no las recuperaban (el historial guarda el cambio de modo,
// no las variables). En un panel que invita a probar lecturas, explorar
// no puede costar el trabajo hecho.
//
// La regla: las preguntas son del analista, no del modo. Se acarrean
// mirando primero los campos del modo actual y, si están vacíos, el primer
// bloque de `multilista` — que es donde quedan al pasar por Combinar.

type Args = Record<string, unknown>;

function stringArray(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Refs de `vars`, aplanando la forma {tema: [refs]} de comparar públicos. */
function varsOf(args: Args): string[] {
  const vars = args.vars;
  if (Array.isArray(vars) || typeof vars === "string") return stringArray(vars);
  if (vars && typeof vars === "object") {
    return Object.values(vars as Record<string, unknown>).flatMap(stringArray);
  }
  return [];
}

function firstBlock(args: Args): Args | null {
  const bloques = args.bloques;
  if (!Array.isArray(bloques)) return null;
  const hit = bloques.find((b) => b && typeof b === "object" && !Array.isArray(b));
  return (hit as Args) ?? null;
}

/** Preguntas que sobreviven a un cambio de intención. */
export function carryVars(args: Args): string[] {
  const direct = varsOf(args);
  if (direct.length) return direct;
  const single = typeof args.var === "string" && args.var ? [args.var] : [];
  if (single.length) return single;
  const block = firstBlock(args);
  if (!block) return [];
  const fromBlock = varsOf(block);
  if (fromBlock.length) return fromBlock;
  return typeof block.var === "string" && block.var ? [block.var] : [];
}

/** Variable de cruce que sobrevive a un cambio de intención. */
export function carryCruce(args: Args): string {
  if (typeof args.cruces === "string" && args.cruces) return args.cruces;
  const block = firstBlock(args);
  if (block && typeof block.cruces === "string" && block.cruces) return block.cruces;
  return "";
}

/**
 * Bloque inicial de `multilista` sembrado con la lectura actual, para que
 * pasar a "Combinar bloques" conserve lo elegido en vez de empezar vacío.
 */
export function blockFromArgs(args: Args, vars: string[], cruce: string): Args {
  const modo = typeof args.modo === "string" ? args.modo : "var";
  if (modo === "cruce") {
    return { modo: "cruce", var: vars[0] ?? "", cruces: cruce };
  }
  if (modo === "var_cruce" && cruce) {
    return { modo: "var_cruce", vars, cruces: cruce };
  }
  return { modo: "var", vars };
}
