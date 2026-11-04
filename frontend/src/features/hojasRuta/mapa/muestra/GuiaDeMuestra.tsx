import { PulsoButton } from "../../../../components/PulsoButton";
import { consejosDeMuestra, CRITERIOS_ESTADISTICOS, recomendacionDeff } from "./criteriosDeMuestra";
import "./guiaDeMuestra.css";

type Props = {
  entrevistasPorManzana: number;
  supuestos: { margenTotal: number; p: number; deff: number; respuesta: number };
  deshabilitado: boolean;
  onUsarDeff: (deff: number) => void;
};

/**
 * P7: la lectura de los supuestos que tenía la clásica. La recomendación de DEFF según la carga por
 * manzana (con «Usar»), los semáforos de cada supuesto y el resumen de criterios. Todo plegado: es
 * apoyo para decidir, no un paso más.
 */
export function GuiaDeMuestra({ entrevistasPorManzana, supuestos, deshabilitado, onUsarDeff }: Props) {
  const rec = recomendacionDeff(entrevistasPorManzana);
  const usado = Math.abs(supuestos.deff - rec.deff) < 0.001;
  return (
    <details className="hr-muestra-decision">
      <summary>Guía de decisión</summary>
      <div className="hr-muestra-decision-rec">
        <small>Lectura de Prosecnur, {entrevistasPorManzana} {entrevistasPorManzana === 1 ? "entrevista" : "entrevistas"} por manzana</small>
        <strong>{rec.titulo}</strong>
        <p>{rec.texto}</p>
        <PulsoButton variant="secondary" size="sm" disabled={deshabilitado || usado} onClick={() => onUsarDeff(rec.deff)}>
          {usado ? `DEFF ${rec.deff.toLocaleString("es-PE", { minimumFractionDigits: 1 })} en uso` : `Usar DEFF ${rec.deff.toLocaleString("es-PE", { minimumFractionDigits: 1 })}`}
        </PulsoButton>
      </div>
      <ul className="hr-muestra-decision-consejos" aria-label="Semáforo de los supuestos">
        {consejosDeMuestra(supuestos).map((c) => (
          <li key={c.id} data-tono={c.tono}>
            <span><b>{c.etiqueta}</b> {c.valor}</span>
            <small>{c.texto}</small>
          </li>
        ))}
      </ul>
      <dl className="hr-mapa-filas" aria-label="Criterios estadísticos usados">
        {CRITERIOS_ESTADISTICOS.map((c) => (
          <div key={c.titulo}>
            <dt>{c.titulo}</dt>
            <dd>{c.texto}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
