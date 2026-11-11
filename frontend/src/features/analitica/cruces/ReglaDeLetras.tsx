// La regla de las letras, en solo lectura. Con tablas, la que la prueba usó de
// verdad (`significancia_regla` de la vista previa). Sin ella (sin tablas, con
// la vista previa en error o sin ninguna comparación), la declarada del
// estudio, rotulada como declarada. Se cambia en Gráficos, Láminas, donde
// gobierna también las láminas y el Word (ADR 0128).

import { useNavigate } from "react-router-dom";

import type { CrucesPreviewRegla } from "../../../api/analitica";
import { PulsoButton } from "../../../components/PulsoButton";
import { DIRECCION_REGLA_ESTUDIO } from "../panes/reglaEstudioModel";
import { filasDeLaRegla, origenDeLaRegla } from "./crucesModelo";
import { ReglaDeclarada } from "./ReglaDeclarada";

export function ReglaDeLetras({ regla, ponderado, leyendo }: {
  regla: CrucesPreviewRegla | null;
  ponderado: boolean;
  /** La vista previa todavía no llegó: no se sabe qué regla se aplicó. */
  leyendo: boolean;
}) {
  const navegar = useNavigate();
  const origen = regla ? origenDeLaRegla(regla) : null;
  return (
    <div className="cruces-regla">
      {leyendo ? <p className="tablas-nota">Leyendo la regla aplicada</p> : null}
      {!leyendo && regla ? (
        <>
          <p className="cruces-regla-titulo">Regla aplicada</p>
          <dl className="cruces-regla-filas" aria-label="Regla aplicada">
            {origen ? <div><dt>Origen</dt><dd>{origen === "Propuesta" ? "Propuesta de la app; el estudio no declaró la suya" : "Declarada en el estudio"}</dd></div> : null}
            {filasDeLaRegla(regla, ponderado).map((f) => (
              <div key={f.rotulo}><dt>{f.rotulo}</dt><dd>{f.valor}</dd></div>
            ))}
          </dl>
        </>
      ) : null}
      {!leyendo && !regla ? (
        <>
          <p className="cruces-regla-titulo">Regla del estudio, sin aplicar en estas tablas</p>
          <ReglaDeclarada />
        </>
      ) : null}
      <PulsoButton variant="link" size="sm" nav onClick={() => navegar(DIRECCION_REGLA_ESTUDIO)}>
        Cambiar la regla del estudio
      </PulsoButton>
    </div>
  );
}
