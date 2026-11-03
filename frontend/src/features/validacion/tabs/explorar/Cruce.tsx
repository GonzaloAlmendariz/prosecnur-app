import type { ExploradorCruce } from "../../../../api/validacionExplorar";
import CruceCajas from "./CruceCajas";
import CruceDispersion from "./CruceDispersion";
import CruceLista from "./CruceLista";
import CruceSerie from "./CruceSerie";
import GraficoTarjeta from "./GraficoTarjeta";
import TablaCalor, { LecturaCalorSelector } from "./TablaCalor";
import { fmtN, type LecturaCalor, type ModeloCalor } from "./explorarModelo";
import { bajadaDeSerie, modoDeSerie } from "./serieModelo";

/**
 * E8 — el cruce dibujado por su forma (`biv.cruce.forma`). La tabla recibe el
 * modelo ya calculado porque el panel «Lo que se aparta del total» lee el mismo.
 */
export default function Cruce({
  cruce,
  modelo,
  lectura,
  onLectura,
  rotuloX,
  rotuloY,
}: {
  cruce: ExploradorCruce;
  modelo: ModeloCalor | null;
  lectura: LecturaCalor;
  onLectura: (l: LecturaCalor) => void;
  rotuloX: string;
  rotuloY: string;
}) {
  const respuestas = `${fmtN(cruce.base_n)} ${cruce.base_n === 1 ? "respuesta" : "respuestas"}`;
  if (cruce.forma === "tabla" && modelo) {
    return (
      <GraficoTarjeta
        titulo={modelo.titulo}
        bajada={
          lectura === "n"
            ? `${respuestas} · el tono marca el peso de la celda`
            : `${respuestas} · el tono marca el peso de la celda; la flecha, una diferencia de 5 puntos o más frente al total`
        }
        acciones={<LecturaCalorSelector valor={lectura} onCambio={onLectura} />}
      >
        <TablaCalor modelo={modelo} rotuloFilas={rotuloX} />
      </GraficoTarjeta>
    );
  }
  const titulo = cruce.grafico || "Cruce";
  if (cruce.forma === "cajas" && cruce.cajas) {
    return (
      <GraficoTarjeta tipo="num" titulo={titulo} bajada={`${respuestas} · misma escala para todos los grupos`}>
        <CruceCajas grupos={cruce.cajas.grupos} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "dispersion" && cruce.dispersion) {
    return (
      <GraficoTarjeta tipo="num" titulo={titulo} bajada={respuestas}>
        <CruceDispersion {...cruce.dispersion} rotuloX={rotuloX} rotuloY={rotuloY} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "serie" && cruce.serie) {
    const modo = modoDeSerie(cruce.tipo_x);
    return (
      <GraficoTarjeta tipo="fecha" titulo={titulo} bajada={`${respuestas} · ${bajadaDeSerie(modo)}`}>
        <CruceSerie puntos={cruce.serie.puntos} modo={modo} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "lista" && cruce.lista) {
    return (
      <GraficoTarjeta tipo="texto" titulo={titulo} bajada={respuestas}>
        <CruceLista grupos={cruce.lista.grupos} />
      </GraficoTarjeta>
    );
  }
  return null;
}
