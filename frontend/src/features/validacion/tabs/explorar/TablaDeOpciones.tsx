import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import type { ExploradorDistFila } from "../../../../api/validacionExplorar";
import { esFueraDeLista, fmtN, fmtPct, ordenarFilas } from "./explorarModelo";
import type { LecturaDeDistribucion } from "./lecturaDeDistribucion";

type Fila = ExploradorDistFila & { fuera: boolean };

/**
 * "Tabla" del conmutador "Gráfico / Tabla": las opciones con sus casos y su
 * porcentaje, en el orden de las barras. "Porcentaje / Casos" decide qué
 * columna va primero. Lleva el código de cada opción; los códigos fuera de la
 * lista se dicen como en las barras.
 */
export default function TablaDeOpciones({
  filas,
  ordinal,
  declarados = null,
  valor,
}: {
  filas: readonly ExploradorDistFila[];
  ordinal: boolean;
  declarados?: ReadonlySet<string> | null;
  valor: LecturaDeDistribucion["valor"];
}) {
  const fuera = esFueraDeLista(filas, declarados);
  const ordenadas: Fila[] = ordenarFilas(filas, ordinal, declarados).map((f) => ({ ...f, fuera: fuera(f) }));
  // El código de cada opción vive aquí (antes, en la tabla de "En el formulario").
  const codigo: PulsoTableColumna<Fila> = { id: "codigo", encabezado: "Código", ancho: 80, celda: (f) => <code>{f.codigo}</code>, valor: (f) => f.codigo };
  const respuesta: PulsoTableColumna<Fila> = {
    id: "respuesta",
    encabezado: "Respuesta",
    ancho: 300,
    celda: (f) => (f.fuera ? `${f.etiqueta} (fuera de la lista)` : f.etiqueta),
    valor: (f) => f.etiqueta,
  };
  const casos: PulsoTableColumna<Fila> = { id: "casos", encabezado: "Casos", ancho: 96, tipo: "cifra", celda: (f) => fmtN(f.n), valor: (f) => f.n };
  const pct: PulsoTableColumna<Fila> = { id: "pct", encabezado: "%", ancho: 96, tipo: "cifra", celda: (f) => fmtPct(f.pct), valor: (f) => f.pct };
  return (
    <PulsoTable
      columnas={valor === "casos" ? [codigo, respuesta, casos, pct] : [codigo, respuesta, pct, casos]}
      filas={ordenadas}
      idDeFila={(f) => `${f.codigo}-${f.etiqueta}`}
      ariaLabel="Opciones con sus casos"
      densidad="compacta"
      vacio="Ninguna opción con casos."
    />
  );
}
