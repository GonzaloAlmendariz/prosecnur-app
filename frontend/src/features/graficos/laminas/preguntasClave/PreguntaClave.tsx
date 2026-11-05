// «Pregunta clave del estudio» en la tarjeta de datos del gráfico (H14 del checklist de usabilidad del editor). Escribe
// `plan.preguntas_clave` con `setPreguntasClave` del store: un paso deshacible que guarda el autosave. Un gráfico de una
// pregunta lleva un interruptor; uno de varias (multiapiladas con `vars`), uno por pregunta con su enunciado, porque en
// una batería no todas importan igual. Donde la tarjeta ya lista las preguntas con su nombre corto (una barra por
// pregunta, EtiquetasCortas.tsx), el interruptor va en esa fila y aquí no se repite la lista.
// Sólo los gráficos candidatos entran a la propuesta (motivoNoCuenta, espejo del motor). En los demás no se ofrece el
// interruptor: se dice por qué no cuenta. Si la pregunta ya estaba marcada, el interruptor sigue para poder quitarla.

import { useId } from "react";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { usePlanStore } from "../../store";
import { parseVarRef, useVariables } from "../../useVariables";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { preguntasConEtiqueta } from "../etiquetasPorPregunta";
import { useMotivoNoCuenta } from "./useMotivoNoCuenta";
import {
  AYUDA_CLAVE, conClave, conClaves, esClave, leerPreguntasClave, marcadasDe, preguntasDelGrafico, TEXTO_NO_CUENTA,
} from "./modeloPreguntasClave";
import "./preguntasClave.css";

type Props = { slideId: string; graficador: string; args: Readonly<Record<string, unknown>> };

export function PreguntaClave({ slideId, graficador, args }: Props) {
  const id = useId();
  // Se lee lo guardado tal cual (una referencia estable) y se normaliza fuera del selector.
  const guardadas = usePlanStore((s) => s.plan.preguntas_clave);
  const claves = leerPreguntasClave({ preguntas_clave: guardadas });
  const setPreguntasClave = usePlanStore((s) => s.setPreguntasClave);
  const { variables } = useVariables();
  const motivo = useMotivoNoCuenta(slideId, graficador, args);
  const refs = preguntasDelGrafico(graficador, args);
  if (!refs.length) return null;
  const marcar = (ref: string, v: boolean) => setPreguntasClave(conClave(claves, ref, v));
  const n = marcadasDe(claves, refs);

  if (motivo) {
    return (
      <div className="pulso-f6-dato is-apilado pulso-f6-clave" data-qa="pregunta-clave" data-clave-cuenta="no">
        {n > 0 ? (
          <PulsoSwitch size="sm" label={refs.length === 1 ? "Pregunta clave del estudio" : `Preguntas clave del estudio (${formatoConteo(n)})`}
            description={`${TEXTO_NO_CUENTA[motivo]} Apágalo para quitarla.`} checked onCheckedChange={() => setPreguntasClave(conClaves(claves, refs, false))} />
        ) : (
          <>
            <span className="pulso-f6-dato-rotulo">{refs.length === 1 ? "Pregunta clave del estudio" : "Preguntas clave del estudio"}</span>
            <span className="pulso-f6-dato-ayuda">{TEXTO_NO_CUENTA[motivo]}</span>
          </>
        )}
      </div>
    );
  }

  if (refs.length === 1) {
    const ref = refs[0];
    return (
      <div className="pulso-f6-dato is-apilado pulso-f6-clave" data-qa="pregunta-clave">
        <PulsoSwitch size="sm" label="Pregunta clave del estudio" description={AYUDA_CLAVE}
          checked={esClave(claves, ref)} onCheckedChange={(v) => marcar(ref, v)} />
      </div>
    );
  }

  // La lista «Nombre corto de cada pregunta» ya lleva un interruptor por fila.
  if (preguntasConEtiqueta(args).length) return null;
  const enunciado = (ref: string) => {
    const r = parseVarRef(ref);
    const v = variables.find((x) => x.name === r.name && (!r.source || x.source === r.source));
    return v?.label?.trim() || r.name;
  };
  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-clave" data-qa="pregunta-clave">
      <span className="pulso-f6-dato-rotulo" id={id}>
        Preguntas clave del estudio
        <span className="pulso-f6-clave-n">{n ? `${formatoConteo(n)} de ${formatoConteo(refs.length)}` : "Ninguna"}</span>
      </span>
      <ul className="pulso-f6-clave-lista" aria-labelledby={id}
        data-qa-geometry-group="graficos/f6-preguntas-clave" data-qa-geometry-contract="intrinsic">
        {refs.map((ref) => {
          const texto = enunciado(ref);
          return (
            <li key={ref} className="pulso-f6-clave-fila" data-qa-geometry-member>
              <PulsoSwitch size="sm" label={<span title={parseVarRef(ref).name}>{texto}</span>} ariaLabel={`Pregunta clave: ${texto}`}
                checked={esClave(claves, ref)} onCheckedChange={(v) => marcar(ref, v)} />
            </li>
          );
        })}
      </ul>
      <span className="pulso-f6-dato-ayuda">{AYUDA_CLAVE}</span>
    </div>
  );
}
