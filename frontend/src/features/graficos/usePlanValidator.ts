import { useMemo } from "react";
import type { ArgMetadata, GraficadorMetadata, GraficadorRef, PresetMetadata, Slide, SlideMetadata } from "../../api/graficos";
import { usePlanStore, PaletaPorLista } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { usePresetsMetadata } from "./usePresetsMetadata";
import { useVariables, type VarWithSource } from "./useVariables";
import { evaluateScaleCompat, multiApiladasScaleGroups, type ScaleVar } from "./multiApiladasScale";
import { formatNumericRange, hasMeaningfulValue, validateNumericArgValue } from "./numericArgValidation";
import { isDerivedReportVariableRef } from "./derivedReportVariables";
import { nombreTipoLamina, rotuloLamina, tituloDeLamina } from "./rotuloLamina";
import { tituloQueSale } from "./laminas/tituloQueSale";
import { citaCorta, notasEnTitulo } from "./laminas/notaEnTitulo";
import { indicesSinCapitulos } from "./indice/requisitoIndice";
import { twoBoxDeGrafico } from "./laminas/modeloMaqueta";
import { conteoBarrasMultiapiladas, excedeTope, laminasNecesarias, MAX_BARRAS_MULTIAPILADAS } from "./multiapiladas/topeBarras";

// Validador del plan 100% client-side: deriva warnings/errores de lo
// que ya vive en el store + registry + variables del instrumento. Sin
// roundtrip al backend, el analista ve el estado del plan en tiempo real
// a medida que edita.
//
// Tipos de warning que detecta:
//   - "slot-empty": slide con slot sin graficador.
//   - "var-unknown": un graficador referencia una variable que no está
//     en el instrumento (probablemente borraste/renombraste la pregunta).
//   - "var-sin-base": con varias bases, la referencia no dice de cuál es.
//     Es ERROR porque el motor no puede resolverla: el preview y el export
//     abortan con "La referencia de `var` requiere prefijo `fuente$`". Pasa
//     solo con planes que nacieron cuando el estudio tenía una sola base y
//     siguieron vivos después de sumar las demás; hasta que se distinguió
//     este caso, el plan decía que la variable no existía ("¿la renombraste
//     o borraste?") mientras el selector mostraba a su lado la base real.
//   - "icon-unknown": un slide de población referencia un ícono que ya
//     no está en el catálogo (alguien lo borró).
//   - "paleta-monocromatica": una paleta tiene muchos colores con hue
//     muy parecido — dificulta distinguir categorías en un apilado.
//   - "plan-vacio": el plan no tiene slides.
//   - "titulo-vacio": lámina sin título cuyo gráfico junta varias preguntas.
//     El PowerPoint la titula con su primera pregunta, que nombra sólo uno
//     de sus temas (ADR 0064: el mazo de equivalencias la deja vacía para
//     que la Revisión la pida; hasta 2026-10-12 nadie la pedía).
//   - "scale-mismatch": un multi-apiladas apila preguntas de escalas
//     distintas. Es ERROR y no warning porque el renderer no lo salva: la
//     lámina sale degradada a "Sin datos" con el título de la primera
//     pregunta y una base que no sustenta nada. El constructor ya lo avisa
//     mientras editas; esto es lo que impide que llegue al entregable.
//   - "multiapiladas-tope": una multiapilada pasa de seis barras (Gonzalo,
//     2026-10-14). Es ERROR: el motor la parte en «(cont.)» y la lámina no se
//     ve como debe; el editor ya no deja agregar la séptima.
//
// Severidad: "error" bloquea export; "warning" solo avisa.

export type ValidationIssue = {
  severity: "error" | "warning";
  code:
    | "plan-vacio"
    | "slot-empty"
    | "var-unknown"
    | "var-sin-base"
    | "icon-unknown"
    | "paleta-monocromatica"
    | "numeric-invalid"
    | "scale-mismatch"
    | "multiapiladas-tope"
    | "titulo-vacio"
    | "titulo-con-nota"
    | "indice-sin-capitulos"
    | "ttb-sin-respuestas";
  message: string;
  slideId?: string;       // para poder saltar al slide afectado
  slotName?: string;
  listName?: string;      // para paletas
};

export type ValidationSummary = {
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  canExport: boolean;
};

export function usePlanValidator(): ValidationSummary {
  const slides = usePlanStore((s) => s.plan.slides);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const paletas = usePlanStore((s) => s.paletas);
  const iconos = usePlanStore((s) => s.iconos);
  const { slidesById, graficadoresById } = useGraficosRegistry();
  const { presetsByName } = usePresetsMetadata();
  const { variables, multi } = useVariables();

  return useMemo(
    () => validarPlan({ slides, presets, wPresets, overridesReusables, paletas, iconos, slidesById, graficadoresById, presetsByName, variables, multi }),
    [slides, presets, wPresets, overridesReusables, paletas, iconos, slidesById, graficadoresById, presetsByName, variables, multi],
  );
}

/** Lo que el validador lee del store, el registry y el instrumento. */
export type EntradaValidarPlan = {
  slides: readonly Slide[];
  presets: Record<string, Record<string, unknown>>;
  wPresets: Record<string, Record<string, unknown>>;
  overridesReusables: readonly { nombre: string; tipo_preset: string; args: Record<string, unknown> }[];
  paletas: Record<string, PaletaPorLista>;
  iconos: readonly { id: string }[];
  slidesById: Readonly<Record<string, Pick<SlideMetadata, "slots" | "titulo_humano" | "slot_specs"> | undefined>>;
  graficadoresById: Readonly<Record<string, Pick<GraficadorMetadata, "args"> | undefined>>;
  presetsByName: Readonly<Record<string, Pick<PresetMetadata, "args" | "titulo_humano"> | undefined>>;
  variables: readonly VarWithSource[];
  multi: boolean;
};

// Los textos nombran la lámina como el backend (`rotuloLamina`: «Lámina 3 · “título”») y su tipo y espacio como el
// selector; el id de la lámina viaja sólo en `slideId`, para «Ir a la lámina».
export function validarPlan(entrada: EntradaValidarPlan): ValidationSummary {
  const { slides, presets, wPresets, overridesReusables, paletas, iconos, slidesById, graficadoresById, presetsByName, variables, multi } = entrada;
  const issues: ValidationIssue[] = [];

  // 1) Plan vacío ---------------------------------------------------------
  if (slides.length === 0) {
    issues.push({
      severity: "error",
      code: "plan-vacio",
      message: "El informe no tiene láminas. Agrega al menos una para poder exportar.",
    });
  }

  // 2) Slots vacíos + variables desconocidas ------------------------------
  // `varNames` es un set de refs canónicas: si hay multi-base, incluye
  // el prefijo "docentes$sexo"; si es single-base, solo "sexo". El check
  // en `checkVarRefs` normaliza la ref del graficador contra este set.
  const varNames = new Set(
    variables.flatMap((v) => multi ? [`${v.source}$${v.name}`] : [v.name, `${v.source}$${v.name}`]),
  );
  const iconIds = new Set(iconos.map((i) => i.id));
  // Mismo criterio de resolución que `varNames`: en single-base la ref
  // puede venir con o sin prefijo de fuente.
  const varsByRef = new Map<string, VarWithSource>();
  for (const v of variables) {
    varsByRef.set(`${v.source}$${v.name}`, v);
    if (!multi && !varsByRef.has(v.name)) varsByRef.set(v.name, v);
  }
  const resolveVar = (ref: string) => varsByRef.get(ref);

  // En qué bases vive cada nombre suelto. Con varias bases, una ref sin `$`
  // no es necesariamente una variable perdida: casi siempre es una que se
  // eligió cuando el estudio tenía una sola base.
  const basesPorVariable = new Map<string, string[]>();
  for (const v of variables) {
    const previas = basesPorVariable.get(v.name) ?? [];
    if (!previas.includes(v.source)) previas.push(v.source);
    basesPorVariable.set(v.name, previas);
  }
  const basesDeVariableSuelta = (ref: string) =>
    ref.includes("$") ? [] : (basesPorVariable.get(ref) ?? []);

  slides.forEach((slide, indice) => {
    const slideMeta = slidesById[slide.tipo];
    if (!slideMeta) return;
    const lamina = `${rotuloLamina(slide, indice)} (${nombreTipoLamina(slide.tipo, slideMeta.titulo_humano)})`;
    const nombreEspacio = (slot: string) =>
      slideMeta.slot_specs?.find((spec) => spec.name === slot)?.label?.trim() || humanizeSlot(slot);
    const enEspacio = (slot: string) => `${lamina}, espacio «${nombreEspacio(slot)}»`;

    // Slots de graficador vacíos
    for (const slot of slideMeta.slots) {
      if (slot === "icono") continue; // los íconos se validan aparte
      const value = (slide.payload as Record<string, unknown>)[slot];
      const graf = value as GraficadorRef | null | undefined;
      if (!graf || !graf.graficador) {
        issues.push({
          severity: "warning",
          code: "slot-empty",
          message: `${lamina}: el espacio «${nombreEspacio(slot)}» no tiene gráfico.`,
          slideId: slide.id,
          slotName: slot,
        });
      } else {
        issues.push(...checkNumericArgs(
          graf.args ?? {},
          graficadoresById[graf.graficador]?.args ?? [],
          { scope: enEspacio(slot), slideId: slide.id, slotName: slot },
        ));

        issues.push(...checkScaleCompat(graf, resolveVar, {
          scope: enEspacio(slot),
          slideId: slide.id,
          slotName: slot,
        }));

        issues.push(...checkTopeBarras(graf, {
          scope: enEspacio(slot),
          slideId: slide.id,
          slotName: slot,
        }));

        // Variable desconocida dentro del graficador. Con varias bases hay
        // que separar dos cosas que se veían igual: la que no existe y la
        // que existe pero no dice de qué base es.
        checkVarRefs(graf, varNames).forEach((varName) => {
          const aviso = avisoDeVariableNoResuelta(
            varName,
            multi ? basesDeVariableSuelta(varName) : [],
          );
          issues.push({
            severity: aviso.severity,
            code: aviso.code,
            message: `${enEspacio(slot)}: ${aviso.detalle}`,
            slideId: slide.id,
            slotName: slot,
          });
        });
      }
    }

    // Sin título y con un gráfico de varias preguntas: el PowerPoint la titularía con la primera.
    if (!tituloDeLamina(slide.payload)) {
      const temas = Math.max(0, ...slideMeta.slots.map((slot) => {
        const vars = ((slide.payload as Record<string, unknown>)[slot] as GraficadorRef | null | undefined)?.args?.vars;
        // Las láminas de equivalencias traen `vars` por tema ({ tema_1: [...], tema_2: [...] }): cada clave es un tema.
        if (Array.isArray(vars)) return vars.length;
        return vars && typeof vars === "object" ? Object.keys(vars).length : 0;
      }));
      if (temas > 1) {
        issues.push({
          severity: "warning",
          code: "titulo-vacio",
          message: `${lamina}: no tiene título. El PowerPoint la titularía con su primera pregunta, que nombra sólo uno de sus ${temas} temas; escríbele uno.`,
          slideId: slide.id,
        });
      }
    }

    // D4: el título que va a salir trae una nota entre corchetes o una etiqueta HTML. No se quita sola: se avisa con el
    // fragmento exacto y el analista decide (Gonzalo, 2026-10-13).
    {
      const sale = tituloQueSale(slide, variables, nombreTipoLamina(slide.tipo));
      const notas = notasEnTitulo(sale);
      if (notas.length) {
        const escrito = !!tituloDeLamina(slide.payload);
        issues.push({
          severity: "warning",
          code: "titulo-con-nota",
          message: `${lamina}: el título lleva «${citaCorta(notas[0])}»${notas.length > 1 ? ` y ${notas.length - 1} nota${notas.length > 2 ? "s" : ""} más` : ""}. `
            + (escrito ? "Si no debe salir en la lámina, quítala del título." : "Viene del texto de la pregunta; si no debe salir, escribe el título de la lámina."),
          slideId: slide.id,
        });
      }
    }

    // Slot `icono` si el slide lo acepta
    // El objetivo lleva siempre la diana del recetario (G5): un ícono viejo en su payload ya no se usa.
    if (slideMeta.slots.includes("icono") && slide.tipo !== "p_slide_objetivo_icono") {
      const iconRef = (slide.payload as Record<string, unknown>).icono as string | null | undefined;
      if (iconRef && !iconIds.has(iconRef)) {
        issues.push({
          severity: "warning",
          code: "icon-unknown",
          message: `${lamina}: el ícono elegido ya no está en el catálogo. Sube uno nuevo o elige otro.`,
          slideId: slide.id,
        });
      }
    }
  });

  // 3) Valores numéricos inválidos persistidos en presets, Word y modos ----
  const nombrePreset = (presetName: string) => `«${presetsByName[presetName]?.titulo_humano?.trim() || presetName}»`;
  for (const [presetName, args] of Object.entries(presets)) {
    issues.push(...checkNumericArgs(args, presetsByName[presetName]?.args ?? [], {
      scope: `Ajustes por defecto de ${nombrePreset(presetName)}`,
    }));
  }

  for (const override of overridesReusables) {
    issues.push(...checkNumericArgs(override.args, presetsByName[override.tipo_preset]?.args ?? [], {
      scope: `Estilo guardado «${override.nombre}»`,
    }));
  }

  for (const [presetName, args] of Object.entries(wordChartPresets(wPresets))) {
    issues.push(...checkNumericArgs(args, presetsByName[presetName]?.args ?? [], {
      scope: `Ajustes de Word de ${nombrePreset(presetName)}`,
    }));
  }

  // 4) Paletas monocromáticas ---------------------------------------------
  // La paleta se guarda por lista de respuestas (`lst_p31`), que es un nombre interno del formulario: el aviso la
  // nombra por la pregunta que la usa; `listName` sigue aparte para el editor de paletas.
  for (const [listName, paleta] of Object.entries(paletas)) {
    if (isMonochromaticPalette(paleta)) {
      issues.push({
        severity: "warning",
        code: "paleta-monocromatica",
        message: `${nombrePaleta(listName, variables)}: los colores son muy parecidos entre sí. En barras apiladas cuesta distinguir las categorías.`,
        listName,
      });
    }
  }

  // 4b) Top Two Box encendido sin sus respuestas: el motor omite la columna (catálogo del recetario, M2) --------------
  slides.forEach((slide, indice) => {
    for (const valor of Object.values((slide.payload ?? {}) as Record<string, unknown>)) {
      const g = valor as GraficadorRef | undefined;
      if (!g || typeof g !== "object" || typeof g.graficador !== "string") continue;
      const tb = twoBoxDeGrafico(g.graficador, (g.args ?? {}) as Record<string, unknown>, presets);
      if (!tb.ttb || !Array.isArray(tb.etiquetas) || tb.etiquetas.length) continue;
      issues.push({
        severity: "warning",
        code: "ttb-sin-respuestas",
        message: `${rotuloLamina(slide, indice)}: el Top Two Box está encendido pero sin sus respuestas; el PowerPoint sale sin la columna. Elígelas en la pestaña Gráfico.`,
        slideId: slide.id,
      });
    }
  });

  // 5) Índice sin capítulos: el motor no tiene qué listar (indice/requisitoIndice.ts) -----------------
  for (const { slideId, message } of indicesSinCapitulos(slides)) {
    issues.push({ severity: "error", code: "indice-sin-capitulos", message, slideId });
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return {
    issues,
    errors,
    warnings,
    canExport: errors.length === 0,
  };
}

// --- Helpers internos --------------------------------------------------

/** «La paleta de «Satisfacción»» (y cuántas preguntas más la comparten), por la etiqueta visible de la pregunta. */
export function nombrePaleta(listName: string, variables: readonly Pick<VarWithSource, "name" | "label" | "list_name">[]): string {
  const etiquetas: string[] = [];
  // Preguntas sin etiqueta visible: se cuentan, pero su nombre interno (`conf_p31`) nunca se muestra.
  const sinTitulo = new Set<string>();
  for (const v of variables) {
    if (v.list_name !== listName) continue;
    const etiqueta = (v.label || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!etiqueta) sinTitulo.add(v.name);
    else if (!etiquetas.includes(etiqueta)) etiquetas.push(etiqueta);
  }
  if (!etiquetas.length) {
    if (!sinTitulo.size) return "Una paleta de colores que ya no usa ninguna pregunta";
    return sinTitulo.size === 1 ? "La paleta de una pregunta sin título" : `La paleta de ${sinTitulo.size} preguntas sin título`;
  }
  const primera = etiquetas[0].length > 80 ? `${etiquetas[0].slice(0, 79).trimEnd()}…` : etiquetas[0];
  const resto = etiquetas.length - 1 + sinTitulo.size;
  return `La paleta de «${primera}»${resto ? ` (y ${resto} ${resto === 1 ? "pregunta más" : "preguntas más"})` : ""}`;
}

function humanizeSlot(slot: string): string {
  const map: Record<string, string> = {
    grafico: "Gráfico",
    izquierda: "Izquierda",
    derecha: "Derecha",
    grafico_1: "Gráfico 1",
    grafico_2: "Gráfico 2",
    superior_izquierda: "Superior izquierda",
    superior_derecha: "Superior derecha",
    inferior_izquierda: "Inferior izquierda",
    inferior_derecha: "Inferior derecha",
  };
  return map[slot] ?? slot;
}

// Inspecciona los args del graficador y devuelve nombres de variables
// que el graficador referencia pero no existen en el instrumento.
// Una referencia que no resolvió puede ser dos cosas muy distintas, y hasta
// que se separaron el analista recibía siempre la peor lectura ("¿la
// renombraste o borraste?") justo cuando la variable estaba intacta.
export function avisoDeVariableNoResuelta(
  varName: string,
  basesDondeExiste: string[],
): { severity: ValidationIssue["severity"]; code: ValidationIssue["code"]; detalle: string } {
  if (basesDondeExiste.length === 1) {
    return {
      severity: "error",
      code: "var-sin-base",
      detalle: `la pregunta «${varName}» no dice de qué base es. Está en ${listarBases(basesDondeExiste)}; vuelve a elegirla para dejarlo escrito.`,
    };
  }
  if (basesDondeExiste.length > 1) {
    return {
      severity: "error",
      code: "var-sin-base",
      detalle: `la pregunta «${varName}» existe en ${listarBases(basesDondeExiste)}. Elige de cuál es: el gráfico no puede resolverla solo.`,
    };
  }
  return {
    severity: "warning",
    code: "var-unknown",
    detalle: `la pregunta «${varName}» no está en el instrumento. ¿La renombraste o la borraste?`,
  };
}

function listarBases(bases: string[]): string {
  if (bases.length <= 1) return bases[0] ? `la base «${bases[0]}»` : "";
  const entrecomilladas = bases.map((base) => `«${base}»`);
  return `las bases ${entrecomilladas.slice(0, -1).join(", ")} y ${entrecomilladas[entrecomilladas.length - 1]}`;
}

function checkVarRefs(graf: GraficadorRef, varNames: Set<string>): string[] {
  const refs = collectVarRefs(graf.args ?? {});
  return Array.from(new Set(refs.filter((v) => (
    v.length > 0 && !isDerivedReportVariableRef(v) && !varNames.has(v)
  ))));
}

function collectVarRefs(args: Record<string, unknown>): string[] {
  const refs: string[] = [];
  for (const argName of ["var", "cruces", "cruce"]) {
    const v = args[argName];
    if (typeof v === "string" && v.length > 0) refs.push(v);
  }

  const vars = args["vars"];
  if (typeof vars === "string" && vars.length > 0) {
    refs.push(vars);
  } else if (Array.isArray(vars)) {
    for (const v of vars) if (typeof v === "string" && v.length > 0) refs.push(v);
  } else if (vars && typeof vars === "object") {
    for (const value of Object.values(vars as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const v of value) if (typeof v === "string" && v.length > 0) refs.push(v);
      } else if (typeof value === "string" && value.length > 0) {
        refs.push(value);
      }
    }
  }

  const blocks = args["bloques"];
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      if (block && typeof block === "object" && !Array.isArray(block)) {
        refs.push(...collectVarRefs(block as Record<string, unknown>));
      }
    }
  }

  return refs;
}

// Solo multi-apiladas concilia escalas entre preguntas; el resto de
// graficadores apila una sola variable o no apila.
const SCALE_SENSITIVE_GRAFICADORES = new Set(["p_barras_multiapiladas"]);

function checkScaleCompat(
  graf: GraficadorRef,
  resolve: (ref: string) => ScaleVar | undefined,
  context: { scope: string; slideId?: string; slotName?: string },
): ValidationIssue[] {
  if (!SCALE_SENSITIVE_GRAFICADORES.has(graf.graficador)) return [];
  const groups = multiApiladasScaleGroups(graf.args ?? {});
  const issues: ValidationIssue[] = [];
  for (const refs of groups) {
    const verdict = evaluateScaleCompat(refs, resolve);
    if (verdict.tone !== "error") continue;
    issues.push({
      severity: "error",
      code: "scale-mismatch",
      message: `${context.scope}: ${enMinuscula(verdict.message)}`,
      slideId: context.slideId,
      slotName: context.slotName,
    });
  }
  return issues;
}

/** Una multiapilada lleva hasta seis barras; lo que el editor no puede contar (grupos) lo avisa el motor. */
function checkTopeBarras(
  graf: GraficadorRef,
  context: { scope: string; slideId?: string; slotName?: string },
): ValidationIssue[] {
  if (graf.graficador !== "p_barras_multiapiladas") return [];
  const conteo = conteoBarrasMultiapiladas(graf.args ?? {});
  if (!excedeTope(conteo)) return [];
  const laminas = laminasNecesarias(conteo.barras);
  const cuantas = conteo.exacto ? `${conteo.barras}` : `al menos ${conteo.barras}`;
  return [{
    severity: "error",
    code: "multiapiladas-tope",
    message: `${context.scope}: tiene ${cuantas} barras y una multiapilada lleva hasta ${MAX_BARRAS_MULTIAPILADAS}. `
      + `Divídela en ${laminas === 2 ? "dos" : laminas === 3 ? "tres" : laminas} láminas.`,
    slideId: context.slideId,
    slotName: context.slotName,
  }];
}

/** «Estas preguntas…» → «estas preguntas…», para ir detrás de «Lámina 3 · …: ». */
function enMinuscula(texto: string): string {
  return texto ? texto.charAt(0).toLocaleLowerCase("es") + texto.slice(1) : texto;
}

function checkNumericArgs(
  args: Record<string, unknown>,
  metas: ArgMetadata[],
  context: { scope: string; slideId?: string; slotName?: string },
): ValidationIssue[] {
  const byName = new Map(metas.map((meta) => [meta.name, meta]));
  const issues: ValidationIssue[] = [];

  for (const [argName, value] of Object.entries(args)) {
    if (!hasMeaningfulValue(value)) continue;
    const meta = byName.get(argName);
    if (!meta || meta.tipo_input !== "number") continue;

    const result = validateNumericArgValue(value, meta);
    if (result.ok) continue;

    const range = formatNumericRange(meta);
    issues.push({
      severity: "error",
      code: "numeric-invalid",
      message: `${context.scope}: el ajuste «${meta.label || argName}» tiene un valor inválido («${String(value)}»); ${result.message}.${range ? ` ${range}` : ""}`,
      slideId: context.slideId,
      slotName: context.slotName,
    });
  }

  return issues;
}

function wordChartPresets(wPresets: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const raw = wPresets.chart_presets;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, Record<string, unknown>>
    : {};
}

// Heurística: una paleta es "monocromática" si tiene >= 3 colores y
// todos están dentro de un rango de hue estrecho (< 30°). Para escalas
// Likert de 5 puntos con azules, es aceptable (estilo institucional
// donde la posición en la escala importa más que la categoría), pero
// emitimos warning para que el analista lo revise a propósito.
function isMonochromaticPalette(paleta: PaletaPorLista): boolean {
  const hexes = Object.values(paleta).filter(
    (c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c),
  );
  if (hexes.length < 3) return false;
  const hues = hexes.map(hexToHue).filter((h): h is number => h !== null);
  if (hues.length < 3) return false;
  // Span circular de hues: distancia en grados entre el min y max,
  // tomando en cuenta que el hue es circular (0 = 360).
  const sorted = [...hues].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    gaps.push(sorted[i + 1] - sorted[i]);
  }
  gaps.push(360 - sorted[sorted.length - 1] + sorted[0]);
  const maxGap = Math.max(...gaps);
  const span = 360 - maxGap;
  return span < 30;
}

function hexToHue(hex: string): number | null {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.01) return null; // gris, no aporta a la heurística
  let h = 0;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

export { checkVarRefs as _checkVarRefs, isMonochromaticPalette as _isMonochromaticPalette };
