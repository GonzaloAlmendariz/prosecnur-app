// ensayoPublicacionModelo.ts — lectura pura del ensayo «Revisar → Aplicar» de
// Salidas (Meta B, L38). Decide qué dice cada pestaña y con qué peso se ofrece
// Aplicar; el diálogo solo pinta lo que devuelve este módulo.

import type { EnsayoPestana, EnsayoPublicacion } from "../../../api/monitoreoPublicarEnsayo";

const fmt = (n: number) => n.toLocaleString("es-PE");

const plural = (n: number, uno: string, varios: string) => `${fmt(n)} ${n === 1 ? uno : varios}`;

export type EstadoPestana = "se-crea" | "sin-cambios" | "destructiva" | "cambia";

export function estadoPestana(p: EnsayoPestana): EstadoPestana {
  if (p.seCrea) return "se-crea";
  if (p.destructiva) return "destructiva";
  if (p.sinCambios) return "sin-cambios";
  return "cambia";
}

export const ROTULO_ESTADO: Record<EstadoPestana, string> = {
  "se-crea": "Pestaña nueva",
  "sin-cambios": "Sin cambios",
  destructiva: "Borra filas",
  cambia: "Cambia",
};

/** Una línea por pestaña: los recuentos que no son cero, en orden fijo. */
export function lineaPestana(p: EnsayoPestana): string {
  if (p.seCrea) return `Se crea con ${plural(p.filasDespues, "fila", "filas")}.`;
  if (p.sinCambios) return `Queda igual (${plural(p.filasAntes, "fila", "filas")}).`;
  const partes = [
    p.anadidas ? plural(p.anadidas, "añadida", "añadidas") : null,
    p.cambiadas ? plural(p.cambiadas, "cambiada", "cambiadas") : null,
    p.borradas ? plural(p.borradas, "borrada", "borradas") : null,
  ].filter(Boolean);
  const encoge = p.encoge ? ` Pasa de ${fmt(p.filasAntes)} a ${fmt(p.filasDespues)} filas.` : "";
  const columnas = p.columnasCambiadas.length
    ? ` ${plural(p.columnasCambiadas.length, "columna cambia", "columnas cambian")} de rótulo.`
    : "";
  return `${partes.length ? partes.join(" · ") : "Solo cambia la cabecera"}.${encoge}${columnas}`;
}

/** Cómo se identificó cada fila: el lector tiene que saber qué es «cambiada». */
export function lineaClave(p: EnsayoPestana): string {
  if (p.seCrea || p.sinCambios) return "";
  return p.sinClave
    ? "Sin columna que identifique cada fila: se compara la fila completa, así que una fila editada cuenta como borrada y añadida."
    : `Cada fila se identifica por «${p.clave}».`;
}

export type AccionAplicar = {
  rotulo: string;
  /** `peligro`: el botón final es el rojo sólido del kit (D13). */
  tono: "primario" | "peligro";
  /** Aviso que acompaña el pie; vacío si no hace falta. */
  aviso: string;
};

export function accionAplicar(e: EnsayoPublicacion): AccionAplicar {
  const { borradas, pestanasQueEncogen, destructivo } = e.resumen;
  if (destructivo) {
    const motivos = [
      borradas ? plural(borradas, "fila desaparece", "filas desaparecen") : null,
      pestanasQueEncogen ? plural(pestanasQueEncogen, "pestaña encoge", "pestañas encogen") : null,
    ].filter(Boolean);
    return {
      rotulo: borradas ? `Aplicar y borrar ${plural(borradas, "fila", "filas")}` : "Aplicar aunque encoja",
      tono: "peligro",
      aviso: `${motivos.join(" y ")} del libro.`,
    };
  }
  if (e.pestanas.length && e.pestanas.every((p) => p.sinCambios)) {
    return { rotulo: "Aplicar de todos modos", tono: "primario", aviso: "El libro ya tiene exactamente esto." };
  }
  return { rotulo: "Aplicar", tono: "primario", aviso: "" };
}

/** Las cifras del resumen en el orden en que se leen. */
export function cifrasResumen(e: EnsayoPublicacion): { clave: string; rotulo: string; valor: number }[] {
  const r = e.resumen;
  return [
    { clave: "anadidas", rotulo: "Añadidas", valor: r.anadidas },
    { clave: "cambiadas", rotulo: "Cambiadas", valor: r.cambiadas },
    { clave: "borradas", rotulo: "Borradas", valor: r.borradas },
    { clave: "nuevas", rotulo: "Pestañas nuevas", valor: r.pestanasNuevas },
  ];
}

export function lineaIntactas(e: EnsayoPublicacion): string {
  if (!e.intactas.length) return "";
  const nombres = e.intactas.slice(0, 6).join(", ");
  const resto = e.intactas.length > 6 ? ` y ${fmt(e.intactas.length - 6)} más` : "";
  return `${plural(e.intactas.length, "pestaña del libro no se toca", "pestañas del libro no se tocan")}: ${nombres}${resto}.`;
}
