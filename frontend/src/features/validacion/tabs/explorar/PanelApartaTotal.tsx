import { desviaciones, fmtN, rangoColumnas, UMBRAL_PUNTOS, type ModeloCalor } from "./explorarModelo";

/** E9 — las tres mayores diferencias frente al total y el tamaño que las acota. */
export default function PanelApartaTotal({ modelo }: { modelo: ModeloCalor }) {
  const lecturas = desviaciones(modelo);
  const rango = rangoColumnas(modelo);
  return (
    <>
      <section className="vx-tarjeta vx-panel" aria-label="Lo que se aparta del total">
        <h4>Lo que se aparta del total</h4>
        {modelo.lectura === "n" ? (
          <p>En n no se compara con el total: elige una lectura en %.</p>
        ) : lecturas.length === 0 ? (
          <p>Ninguna celda se aparta {UMBRAL_PUNTOS} puntos o más del total.</p>
        ) : (
          lecturas.map((l, i) => (
            <div key={i} className={`vx-lectura is-${l.sentido}`}>
              <i aria-hidden>{l.sentido === "arriba" ? "▲" : "▼"}</i>
              <span>
                <strong>{l.titulo}</strong>
                <small>{l.detalle}</small>
              </span>
            </div>
          ))
        )}
      </section>
      {rango && (
        <section className="vx-tarjeta vx-panel" aria-label="Antes de leerlo">
          <h4>Antes de leerlo</h4>
          <p>
            {rango.min === rango.max
              ? `Cada ${rango.de} tiene ${fmtN(rango.min)} ${rango.min === 1 ? "caso" : "casos"}.`
              : `Cada ${rango.de} tiene entre ${fmtN(rango.min)} y ${fmtN(rango.max)} casos.`}{" "}
            Con ese tamaño, una diferencia de {UMBRAL_PUNTOS} puntos es una pista para revisar, no una conclusión.
          </p>
        </section>
      )}
    </>
  );
}
