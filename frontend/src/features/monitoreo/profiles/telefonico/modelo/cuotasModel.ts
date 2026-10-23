/**
 * Modelo › Cuotas y calendario del telefónico: metas por categoría frente al
 * reparto proporcional al universo, y la validación de lo declarado.
 *
 * Modelo puro sobre las filas que ya arma el editor de cuotas
 * (`buildAcreditacionPhoneQuotaEditorRows`): categoría, universo, meta y
 * efectivas. No propone metas: compara las que hay con el reparto que daría
 * el universo, que es la pregunta que el equipo se hace al revisarlas.
 */

export type FilaDeMeta = { value: string; universe: number; meta: number | null; effective: number };

export type MetaConProporcion = FilaDeMeta & {
  /** Meta sobre el universo de la categoría, de 0 a 1; null sin universo o sin meta. */
  sobreUniverso: number | null;
  /** Lo que tocaría con un reparto proporcional al universo de la suma de metas. */
  proporcional: number | null;
  /** Meta menos el reparto proporcional, redondeado; positivo lleva más. */
  desvio: number | null;
};

export function metasConProporcion(filas: readonly FilaDeMeta[]): MetaConProporcion[] {
  const universo = filas.reduce((suma, fila) => suma + fila.universe, 0);
  const metas = filas.reduce((suma, fila) => suma + (fila.meta ?? 0), 0);
  return filas.map((fila) => {
    const proporcional = universo > 0 && metas > 0 ? (fila.universe / universo) * metas : null;
    return {
      ...fila,
      sobreUniverso: fila.meta != null && fila.universe > 0 ? fila.meta / fila.universe : null,
      proporcional,
      desvio: proporcional != null && fila.meta != null ? Math.round(fila.meta - proporcional) : null,
    };
  });
}

export type Validacion = { tono: "ok" | "aviso"; texto: string };

const fmt = (n: number) => n.toLocaleString("es-PE");

/** Desvío desde el que se dice que una categoría se aparta del reparto. */
export const DESVIO_QUE_SE_SENALA = 5;

export function validarMetas({
  filas,
  variable,
  objetivoTotal,
}: {
  filas: readonly MetaConProporcion[];
  variable: string;
  objetivoTotal: number | null;
}): Validacion[] {
  const out: Validacion[] = [];
  if (!filas.length) return [{ tono: "aviso", texto: `${variable} no tiene categorías en la hoja ni metas declaradas.` }];
  const suma = filas.reduce((total, fila) => total + (fila.meta ?? 0), 0);
  const conMeta = filas.filter((fila) => fila.meta != null && fila.meta > 0);
  const cuantas = filas.length === 1 ? "La meta suma" : `Las ${fmt(filas.length)} metas suman`;
  if (objetivoTotal != null && objetivoTotal > 0) {
    out.push(suma === objetivoTotal
      ? { tono: "ok", texto: `${cuantas} ${fmt(suma)}, igual que el objetivo total declarado.` }
      : { tono: "aviso", texto: `${cuantas} ${fmt(suma)} y el objetivo total declarado es ${fmt(objetivoTotal)}.` });
  } else if (suma > 0) {
    out.push({ tono: "aviso", texto: `${cuantas} ${fmt(suma)}; el proyecto no declara objetivo total.` });
  }
  const sinMeta = filas.filter((fila) => fila.meta == null || fila.meta <= 0);
  if (sinMeta.length) {
    out.push({ tono: "aviso", texto: `${sinMeta.length === 1 ? "1 categoría" : `${fmt(sinMeta.length)} categorías`} sin meta: ${sinMeta.map((fila) => fila.value).join(", ")}.` });
  }
  const sinBase = conMeta.filter((fila) => fila.universe <= 0);
  if (sinBase.length) {
    out.push({ tono: "aviso", texto: `${sinBase.map((fila) => fila.value).join(", ")} ${sinBase.length === 1 ? "tiene" : "tienen"} meta y no ${sinBase.length === 1 ? "aparece" : "aparecen"} en la hoja.` });
  } else if (conMeta.length) {
    out.push({ tono: "ok", texto: `Las categorías con meta existen en la hoja de ${variable.toLocaleLowerCase("es")}.` });
  }
  const conDesvio = filas.filter((fila) => fila.desvio != null);
  const mas = [...conDesvio].sort((a, b) => (b.desvio ?? 0) - (a.desvio ?? 0))[0];
  const menos = [...conDesvio].sort((a, b) => (a.desvio ?? 0) - (b.desvio ?? 0))[0];
  const partes = [
    mas && (mas.desvio ?? 0) >= DESVIO_QUE_SE_SENALA ? `${mas.value} lleva ${fmt(mas.desvio ?? 0)} más` : "",
    menos && (menos.desvio ?? 0) <= -DESVIO_QUE_SE_SENALA ? `${menos.value} ${fmt(Math.abs(menos.desvio ?? 0))} menos` : "",
  ].filter(Boolean);
  if (partes.length) {
    out.push({ tono: "aviso", texto: `${partes.join(" y ")} que un reparto proporcional al universo.` });
  } else if (conDesvio.length > 1) {
    out.push({ tono: "ok", texto: "Las metas siguen el reparto proporcional al universo." });
  }
  return out;
}
