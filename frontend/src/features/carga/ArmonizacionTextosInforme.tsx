// Textos de la fila que imprime el comparativo entre mediciones: el enunciado
// de la tabla y la línea «Base: …» bajo ella. Se guardan con la armonización.

import type { TextosInforme } from "./armonizacionModel";

export type ArmonizacionTextosInformeProps = {
  textos: TextosInforme;
  /** El nombre estándar: es lo que el informe usa si el enunciado queda vacío. */
  nombreEstandar: string;
  onCambiar: (campo: keyof TextosInforme, valor: string) => void;
};

export function ArmonizacionTextosInforme({ textos, nombreEstandar, onCambiar }: ArmonizacionTextosInformeProps) {
  return (
    <section
      className="pulso-armon-seccion pulso-armon-informe"
      aria-label="Textos del informe"
      data-qa-geometry-member
    >
      <label className="pulso-armon-informe-campo">
        <span>Enunciado en el informe</span>
        <input
          value={textos.enunciado}
          placeholder={nombreEstandar || "Texto de la pregunta"}
          onChange={(e) => onCambiar("enunciado", e.target.value)}
        />
      </label>
      <label className="pulso-armon-informe-campo">
        <span>Base</span>
        <input
          value={textos.baseTexto}
          placeholder="Automática"
          aria-describedby="pulso-armon-informe-base-ayuda"
          onChange={(e) => onCambiar("baseTexto", e.target.value)}
        />
        <small id="pulso-armon-informe-base-ayuda">Va bajo la tabla como «Base: …».</small>
      </label>
    </section>
  );
}
