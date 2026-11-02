// De dónde entra la campaña (revamp v5, ADR 0125): un chip en la zona de contexto de
// la barra, con el color del módulo de origen. Junto con las secciones y el chip de
// estado (lo que se entrega a Monitoreo) arma el recorrido sin una banda aparte.

import "./recorrido.css";

export type OrigenDeCampana = "hojas" | "calculo" | "monitoreo";

const ROTULO: Record<OrigenDeCampana, string> = {
  hojas: "Hojas de ruta",
  calculo: "Cálculo de muestra",
  monitoreo: "Monitoreo",
};

type Props = {
  origen: OrigenDeCampana;
  /** Lo que entró, corto: «02/11», «ronda 2», «lote 3». */
  dato?: string;
  /** Rótulo propio cuando el del módulo no basta («Sorteo del», «Ronda»). */
  rotulo?: string;
  /** La entrada cambió o ya no está: el chip pasa a aviso. */
  aviso?: boolean;
  /** Para el tooltip y el lector de pantalla. */
  detalle: string;
};

export function ChipDeEntrada({ origen, dato, rotulo, aviso = false, detalle }: Props) {
  return (
    <span
      className="rec-entrada"
      data-origen={origen}
      data-estado={aviso ? "aviso" : undefined}
      title={detalle}
      aria-label={`Entra de ${ROTULO[origen]}: ${detalle}`}
      role="note"
    >
      <i className="rec-entrada-punto" aria-hidden="true" />
      <span>{rotulo ?? ROTULO[origen]}</span>
      {dato ? <b>{dato}</b> : null}
    </span>
  );
}
