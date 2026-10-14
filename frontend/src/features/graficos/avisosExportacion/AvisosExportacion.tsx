import { useState } from "react";
import { Alert } from "../../../components/Alert";
import { agruparAvisos } from "./avisosExportacionModel";
import "./avisosExportacion.css";

/** Cuántas láminas se ven antes de plegar el resto: el aviso no debe empujar el editor fuera de la pantalla. */
const VISIBLES = 3;

export function AvisosExportacion({ avisos }: { avisos: readonly string[] }) {
  const [abierto, setAbierto] = useState(false);
  const grupos = agruparAvisos(avisos);
  if (!grupos.length) return null;
  const total = grupos.reduce((s, g) => s + g.detalles.length, 0);
  const mostrados = abierto ? grupos : grupos.slice(0, VISIBLES);
  const conLamina = grupos.filter((g) => g.lamina).length;
  return (
    <Alert kind="warn">
      <div className="pulso-avexp">
        <strong className="pulso-avexp-titulo">
          {total === 1 ? "1 aviso antes de exportar" : `${total} avisos antes de exportar`}
          {conLamina > 0 ? ` · ${conLamina === 1 ? "1 lámina" : `${conLamina} láminas`}` : ""}
        </strong>
        <ul className="pulso-avexp-grupos">
          {mostrados.map((g) => (
            <li key={g.clave} className="pulso-avexp-grupo">
              <span className="pulso-avexp-lamina">
                {g.lamina ? <>Lámina {g.lamina}{g.titulo ? <span className="pulso-avexp-nombre"> · {g.titulo}</span> : null}</> : "Informe"}
              </span>
              <ul className="pulso-avexp-detalles">
                {g.detalles.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </li>
          ))}
        </ul>
        {grupos.length > VISIBLES && (
          <button type="button" className="pulso-avexp-mas" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
            {abierto ? "Ver menos" : `Ver las otras ${grupos.length - VISIBLES} láminas`}
          </button>
        )}
      </div>
    </Alert>
  );
}
