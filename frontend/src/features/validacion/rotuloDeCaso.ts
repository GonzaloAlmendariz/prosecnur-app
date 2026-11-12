// Cómo se nombra un caso en pantalla. El id del motor es la llave con que se
// guardan las decisiones y no cambia; cuando la base no trae una columna de id
// reconocida, ese id es `<tabla>::idx::<n>` o `<tabla>::row::<n>`, que no le
// dice nada a quien busca la ficha. En pantalla va "Fila n" y el id interno
// queda en el título.

const POR_FILA = /^(.+)::(?:idx|row)::(\d+)$/;

export type RotuloDeCaso = { texto: string; titulo: string };

export function rotuloDeCaso(id: string): RotuloDeCaso {
  const m = POR_FILA.exec(id);
  if (!m) return { texto: id, titulo: id };
  const [, tabla, fila] = m;
  const texto = tabla === "principal" ? `Fila ${fila}` : `Fila ${fila} de ${tabla}`;
  return { texto, titulo: `${texto} de los datos, sin contar la cabecera. Identificador interno: ${id}` };
}
