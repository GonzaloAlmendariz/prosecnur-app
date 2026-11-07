// «Públicos» en Datos de un gráfico de resumen (Q2-11; ADR 0135 §2): una ficha por `base$*` («Docentes, todas las de
// escala») que se mueve antes o después, se quita y se agrega. El orden es el de las filas del panorama. Las preguntas
// sueltas se conservan y se ajustan en la lista de la regla.

import { ArrowDown, ArrowUp, X } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { useVariables } from "../../useVariables";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import { publicoEnFrase } from "../mazoResumen/modeloMazo";
import { conPublicos, maxPublicos, moverPublicoEn, publicosDe, sueltasDe } from "./modeloPublicos";
import "./publicosGrafico.css";

type Props = {
  id: string;
  graficador: string;
  valor: unknown;
  describe?: string;
  onCambio: (v: string[]) => void;
};

export function PublicosGrafico({ id, graficador, valor, describe, onCambio }: Props) {
  const { sources } = useVariables();
  const publicos = publicosDe(valor);
  const sueltas = sueltasDe(valor).length;
  const tope = maxPublicos(graficador);
  const libres = sources.map((s) => s.name).filter((b) => !publicos.includes(b));
  const nombre = (b: string) => nombrePublico(publicoEnFrase(b));
  const poner = (lista: readonly string[]) => onCambio(conPublicos(valor, lista));
  const uno = tope === 1;

  return (
    <div id={id} className="pulso-f6-publicos" aria-describedby={describe}
      data-qa-geometry-group="graficos/f6-publicos" data-qa-geometry-contract="intrinsic">
      <ol className="pulso-f6-publicos-lista" aria-label="Públicos del gráfico">
        {publicos.map((b, i) => (
          <li key={b} className="pulso-f6-publicos-ficha" data-qa-geometry-member>
            <span className="pulso-f6-publicos-nombre">
              <strong>{nombre(b)}</strong>
              <span>todas las de escala</span>
            </span>
            {publicos.length > 1 && (
              <>
                <PulsoButton variant="icon" size="sm" aria-label={`Mover ${nombre(b)} antes`} disabled={i === 0}
                  onClick={() => poner(moverPublicoEn(publicos, i, -1))}>
                  <ArrowUp size={13} aria-hidden="true" />
                </PulsoButton>
                <PulsoButton variant="icon" size="sm" aria-label={`Mover ${nombre(b)} después`} disabled={i === publicos.length - 1}
                  onClick={() => poner(moverPublicoEn(publicos, i, 1))}>
                  <ArrowDown size={13} aria-hidden="true" />
                </PulsoButton>
                <PulsoButton variant="icon" size="sm" intent="remove" aria-label={`Quitar ${nombre(b)}`}
                  onClick={() => poner(publicos.filter((x) => x !== b))}>
                  <X size={13} aria-hidden="true" />
                </PulsoButton>
              </>
            )}
          </li>
        ))}
      </ol>
      {libres.length > 0 && (uno || publicos.length < tope) && (
        <PulsoSelect size="sm" value={undefined} ariaLabel={uno ? "Cambiar de público" : "Agregar público"}
          placeholder={uno ? "Cambiar de público" : "Agregar público"}
          onValueChange={(b) => poner(uno ? [b] : [...publicos, b])}
          options={libres.map((b) => ({ value: b, label: nombre(b), textValue: nombre(b) }))} />
      )}
      {sueltas > 0 && (
        <span className="pulso-f6-dato-ayuda">
          {`${sueltas === 1 ? "Además, 1 pregunta suelta" : `Además, ${formatoConteo(sueltas)} preguntas sueltas`}: se ajustan en la regla`}
        </span>
      )}
    </div>
  );
}
