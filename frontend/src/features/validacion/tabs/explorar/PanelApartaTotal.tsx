import { desviaciones, fmtN, rangoColumnas, UMBRAL_PUNTOS, type ModeloCalor } from "./explorarModelo";

/**
 * E9, el cuerpo de "Lectura del cruce" (prototipo): las tres mayores
 * diferencias frente al total, como lista con su punto, y al pie el tamaño de
 * las columnas que acota lo que se puede leer.
 */
export default function PanelApartaTotal({ modelo }: { modelo: ModeloCalor }) {
  const lecturas = desviaciones(modelo);
  const rango = rangoColumnas(modelo);
  return (
    <div className="vx-lectura-cruce">
      {modelo.lectura === "n" ? (
        <p className="vx-lectura-nota">En casos no se compara con el total: elige una lectura en porcentaje.</p>
      ) : lecturas.length === 0 ? (
        <p className="vx-lectura-nota">Ninguna celda se aparta {UMBRAL_PUNTOS} puntos o más del total.</p>
      ) : (
        <ul className="vx-reglas-lista" aria-label="Diferencias frente al total" data-qa-geometry-group="validacion/explorar-lectura-cruce-lista" data-qa-geometry-contract="intrinsic">
          {lecturas.map((l, i) => (
            <li key={i} data-tono={l.sentido === "arriba" ? "aviso" : "neutro"} className="is-sin-accion">
              <span className="vx-reglas-punto" aria-hidden />
              <div>
                <b>{l.titulo}</b>
                <span>{l.detalle}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rango && (
        <p className="vx-impacto">
          {rango.min === rango.max
            ? `Cada ${rango.de} tiene ${fmtN(rango.min)} ${rango.min === 1 ? "caso" : "casos"}.`
            : `Cada ${rango.de} tiene entre ${fmtN(rango.min)} y ${fmtN(rango.max)} casos.`}{" "}
          Con ese tamaño, una diferencia de {UMBRAL_PUNTOS} puntos es una pista para revisar, no una conclusión.
        </p>
      )}
    </div>
  );
}
