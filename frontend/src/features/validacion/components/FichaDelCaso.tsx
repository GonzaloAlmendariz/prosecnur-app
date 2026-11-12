// "Ficha del caso" en "Cómo se identifica un caso": el número de encuesta y
// quién digitó la ficha. Con ellos la tabla de casos de Hallazgos y el caso
// completo dicen qué ficha física buscar. No son la llave del caso: no cambian
// cómo se guardan las decisiones.
import { useEffect, useState } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { pedirInventario } from "../inventarioDeBase";
import { CampoPregunta } from "../reglas/campos/CampoPregunta";
import type { ExploradorVariable, InstrumentoOperationalConfig } from "../types";

type Identidad = InstrumentoOperationalConfig["identity"];
type CambioDeFicha = Partial<Pick<Identidad, "survey_number_variable" | "typist_variable">>;

export function FichaDelCaso({
  baseNombre,
  numero,
  digitador,
  onChange,
  disabled,
}: {
  baseNombre?: string | null;
  numero: string;
  digitador: string;
  onChange: (cambio: CambioDeFicha) => void;
  disabled?: boolean;
}) {
  const [variables, setVariables] = useState<ExploradorVariable[]>([]);
  useEffect(() => {
    let vivo = true;
    // Sin la lista de preguntas los selectores quedan vacíos; lo ya declarado se sigue viendo.
    pedirInventario(baseNombre)
      .then((inv) => { if (vivo) setVariables(inv.secciones.flatMap((s) => s.variables)); })
      .catch(() => { if (vivo) setVariables([]); });
    return () => { vivo = false; };
  }, [baseNombre]);

  const filas: Array<{ rotulo: string; quitar: string; valor: string; clave: keyof CambioDeFicha }> = [
    { rotulo: "Número de encuesta", quitar: "Quitar el número de encuesta", valor: numero, clave: "survey_number_variable" },
    { rotulo: "Digitador", quitar: "Quitar el digitador", valor: digitador, clave: "typist_variable" },
  ];
  return (
    <div className="pulso-rol-ficha">
      {filas.map((f) => (
        <div key={f.clave} className="pulso-rol-ficha-fila">
          <span className="pulso-rol-ficha-rotulo">{f.rotulo}</span>
          <fieldset className="pulso-rol-ficha-campo" disabled={disabled}>
            <CampoPregunta variables={variables} valor={f.valor} ariaLabel={f.rotulo} onCambio={(v) => onChange({ [f.clave]: v })} />
          </fieldset>
          {f.valor ? (
            <PulsoButton variant="ghost" size="sm" aria-label={f.quitar} disabled={disabled} onClick={() => onChange({ [f.clave]: "" })}>
              Quitar
            </PulsoButton>
          ) : null}
        </div>
      ))}
    </div>
  );
}
