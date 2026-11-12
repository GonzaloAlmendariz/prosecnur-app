import type { ExploradorDist } from "../../../../api/validacionExplorar";
import DistribucionBarras from "./DistribucionBarras";
import DistribucionFecha from "./DistribucionFecha";
import DistribucionNumerica from "./DistribucionNumerica";
import DistribucionTexto from "./DistribucionTexto";
import GraficoTarjeta from "./GraficoTarjeta";
import TablaDeOpciones from "./TablaDeOpciones";
import { LECTURA_INICIAL, type LecturaDeDistribucion } from "./lecturaDeDistribucion";

/**
 * E6 — el gráfico univariado que corresponde al tipo, leyendo `uni.dist`. El
 * título es la variable (D1); la base ya la dice la frase de arriba (E4), así
 * que la tarjeta sólo agrega que el conteo va sin ponderar. En una pregunta de
 * opciones, `lectura` (los conmutadores de la barra) elige la cifra y si se ve
 * en barras o en tabla.
 */
export default function Distribucion({
  dist,
  titulo = null,
  sinRespuesta,
  declarados = null,
  lectura = LECTURA_INICIAL,
}: {
  dist: ExploradorDist;
  /** Sin título (Explorar): la pregunta ya titula el contenedor y la base va en la nota de abajo. */
  titulo?: string | null;
  sinRespuesta: number | null;
  declarados?: ReadonlySet<string> | null;
  lectura?: LecturaDeDistribucion;
}) {
  const bajada = titulo ? "sin ponderar" : null;
  if ((dist.tipo === "so" || dist.tipo === "sm") && dist.filas) {
    return (
      <GraficoTarjeta tipo={dist.tipo} titulo={titulo} bajada={bajada}>
        {lectura.vista === "tabla" ? (
          <TablaDeOpciones filas={dist.filas} ordinal={dist.ordinal} declarados={declarados} valor={lectura.valor} />
        ) : (
          <DistribucionBarras dist={dist} sinRespuesta={sinRespuesta} declarados={declarados} valor={lectura.valor} />
        )}
      </GraficoTarjeta>
    );
  }
  if (dist.tipo === "num" && dist.num) {
    return (
      <GraficoTarjeta tipo="num" titulo={titulo} bajada={bajada}>
        <DistribucionNumerica num={dist.num} />
      </GraficoTarjeta>
    );
  }
  if (dist.tipo === "fecha" && dist.fecha) {
    return (
      <GraficoTarjeta tipo="fecha" titulo={titulo} bajada={bajada}>
        <DistribucionFecha dias={dist.fecha.dias} />
      </GraficoTarjeta>
    );
  }
  if (dist.tipo === "texto" && dist.texto) {
    return (
      <GraficoTarjeta tipo="texto" titulo={titulo} bajada={bajada}>
        <DistribucionTexto grupos={dist.texto.grupos} />
      </GraficoTarjeta>
    );
  }
  return null;
}
