// Rótulos cortos de los grupos en las tarjetas de diferencias (`cortos`: «Economía y Finanzas» → «Econ. y Finanzas»).
// Cada fila es un grupo y su rótulo corto; el grupo se sugiere con las categorías de los cruces elegidos. Una fila
// incompleta se queda en la tarjeta con su aviso y no se guarda (patrón de PartesLineas).

import { useId, useRef, useState } from "react";
import { ArrowRight, Plus, X } from "../../../../vendor/lucide-react";
import { varCalificada } from "../ordenCategorias";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import { avisoCorto, cortosAFilas, filasACortos, mismosCortos, type FilaCorto, type ValorTarjetas } from "./modeloTarjetas";

type Props = {
  valor: ValorTarjetas;
  /** Cruces elegidos: sus categorías son las sugerencias del grupo. */
  cruces: readonly string[];
  scope: "active" | "consolidated";
  baseActiva: string | null | undefined;
  onCambio: (cortos: Record<string, string>) => void;
};

export function CortosGrupos({ valor, cruces, scope, baseActiva, onCambio }: Props) {
  const id = useId();
  const listaId = `${id}-grupos`;
  const [borrador, setBorrador] = useState<FilaCorto[]>(() => cortosAFilas(valor));
  const siguiente = useRef(0);
  // Cambió afuera (deshacer, el plan): manda lo guardado.
  const filas = mismosCortos(valor, borrador) ? borrador : cortosAFilas(valor);
  if (filas !== borrador) setBorrador(filas);

  const aplicar = (nuevas: FilaCorto[]) => {
    setBorrador(nuevas);
    if (!mismosCortos(valor, nuevas)) onCambio(filasACortos(nuevas));
  };
  const cambiar = (i: number, parche: Partial<Pick<FilaCorto, "grupo" | "corto">>) =>
    aplicar(filas.map((f, k) => (k === i ? { ...f, ...parche } : f)));

  return (
    <div className="pulso-f6-dato is-apilado" data-qa="tarjetas-cortos" data-qa-geometry-member="">
      <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>Rótulos cortos</span>
      <div className="pulso-f6-criterios" role="group" aria-labelledby={`${id}-rotulo`} aria-describedby={`${id}-ayuda`}
        data-qa-geometry-group="graficos/f6-tarjetas-cortos" data-qa-geometry-contract="intrinsic">
        {filas.map((f, i) => {
          const n = i + 1;
          const aviso = avisoCorto(f, filas);
          return (
            <div key={f.clave} className="pulso-tarjetas-corto" role="group" aria-label={`Rótulo corto ${n}`}>
              <input className="pulso-f6-input" value={f.grupo} placeholder="Grupo" list={listaId} title={f.grupo || undefined}
                aria-label={`Grupo ${n}`} onChange={(e) => cambiar(i, { grupo: e.target.value })} />
              <ArrowRight size={14} aria-hidden="true" className="pulso-tarjetas-corto-flecha" />
              <input className="pulso-f6-input" value={f.corto} placeholder="Corto"
                aria-label={`Rótulo corto del grupo ${f.grupo.trim() || n}`} onChange={(e) => cambiar(i, { corto: e.target.value })} />
              <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Quitar el rótulo corto ${f.grupo.trim() || n}`}
                onClick={() => aplicar(filas.filter((_, k) => k !== i))}>
                <X size={14} aria-hidden="true" />
              </button>
              {aviso && <span className="pulso-f6-dato-ayuda is-aviso pulso-tarjetas-corto-aviso" role="note">{aviso}</span>}
            </div>
          );
        })}
        <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" data-qa-geometry-capacity="owned"
          onClick={() => {
            siguiente.current += 1;
            aplicar([...filas, { clave: `nuevo-${siguiente.current}`, grupo: "", corto: "" }]);
          }}>
          <Plus size={14} aria-hidden="true" /> Agregar rótulo corto
        </button>
      </div>
      <datalist id={listaId}>
        {cruces.map((ref) => <GruposDeCruce key={ref} variable={varCalificada(ref, baseActiva, scope)} scope={scope} />)}
      </datalist>
      <span id={`${id}-ayuda`} className="pulso-f6-dato-ayuda">
        {filas.length ? "El grupo, tal como sale en la lámina." : "Para un grupo de nombre largo, p. ej. «Econ. y Finanzas»."}
      </span>
    </div>
  );
}

/** Las categorías de un cruce como sugerencias del grupo (sin lista o con error, ninguna: se escribe a mano). */
function GruposDeCruce({ variable, scope }: { variable: string; scope: "active" | "consolidated" }) {
  const estado = useCategoriasGrafico(variable, scope);
  if (estado.fase !== "lista") return null;
  return <>{estado.datos.categorias.filter((c) => c.etiqueta).map((c) => <option key={c.codigo} value={c.etiqueta} />)}</>;
}
