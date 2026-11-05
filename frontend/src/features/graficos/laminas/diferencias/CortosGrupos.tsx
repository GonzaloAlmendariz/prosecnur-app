// Nombre corto de un grupo en las tarjetas de diferencias (`cortos`: «Economía y Finanzas» → «Econ. y Finanzas»).
// Cada fila es un grupo y su nombre corto; el grupo se sugiere con las categorías de los cruces elegidos. Una fila
// incompleta se queda en la tarjeta con su aviso y no se guarda (patrón de PartesLineas).
//
// H1b (checklist de usabilidad, 2026-11-05): la ayuda dice cuándo lo usa el motor. En la tarjeta de siempre el nombre va
// completo encima de su barra y el corto sólo entra si no cabe (`.tarjetas_rotulo_grupo`, más de 60 letras); la tarjeta
// compacta (lámina de dos gráficos, desglose en línea), el resumen de diferencias y los hallazgos lo usan siempre.
// No se confunde con los rótulos cortos del estudio (Identidad), que acortan respuestas: se enlaza allá.

import { useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Plus, X } from "../../../../vendor/lucide-react";
import { varCalificada } from "../ordenCategorias";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import { searchDePiezaIdentidad } from "../../estilo/direccionIdentidad";
import "../datosGrafico.css";
import { avisoCorto, cortosAFilas, filasACortos, mismosCortos, type FilaCorto, type ValorTarjetas } from "./modeloTarjetas";

type Props = {
  valor: ValorTarjetas;
  /** Cruces elegidos: sus categorías son las sugerencias del grupo. */
  cruces: readonly string[];
  scope: "active" | "consolidated";
  baseActiva: string | null | undefined;
  onCambio: (cortos: Record<string, string>) => void;
  /** «tarjetas»: el corto sólo entra si el nombre no cabe. «siempre»: la lámina lo usa en vez del nombre. */
  uso?: UsoCorto;
};

export type UsoCorto = "tarjetas" | "siempre";

/** Cuándo usa el motor el nombre corto, dicho en una línea. */
export const AYUDA_USO_CORTO: Readonly<Record<UsoCorto, string>> = {
  tarjetas: "Se usa cuando el nombre no cabe en la tarjeta. En la lámina de dos gráficos y en el resumen de diferencias, siempre.",
  siempre: "Esta lámina lo usa siempre en lugar del nombre.",
};

export function CortosGrupos({ valor, cruces, scope, baseActiva, onCambio, uso = "tarjetas" }: Props) {
  const id = useId();
  const loc = useLocation();
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
      <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>Nombre corto de un grupo</span>
      <div className="pulso-f6-criterios" role="group" aria-labelledby={`${id}-rotulo`} aria-describedby={`${id}-ayuda`}
        data-qa-geometry-group="graficos/f6-tarjetas-cortos" data-qa-geometry-contract="intrinsic">
        {filas.map((f, i) => {
          const n = i + 1;
          const aviso = avisoCorto(f, filas);
          return (
            <div key={f.clave} className="pulso-tarjetas-corto" role="group" aria-label={`Nombre corto ${n}`}>
              <input className="pulso-f6-input" value={f.grupo} placeholder="Grupo" list={listaId} title={f.grupo || undefined}
                aria-label={`Grupo ${n}`} onChange={(e) => cambiar(i, { grupo: e.target.value })} />
              <ArrowRight size={14} aria-hidden="true" className="pulso-tarjetas-corto-flecha" />
              <input className="pulso-f6-input" value={f.corto} placeholder="Corto"
                aria-label={`Nombre corto del grupo ${f.grupo.trim() || n}`} onChange={(e) => cambiar(i, { corto: e.target.value })} />
              <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Quitar el nombre corto ${f.grupo.trim() || n}`}
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
          <Plus size={14} aria-hidden="true" /> Agregar nombre corto
        </button>
      </div>
      <datalist id={listaId}>
        {cruces.map((ref) => <GruposDeCruce key={ref} variable={varCalificada(ref, baseActiva, scope)} scope={scope} />)}
      </datalist>
      {/* Una sola ayuda (C1: dos ayudas hermanas son una colección sin contrato): cuándo se usa y adónde ir por las respuestas. */}
      <span id={`${id}-ayuda`} className="pulso-f6-dato-ayuda">
        {AYUDA_USO_CORTO[uso]} Las respuestas se acortan en{" "}
        <Link className="pulso-f6-enlace-ayuda" to={{ pathname: loc.pathname, search: searchDePiezaIdentidad(loc.search, "rotulos") }}>
          Rótulos cortos del estudio
        </Link>.
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
