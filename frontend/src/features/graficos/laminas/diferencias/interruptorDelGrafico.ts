// El interruptor `mostrar_significancia` de un gráfico en la tarjeta (U11 del checklist de mandos del mazo, 2026-11-05).
// Puro.
//
// Cuándo aparece: el registro puede declarar `depende` (multiapiladas lo ofrece sólo en el modo `cruce`, el único que
// marca diferencias en el render). Un `modo` sin guardar vale lo que el constructor R toma por omisión, el primero de
// sus valores (`match.arg`), así que una multiapilada sin modo es «Comparar preguntas» y no lleva la sección.
//
// Qué vale: el motor lee el interruptor de `overrides` y el constructor sólo copia el formal de `args` si `overrides`
// no lo trae (`.ppt_slot_override`, reporte_plan_slides.R). Un `overrides.mostrar_significancia` de un plan viejo manda,
// así que la tarjeta lo lee primero y, al escribir, lo quita de `overrides` para que el formal sea el único que decide.

import type { ArgMetadata } from "../../../../api/graficos";
import { argAplica } from "../../argDependencias";

type Valores = Readonly<Record<string, unknown>>;

const esRegistro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** El valor que el constructor R le da a un arg sin guardar: su default o, si es de opciones, la primera. */
function valorPorOmision(meta: ArgMetadata | undefined): unknown {
  if (!meta) return undefined;
  if (meta.default !== undefined && meta.default !== null) return meta.default;
  return meta.choices?.[0]?.value;
}

/** ¿La sección «Diferencias entre grupos» aplica a este gráfico con sus valores actuales? */
export function interruptorAplica(argSig: ArgMetadata, argsRegistro: readonly ArgMetadata[], args: Valores): boolean {
  const control = argSig.depende?.arg;
  if (!control) return true;
  const actual = args[control];
  if (actual !== undefined && actual !== null && actual !== "") return argAplica(argSig, args);
  const porOmision = valorPorOmision(argsRegistro.find((a) => a.name === control));
  return argAplica(argSig, porOmision === undefined ? args : { ...args, [control]: porOmision });
}

/** Lo guardado en el gráfico: `overrides` manda sobre el formal, como en el motor. Sin nada guardado, `undefined`. */
export function interruptorGuardado(args: Valores): boolean | undefined {
  const ov = esRegistro(args.overrides) ? args.overrides.mostrar_significancia : undefined;
  if (typeof ov === "boolean") return ov;
  return typeof args.mostrar_significancia === "boolean" ? args.mostrar_significancia : undefined;
}

/** El parche al alternar: el formal y, si `overrides` traía el interruptor, `overrides` sin él (o `null` si queda vacío). */
export function parcheInterruptor(args: Valores, encendido: boolean): Record<string, unknown> {
  const parche: Record<string, unknown> = { mostrar_significancia: encendido };
  if (esRegistro(args.overrides) && "mostrar_significancia" in args.overrides) {
    const resto: Record<string, unknown> = { ...args.overrides };
    delete resto.mostrar_significancia;
    parche.overrides = Object.keys(resto).length ? resto : null;
  }
  return parche;
}
