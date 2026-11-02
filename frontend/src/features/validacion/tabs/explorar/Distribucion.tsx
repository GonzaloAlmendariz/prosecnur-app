import type { ExploradorDist } from "../../../../api/validacionExplorar";
import DistribucionBarras from "./DistribucionBarras";
import DistribucionFecha from "./DistribucionFecha";
import DistribucionNumerica from "./DistribucionNumerica";
import DistribucionTexto from "./DistribucionTexto";
import GraficoTarjeta from "./GraficoTarjeta";
import { fmtN } from "./explorarModelo";

/** E6 — el gráfico univariado que corresponde al tipo, leyendo `uni.dist`. */
export default function Distribucion({
  dist,
  sinRespuesta,
  declarados = null,
}: {
  dist: ExploradorDist;
  sinRespuesta: number | null;
  declarados?: ReadonlySet<string> | null;
}) {
  const base = fmtN(dist.base_n);
  if ((dist.tipo === "so" || dist.tipo === "sm") && dist.filas) {
    const sm = dist.tipo === "sm";
    return (
      <GraficoTarjeta
        tipo={dist.tipo}
        titulo={sm ? "% que marca cada opción" : dist.ordinal ? "Distribución en la escala" : "Distribución"}
        bajada={`Porcentaje sobre ${dist.base_n === 1 ? "la respuesta" : `las ${base} respuestas`}`}
        pie={
          sm
            ? "No suma 100%: cada barra es sobre quienes responden. Abajo, cuántas opciones marca cada caso."
            : dist.ordinal
              ? "La lista es ordinal: se respeta su orden y se resumen los dos extremos."
              : "Orden por frecuencia; «Otro» y «No sabe» siempre al final."
        }
      >
        <DistribucionBarras dist={dist} sinRespuesta={sinRespuesta} declarados={declarados} />
      </GraficoTarjeta>
    );
  }
  if (dist.tipo === "num" && dist.num) {
    return (
      <GraficoTarjeta tipo="num" titulo="Histograma y caja" bajada={`${base} valores numéricos`}>
        <DistribucionNumerica num={dist.num} />
      </GraficoTarjeta>
    );
  }
  if (dist.tipo === "fecha" && dist.fecha) {
    return (
      <GraficoTarjeta tipo="fecha" titulo="Casos por día" bajada={`${base} fechas`}>
        <DistribucionFecha dias={dist.fecha.dias} />
      </GraficoTarjeta>
    );
  }
  if (dist.tipo === "texto" && dist.texto) {
    return (
      <GraficoTarjeta
        tipo="texto"
        titulo="Respuestas agrupadas"
        bajada={`${base} respuestas · los textos iguales se agrupan sin mayúsculas ni tildes`}
      >
        <DistribucionTexto grupos={dist.texto.grupos} />
      </GraficoTarjeta>
    );
  }
  return null;
}
