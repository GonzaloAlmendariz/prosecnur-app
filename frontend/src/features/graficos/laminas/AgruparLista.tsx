// «Agrupar en la lista» del mapa de distribución (modeloAgruparLista.ts): cada fila es un rótulo y las preguntas del propio
// mapa (`var` y `juntar`) cuyas áreas suma, marcadas como fichas. Nunca se escribe un nombre de variable ni JSON: se
// guarda la lista con nombre que lee el motor. Una fila incompleta se queda en la tarjeta con su aviso y no se guarda.

import { useRef, useState, type ReactNode } from "react";
import { Plus, X } from "../../../vendor/lucide-react";
import { parseVarRef, useVariables } from "../useVariables";
import { leerEtiquetaCorta } from "./argsDatosGrafico";
import {
  alternarPregunta,
  avisoGrupo,
  filasAGrupos,
  grupoConPregunta,
  gruposAFilas,
  mismosGrupos,
  nombrePregunta,
  preguntasDelMapa,
  preguntasFuera,
  quedanLibres,
  type GrupoLista,
} from "./modeloAgruparLista";

type Props = {
  id: string;
  etiqueta: ReactNode;
  nota: ReactNode;
  valor: unknown;
  /** Los args del mapa: de ahí salen las preguntas que se pueden marcar. */
  args: Readonly<Record<string, unknown>>;
  onCambio: (v: Record<string, string[]> | null) => void;
};

export function AgruparLista({ id, etiqueta, nota, valor, args, onCambio }: Props) {
  const { variables } = useVariables();
  const delMapa = preguntasDelMapa(args);
  const [borrador, setBorrador] = useState<GrupoLista[]>(() => gruposAFilas(valor));
  const siguiente = useRef(0);
  // Cambió afuera (deshacer, el plan): manda lo guardado.
  const filas = mismosGrupos(valor, borrador, delMapa) ? borrador : gruposAFilas(valor);
  if (filas !== borrador) setBorrador(filas);

  const rotuloDe = (ref: string) => {
    const corta = leerEtiquetaCorta(args, ref) || leerEtiquetaCorta(args, nombrePregunta(ref));
    if (corta) return corta;
    const r = parseVarRef(ref);
    const v = variables.find((x) => x.name === r.name && (!r.source || x.source === r.source));
    return v?.label?.trim() || r.name;
  };
  const aplicar = (nuevas: GrupoLista[]) => {
    setBorrador(nuevas);
    if (!mismosGrupos(valor, nuevas, delMapa)) onCambio(filasAGrupos(nuevas, delMapa));
  };
  const libres = quedanLibres(filas, delMapa);

  return (
    <div className="pulso-f6-dato is-apilado" data-campo="agrupar_lista" data-qa="agrupar-lista">
      {etiqueta}
      <div id={id} className="pulso-f6-criterios" role="group" aria-label="Filas agrupadas" data-qa-geometry-group="graficos/f6-agrupar-lista" data-qa-geometry-contract="intrinsic">
        {filas.map((f, i) => {
          const n = i + 1;
          const aviso = avisoGrupo(filas, i, delMapa);
          const fuera = preguntasFuera(f, delMapa);
          const nombreFila = f.rotulo.trim() || `${n}`;
          return (
            <div key={f.clave} className="pulso-f6-criterio" role="group" aria-label={`Fila agrupada ${nombreFila}`}>
              <div className="pulso-f6-criterio-cabecera">
                <input className="pulso-f6-input" value={f.rotulo} placeholder="Rótulo de la fila, p. ej. Callao"
                  aria-label={`Rótulo de la fila agrupada ${n}`}
                  onChange={(e) => aplicar(filas.map((x, k) => (k === i ? { ...x, rotulo: e.target.value } : x)))} />
                <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Quitar la fila agrupada ${nombreFila}`}
                  onClick={() => aplicar(filas.filter((_, k) => k !== i))}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <span className="pulso-f6-dato-rotulo">Suma las áreas de</span>
              <div className="pulso-f6-cats is-elegir" role="group" aria-label={`Preguntas de la fila ${nombreFila}`}>
                {[...delMapa, ...fuera].map((ref) => {
                  const marcada = f.preguntas.some((p) => nombrePregunta(p) === nombrePregunta(ref));
                  const otra = marcada ? null : grupoConPregunta(filas, i, ref);
                  const esFuera = fuera.includes(ref);
                  const titulo = esFuera
                    ? "El mapa ya no lee esta pregunta. Pulsa para quitarla."
                    : otra ? `Ya suma en “${otra.rotulo.trim() || "otra fila"}”.` : rotuloDe(ref);
                  return (
                    <button key={ref} type="button" className={`pulso-f6-cat${marcada ? " is-activa" : ""}${esFuera ? " is-residual" : ""}`}
                      aria-pressed={marcada} aria-disabled={otra ? true : undefined} title={titulo}
                      onClick={() => aplicar(alternarPregunta(filas, i, ref))}>
                      <span className="pulso-f6-cat-texto">{rotuloDe(ref)}</span>
                    </button>
                  );
                })}
              </div>
              {aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{aviso}</span>}
            </div>
          );
        })}
        <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" data-qa-geometry-capacity="owned" disabled={!libres}
          onClick={() => {
            siguiente.current += 1;
            aplicar([...filas, { clave: `nueva-${siguiente.current}`, rotulo: "", preguntas: [] }]);
          }}>
          <Plus size={14} aria-hidden="true" /> {libres ? "Agregar fila agrupada" : "Todas las preguntas ya suman en una fila"}
        </button>
      </div>
      {nota}
    </div>
  );
}
