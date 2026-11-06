import type { ExploradorDist } from "../../../../api/validacionExplorar";
import DistribucionBarras from "./DistribucionBarras";
import DistribucionFecha from "./DistribucionFecha";
import DistribucionNumerica from "./DistribucionNumerica";
import DistribucionTexto from "./DistribucionTexto";
import GraficoTarjeta from "./GraficoTarjeta";

/**
 * E6 — el gráfico univariado que corresponde al tipo, leyendo `uni.dist`. El
 * título es la variable (D1); la base ya la dice la frase de arriba (E4), así
 * que la tarjeta sólo agrega que el conteo va sin ponderar.
 */
export default function Distribucion({
  dist,
  titulo,
  sinRespuesta,
  declarados = null,
}: {
  dist: ExploradorDist;
  titulo: string;
  sinRespuesta: number | null;
  declarados?: ReadonlySet<string> | null;
}) {
  const bajada = "sin ponderar";
  if ((dist.tipo === "so" || dist.tipo === "sm") && dist.filas) {
    return (
      <GraficoTarjeta tipo={dist.tipo} titulo={titulo} bajada={bajada}>
        <DistribucionBarras dist={dist} sinRespuesta={sinRespuesta} declarados={declarados} />
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
