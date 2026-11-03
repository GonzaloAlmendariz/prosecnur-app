import type { ExploradorCruce } from "../../../../api/validacionExplorar";
import CruceCajas, { diferenciaEnCifras, DiferenciaEnCifras } from "./CruceCajas";
import CruceEnfrentados, { enfrentados } from "./CruceEnfrentados";
import CruceRecodificacion, { recodificacion } from "./CruceRecodificacion";
import CruceDispersion, { AvisoImposible, negativosImposibles, noPuedeSerNegativa } from "./CruceDispersion";
import CruceLista from "./CruceLista";
import CruceSerie from "./CruceSerie";
import GraficoTarjeta from "./GraficoTarjeta";
import TablaCalor, { LecturaCalorSelector } from "./TablaCalor";
import TituloCruce, { rotuloDe, textoTituloCruce, type VariableTitulo } from "./TituloCruce";
import { fraseCruceBase, type LecturaCalor, type ModeloCalor } from "./explorarModelo";
import { modoDeSerie } from "./serieModelo";

/**
 * E8 — el cruce dibujado por su forma (`biv.cruce.forma`). La tabla recibe el
 * modelo ya calculado porque el panel «Lo que se aparta del total» lee el mismo.
 * Todas las tarjetas se titulan con el cruce (D1) y dicen su base.
 */
export default function Cruce({
  cruce,
  modelo,
  lectura,
  onLectura,
  x,
  y,
}: {
  cruce: ExploradorCruce;
  modelo: ModeloCalor | null;
  lectura: LecturaCalor;
  onLectura: (l: LecturaCalor) => void;
  x: VariableTitulo;
  y: VariableTitulo;
}) {
  const respuestas = fraseCruceBase(cruce);
  const rotuloX = rotuloDe(x);
  const rotuloY = rotuloDe(y);
  const titulo = <TituloCruce x={x} y={y} />;
  const etiqueta = textoTituloCruce(x, y);
  // E8b, E8c: única × múltiple con dos o tres grupos se lee en puntos enfrentados; con más, en la tabla.
  const puntosEnfrentados = cruce.forma === "tabla" && cruce.tabla ? enfrentados(cruce.tabla, cruce.tipo_x, cruce.tipo_y, cruce.base_n) : null;
  if (puntosEnfrentados) {
    return (
      <GraficoTarjeta tipo="sm" titulo={titulo} etiqueta={etiqueta} bajada={respuestas}>
        <CruceEnfrentados datos={puntosEnfrentados} />
      </GraficoTarjeta>
    );
  }
  // E8d: una múltiple contra su recodificación se lee como antes y después; la tabla queda a un clic.
  const recod = cruce.forma === "tabla" && cruce.tabla && cruce.tipo_x === "sm" && cruce.tipo_y === "sm" ? recodificacion(cruce.tabla) : null;
  if (recod) {
    return (
      <GraficoTarjeta tipo="sm" titulo={titulo} etiqueta={etiqueta} bajada={respuestas}>
        <CruceRecodificacion datos={recod} />
        {modelo && (
          <details className="vx-detalle">
            <summary>Ver la tabla completa ({cruce.tabla?.filas.length} × {cruce.tabla?.columnas.length})</summary>
            <div className="vx-detalle-cuerpo">
              <LecturaCalorSelector valor={lectura} onCambio={onLectura} />
              <TablaCalor modelo={modelo} rotuloFilas={rotuloX} />
            </div>
          </details>
        )}
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "tabla" && modelo) {
    return (
      <GraficoTarjeta
        titulo={titulo}
        etiqueta={etiqueta}
        bajada={respuestas}
        acciones={<LecturaCalorSelector valor={lectura} onCambio={onLectura} />}
      >
        <TablaCalor modelo={modelo} rotuloFilas={rotuloX} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "cajas" && cruce.cajas) {
    const { grupos, origen } = cruce.cajas;
    if (cruce.tipo_x === "fecha" && cruce.tipo_y === "fecha") {
      // E8g: el signo de la diferencia es parte del dato, así que se dice; si casi toda vale cero, va en cifras.
      const cifras = grupos[0] ? diferenciaEnCifras(grupos[0]) : null;
      return (
        <GraficoTarjeta tipo="fecha" titulo={titulo} etiqueta={etiqueta} bajada={respuestas} pie={`Diferencia = ${rotuloY} menos ${rotuloX}.`}>
          {cifras && grupos[0] ? <DiferenciaEnCifras cifras={cifras} mediana={grupos[0].mediana} /> : <CruceCajas grupos={grupos} unidad=" días" />}
        </GraficoTarjeta>
      );
    }
    const conMultiple = cruce.tipo_x === "sm" || cruce.tipo_y === "sm";
    return (
      <GraficoTarjeta
        tipo="num"
        titulo={titulo}
        etiqueta={etiqueta}
        bajada={respuestas}
        pie={conMultiple ? "Con una múltiple, un caso entra en la caja de cada opción que marca." : null}
      >
        <CruceCajas grupos={grupos} origen={origen} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "dispersion" && cruce.dispersion) {
    const { puntos } = cruce.dispersion;
    // Los dos ejes: una duración imposible puede estar en x o en y.
    const noNegativaX = noPuedeSerNegativa(x.name, rotuloX);
    const noNegativaY = noPuedeSerNegativa(y.name, rotuloY);
    const imposiblesX = negativosImposibles(puntos, noNegativaX, 0);
    const imposiblesY = negativosImposibles(puntos, noNegativaY);
    const aviso =
      imposiblesY > 0 ? <AvisoImposible imposibles={imposiblesY} dibujados={puntos.length} n={cruce.dispersion.n} rotulo={rotuloY} />
      : imposiblesX > 0 ? <AvisoImposible imposibles={imposiblesX} dibujados={puntos.length} n={cruce.dispersion.n} rotulo={rotuloX} />
      : null;
    return (
      <GraficoTarjeta
        tipo="num"
        titulo={titulo}
        etiqueta={etiqueta}
        bajada={respuestas}
        aviso={aviso}
      >
        <CruceDispersion {...cruce.dispersion} rotuloX={rotuloX} rotuloY={rotuloY} noNegativaY={noNegativaY} noNegativaX={noNegativaX} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "serie" && cruce.serie) {
    const modo = modoDeSerie(cruce.tipo_x, cruce.tipo_y);
    return (
      <GraficoTarjeta tipo="fecha" titulo={titulo} etiqueta={etiqueta} bajada={respuestas}>
        <CruceSerie puntos={cruce.serie.puntos} modo={modo} />
      </GraficoTarjeta>
    );
  }
  if (cruce.forma === "lista" && cruce.lista) {
    return (
      <GraficoTarjeta tipo="texto" titulo={titulo} etiqueta={etiqueta} bajada={respuestas}>
        <CruceLista grupos={cruce.lista.grupos} />
      </GraficoTarjeta>
    );
  }
  return null;
}
