// Líneas y partes del total de «Línea por nivel» (p_lineas_nivel): antes se escribían a mano en el plan. Cada fila es
// un rótulo y las respuestas de la pregunta que cuentan, marcadas como fichas (SelectorCategorias). Una fila incompleta
// se queda en la tarjeta con su aviso y no se guarda: el motor la rechazaría. Lo que la tarjeta no edita (`y`, `color`)
// se conserva y se lee en una nota.

import { useRef, useState, type ReactNode } from "react";
import { Plus, X } from "../../../vendor/lucide-react";
import { SelectorCategorias } from "./SelectorCategorias";
import {
  avisoParte,
  codigosATexto,
  filasAPartes,
  MAX_LINEAS_NIVEL,
  mismasPartes,
  notaParte,
  partesAFilas,
  textoACodigos,
  type FilaParte,
} from "./argsDatosGrafico";

type Props = {
  id: string;
  /** `series` o `segmentos_total`. */
  arg: string;
  etiqueta: ReactNode;
  nota: ReactNode;
  valor: unknown;
  /** Pregunta calificada (`base$var`) cuyas respuestas se marcan; vacía si aún no se eligió. */
  variable: string;
  scope: "active" | "consolidated";
  graficador: string;
  onCambio: (v: Record<string, unknown>[] | null) => void;
};

export function PartesLineas({ id, arg, etiqueta, nota, valor, variable, scope, graficador, onCambio }: Props) {
  const [borrador, setBorrador] = useState<FilaParte[]>(() => partesAFilas(valor));
  const siguiente = useRef(0);
  // Cambió afuera (deshacer, el plan): manda lo guardado.
  const filas = mismasPartes(valor, borrador, arg) ? borrador : partesAFilas(valor);
  if (filas !== borrador) setBorrador(filas);

  const esLinea = arg === "series";
  const nombre = esLinea ? "línea" : "parte";
  const lleno = esLinea && filas.length >= MAX_LINEAS_NIVEL;
  const aplicar = (nuevas: FilaParte[]) => {
    setBorrador(nuevas);
    if (!mismasPartes(valor, nuevas, arg)) onCambio(filasAPartes(nuevas, arg));
  };
  const cambiar = (i: number, parche: Partial<Pick<FilaParte, "rotulo" | "codigos">>) =>
    aplicar(filas.map((f, k) => (k === i ? { ...f, ...parche } : f)));

  return (
    <div className="pulso-f6-dato is-apilado" data-campo={arg} data-qa="partes-lineas">
      {etiqueta}
      <div id={id} className="pulso-f6-criterios" data-qa-geometry-group="graficos/f6-partes" data-qa-geometry-contract="intrinsic">
        {filas.map((f, i) => {
          const n = i + 1;
          const aviso = avisoParte(f, i, arg);
          const soloLectura = notaParte(f);
          const respaldo = (
            <input className="pulso-f6-input" value={codigosATexto(f.codigos)} placeholder="Códigos, p. ej. 1, 2"
              aria-label={`Respuestas de la ${nombre} ${n}`} onChange={(e) => cambiar(i, { codigos: textoACodigos(e.target.value) })} />
          );
          return (
            <div key={f.clave} className="pulso-f6-criterio" role="group" aria-label={`${esLinea ? "Línea" : "Parte"} ${n}`}>
              <div className="pulso-f6-criterio-cabecera">
                <input className="pulso-f6-input" value={f.rotulo} placeholder={esLinea ? "Rótulo de la línea" : "Rótulo de la parte"}
                  aria-label={`Rótulo de la ${nombre} ${n}`} onChange={(e) => cambiar(i, { rotulo: e.target.value })} />
                <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Quitar la ${nombre} ${f.rotulo.trim() || n}`}
                  onClick={() => aplicar(filas.filter((_, k) => k !== i))}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <SelectorCategorias id={`${id}-${f.clave}`} variable={variable} scope={scope} graficador={graficador} valor={f.codigos} modo="elegir"
                etiqueta={<span className="pulso-f6-dato-ayuda">Respuestas que cuentan</span>}
                textoRespaldo={respaldo} nota={null} onCambio={(codigos) => cambiar(i, { codigos })} />
              {soloLectura && <span className="pulso-f6-dato-ayuda is-nota">{soloLectura}</span>}
              {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
            </div>
          );
        })}
        <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" data-qa-geometry-capacity="owned" disabled={lleno}
          onClick={() => {
            siguiente.current += 1;
            aplicar([...filas, { clave: `nueva-${siguiente.current}`, rotulo: "", codigos: [], resto: {} }]);
          }}>
          <Plus size={14} aria-hidden="true" /> {lleno ? "Ya hay tres líneas" : `Agregar ${nombre}`}
        </button>
      </div>
      {nota}
    </div>
  );
}
