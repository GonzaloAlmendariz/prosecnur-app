// La evidencia del par activo en «Revisar emparejado» (X6): los dos textos completos lado a lado, un público por
// columna, con las palabras que no comparten marcadas (diffPalabras.ts), y la coincidencia con su puntaje.

import type { PreguntaDeBase } from "../../../../api/graficosEmparejado";
import { nombrePublico } from "../../multiapiladas/temasPublicos";
import { ChipCoincidencia } from "./ChipCoincidencia";
import { textoPuntaje, type CoincidenciaDePar } from "./coincidencia";
import { diffPorPalabra, type Trozo } from "./diffPalabras";
import type { FilaEmparejado } from "./modeloEmparejado";

type Props = {
  fila: FilaEmparejado;
  bases: readonly string[];
  coincidencia: CoincidenciaDePar | null;
};

function lado(fila: FilaEmparejado, base: string): PreguntaDeBase | null {
  if (fila.pregunta.base === base) return fila.pregunta;
  return fila.par?.base === base ? fila.par : null;
}

function Texto({ trozos }: { trozos: readonly Trozo[] }) {
  return (
    <span className="pulso-f6-emp-evid-texto">
      {trozos.map((t, k) => (t.distinto ? <mark key={k} className="pulso-f6-emp-dif">{t.texto}</mark> : <span key={k}>{t.texto}</span>))}
    </span>
  );
}

export function EvidenciaPar({ fila, bases, coincidencia }: Props) {
  const preguntas = bases.map((b) => lado(fila, b));
  const [qa, qb] = preguntas;
  const diff = qa && qb ? diffPorPalabra(qa.etiqueta, qb.etiqueta) : null;
  const trozosDe = (k: number, q: PreguntaDeBase): Trozo[] => (diff ? (k === 0 ? diff.a : diff.b) : [{ texto: q.etiqueta, distinto: false }]);
  return (
    <section
      className="pulso-f6-emp-evidencia"
      aria-label="Evidencia del par"
      data-qa-geometry-group="graficos/emparejado-evidencia"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-f6-emp-evid-cabeza" data-qa-geometry-member>
        <ChipCoincidencia coincidencia={coincidencia} />
        {coincidencia ? <span className="pulso-f6-emp-evid-puntaje">{textoPuntaje(coincidencia.puntaje)}</span> : null}
      </div>
      <div className="pulso-f6-emp-evid-textos" data-qa-geometry-member>
        {bases.map((base, k) => {
          const q = preguntas[k];
          return (
            <div key={base} className="pulso-f6-emp-evid-lado">
              <span className="pulso-f6-emp-evid-publico">
                {nombrePublico(base)}
                {q ? <span className="pulso-f6-emp-codigo">{q.var}</span> : null}
              </span>
              {q ? <Texto trozos={trozosDe(k, q)} /> : <span className="pulso-f6-emp-sin">Sin par</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
