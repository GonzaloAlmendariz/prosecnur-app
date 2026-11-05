// La maqueta se declara como tal (H4, 2026-11-05): sin esta línea, una lámina de resumen o de estructura se leía como un
// gráfico vacío o roto (lámina 25 de CCSS). Una línea discreta dentro de la maqueta, con «Previsualizar» al alcance;
// el valor por defecto del visor sigue siendo la maqueta, porque la vista real cuesta un render.

type Props = {
  /** Pide la vista real (el mismo `alternarComoQueda` del botón de la barra del visor). */
  onPrevisualizar?: () => void;
  /** Sin base preparada el motor no puede dibujarla: se dice qué falta en vez del botón. */
  prepOk?: boolean;
};

export function AvisoMaqueta({ onPrevisualizar, prepOk = true }: Props) {
  if (!onPrevisualizar) return null;
  return (
    <p className="pulso-f6-maqueta-aviso" role="note" data-qa="aviso-maqueta"
      data-qa-geometry-group="graficos/f6-maqueta-aviso" data-qa-geometry-contract="intrinsic">
      {/* Dos líneas fijas: partida por el ancho, la frase dejaba el botón solo en su renglón (rotulo-partido a 1024). */}
      <span className="pulso-f6-maqueta-aviso-linea">Esta es la maqueta.</span>{" "}
      <span className="pulso-f6-maqueta-aviso-linea">
        {prepOk ? (
          <>
            <button type="button" className="pulso-f6-maqueta-aviso-boton" onClick={onPrevisualizar}>Previsualizar</button>
            {" "}muestra sus datos.
          </>
        ) : "Sus datos se ven con la base preparada."}
      </span>
    </p>
  );
}
