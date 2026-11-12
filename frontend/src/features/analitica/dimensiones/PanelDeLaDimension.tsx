// El índice o bloque elegido (prototipo, Analítica › Dimensiones, panel central):
// su puntaje medio de 0 a 100, la desviación y los casos con puntaje, todo de la
// cobertura del motor; debajo, sus bloques con el puntaje de cada uno y las
// preguntas que los forman. El motor no publica puntaje por pregunta ni la
// distribución del índice: esas piezas del prototipo no se dibujan.

import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { formatoConteo, formatoConteoDe, formatoDecimal } from "../../../lib/formatoNumero";
import { Layers } from "../../../vendor/lucide-react";
import { preguntasDeLaEntrada, type EntradaDeDimension } from "./modeloDeDimensiones";
import { TablaDeBloques } from "./TablaDeBloques";

export function PanelDeLaDimension({ entrada, etiquetas, foco }: {
  entrada: EntradaDeDimension | null;
  etiquetas: ReadonlyMap<string, string>;
  foco: string | null;
}) {
  if (!entrada) {
    return (
      <PanelDeMesa zona="dimension" titulo="Índice">
        <EstadoVacio icono={<Layers size={16} />} titulo="Elige un índice" descripcion="Su puntaje y sus preguntas se ven aquí." />
      </PanelDeMesa>
    );
  }
  const c = entrada.cobertura;
  return (
    <PanelDeMesa
      zona="dimension"
      titulo={entrada.etiqueta}
      conteo={formatoConteoDe(preguntasDeLaEntrada(entrada).length, "pregunta", "preguntas")}
      grupo="analitica/dimensiones-detalle"
    >
      {c ? (
        <dl className="dimensiones-resumen" aria-label={`Puntaje de ${entrada.etiqueta}`}>
          <div className="dimensiones-resumen-principal">
            <dt>Puntaje medio</dt>
            <dd><strong>{formatoDecimal(c.media, 1)}</strong><span>de 0 a 100</span></dd>
          </div>
          <div>
            <dt>Desviación estándar</dt>
            <dd><b>{formatoDecimal(c.sd, 1)}</b></dd>
          </div>
          <div>
            <dt>Casos con puntaje</dt>
            <dd>
              <b>{formatoConteo(c.n_validos)}</b>
              <span>de {formatoConteo(c.n)} ({formatoDecimal(c.pct_validos, 1)} %)</span>
            </dd>
          </div>
        </dl>
      ) : (
        <EstadoVacio
          icono={<Layers size={16} />}
          titulo="Sin puntaje calculado"
          descripcion={`La base calculada no trae la columna ${entrada.columna}. Vuelve a calcular para tenerla.`}
        />
      )}
      <TablaDeBloques entrada={entrada} etiquetas={etiquetas} foco={foco} />
    </PanelDeMesa>
  );
}
