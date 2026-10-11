// «En el Word» de la tarjeta de un gráfico (F6.2, F-d). Sólo lo que el motor Word YA lee de cada gráfico
// (api/R/reporte_word_documento.R + `.push_render_meta_for_element`, reporte_plan_ppt.R):
//
// - Todo gráfico de la lámina entra al Word como figura «Gráfico N» con su título en la línea siguiente. De dónde sale
//   ese título depende de la lámina (`tituloDeFigura`): el arg `titulo` del gráfico llega como `overrides$titulo`
//   (`.clean_rebuild_args`, router_graficos.R) y sólo manda en láminas de dos o más gráficos, donde además encabeza su
//   panel en el PPT; en una lámina de un gráfico el motor le pone el título de la lámina (reporte_plan_ppt.R, «Inyectar
//   titulo del slide»). La multiapilada se parte en una figura por pregunta (o por grupo) y la titula «título de la
//   lámina — pregunta» (`.split_multi_block` + `.word_titulo_bloque_multi`); su título propio no llega al Word.
// - Barras apiladas sin «Dividir por» y multiapiladas «Comparar preguntas»: en el Word el título ya nombra la pregunta,
//   así que la barra sale sin rótulo (`word_ocultar_etiqueta_categoria`, por defecto TRUE; el informe lo fija con
//   `chart_options.ocultar_etiqueta_si_titulo` de los ajustes Word). Por gráfico se lee de `overrides`.
//
// Lo que el motor NO lee por gráfico (dejar un gráfico fuera del Word, un título distinto sólo para el Word, la
// «Lectura» bajo la figura) no se ofrece aquí: es pedido de motor.

type Registro = Record<string, unknown>;
type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});

/** ¿El motor Word decide el rótulo de la barra de este gráfico? */
export function aplicaRotuloWord(graficador: string, args: Readonly<Registro>): boolean {
  if (graficador === "p_barras_apiladas") return !(typeof args.cruces === "string" && args.cruces.trim());
  if (graficador === "p_barras_multiapiladas") return (args.modo ?? "var") === "var";
  return false;
}

/** ¿El gráfico admite un título propio (`titulo` en su registro)? */
export function admiteTitulo(argsDelRegistro: readonly { name: string }[]): boolean {
  return argsDelRegistro.some((a) => a.name === "titulo");
}

/** Lo heredado: preset del gráfico, luego los ajustes Word del informe, luego el recetario (oculto). */
function ocultarHeredado(graficador: string, presets: Presets, wPresets: Readonly<Registro>): boolean {
  // `.apply_word_chart_presets` (reporte_plan_word.R) llena el preset de cada familia con `chart_options` cuando no lo
  // declara, así que el de apiladas nunca llega a la multiapilada.
  const v = registro(presets[graficador === "p_barras_multiapiladas" ? "multi_apiladas" : "barras_apiladas"]).word_ocultar_etiqueta_categoria;
  if (typeof v === "boolean") return v;
  const op = registro(wPresets.chart_options).ocultar_etiqueta_si_titulo;
  return op !== false;
}

/** ¿Se repite la pregunta junto a la barra en el Word? (lo contrario de `word_ocultar_etiqueta_categoria`). */
export function repiteRotuloWord(graficador: string, args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>): boolean {
  const v = registro(args.overrides).word_ocultar_etiqueta_categoria;
  const ocultar = typeof v === "boolean" ? v : ocultarHeredado(graficador, presets, wPresets);
  return !ocultar;
}

/** Patch de args: sólo escribe el override cuando se aparta de lo heredado. */
export function patchRotuloWord(
  graficador: string,
  args: Readonly<Registro>,
  presets: Presets,
  wPresets: Readonly<Registro>,
  repetir: boolean,
): Registro {
  const ov: Registro = { ...registro(args.overrides) };
  delete ov.word_ocultar_etiqueta_categoria;
  if (!repetir !== ocultarHeredado(graficador, presets, wPresets)) ov.word_ocultar_etiqueta_categoria = !repetir;
  return { overrides: Object.keys(ov).length ? ov : null };
}

export type TituloDeFigura =
  /** El título propio del gráfico (vacío: etiqueta corta o pregunta). */
  | "propio"
  /** El título de la lámina. */
  | "lamina"
  /** Una figura por pregunta o grupo: «título de la lámina — pregunta». */
  | "lamina_y_pregunta";

/** De dónde saca el Word el título de la figura de este gráfico, según cuántos gráficos lleva la lámina. */
export function tituloDeFigura(graficador: string, ranurasDeLaLamina: number): TituloDeFigura {
  if (graficador === "p_barras_multiapiladas") return "lamina_y_pregunta";
  return ranurasDeLaLamina <= 1 ? "lamina" : "propio";
}

/** Lo que dirá la figura cuando el gráfico no tiene título propio. */
export function tituloWordPorDefecto(etiquetaCorta: string, pregunta: string): string {
  return etiquetaCorta.trim() || pregunta.trim();
}
