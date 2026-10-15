// Cifra destacada en su tarjeta (pedido de Gonzalo, 2026-10-15: «todo este menú puede verse muchísimo mejor»). La
// tarjeta genérica pedía la categoría como código («1»), no dejaba editar el rótulo, el detalle ni la unidad —que son
// el texto de la cifra— y ofrecía una «Etiqueta corta» que la cifra no usa. Aquí: qué cifra según el tipo de pregunta
// (con opciones, porcentaje o respuestas; sin opciones, media o mediana), la categoría elegida de la lista y el texto
// que acompaña al número. El valor no se adelanta en la tarjeta: lo calcula el motor con el peso y se ve en la lámina.

import { useId } from "react";
import { Segmentado } from "../subpestanas/Segmentado";
import { useCategoriasGrafico } from "./useCategoriasGrafico";
import { MODOS_CIFRA, modosCifraDisponibles, type ModoCifra } from "./modeloCifra";
import "./cifraGrafico.css";

type Props = {
  args: Record<string, unknown>;
  /** Pregunta calificada (`base$var`); vacía si aún no se eligió. */
  variable: string;
  scope: "active" | "consolidated";
  onCambio: (patch: Record<string, unknown>) => void;
};

const texto = (v: unknown) => (typeof v === "string" ? v : "");

export function CifraGrafico({ args, variable, scope, onCambio }: Props) {
  const id = useId();
  const estado = useCategoriasGrafico(variable, scope, "p_cifra");
  const modo = (MODOS_CIFRA.some((m) => m.clave === args.modo) ? args.modo : "porcentaje") as ModoCifra;
  const conLista = estado.fase === "lista" ? true : estado.fase === "sin_lista" ? false : null;
  const opciones = modosCifraDisponibles(conLista, modo);
  const categoria = args.categoria === undefined || args.categoria === null ? "" : String(args.categoria);
  const cats = estado.fase === "lista" ? estado.datos.categorias : [];
  const deMedida = modo === "media" || modo === "mediana";

  return (
    <div className="pulso-f6-cifra" data-qa-geometry-group="graficos/f6-cifra" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo" aria-hidden="true">Qué cifra</span>
        <Segmentado etiqueta="Qué cifra" opciones={opciones} valor={modo} onCambiar={(m) => onCambio({ modo: m })} />
      </div>

      {modo === "porcentaje" && (
        <div className="pulso-f6-dato is-apilado">
          <span className="pulso-f6-dato-rotulo" id={`${id}-cat`}>Respuesta que se cuenta</span>
          {!variable ? (
            <span className="pulso-f6-dato-ayuda">Elige primero la pregunta.</span>
          ) : estado.fase === "cargando" ? (
            <span className="pulso-f6-dato-ayuda" role="status">Leyendo las respuestas de la pregunta</span>
          ) : cats.length ? (
            <div className="pulso-f6-cifra-cats" role="group" aria-labelledby={`${id}-cat`}>
              {cats.map((c) => {
                const activa = c.codigo === categoria;
                return (
                  <button key={c.codigo} type="button" aria-pressed={activa}
                    className={`pulso-f6-cifra-cat${activa ? " is-activa" : ""}${c.residual ? " is-residual" : ""}`}
                    onClick={() => onCambio({ categoria: c.codigo })}>
                    <span className="pulso-f6-cifra-cat-marca" aria-hidden="true" />
                    <span className="pulso-f6-cifra-cat-texto">{c.etiqueta || c.codigo}</span>
                    {Number.isFinite(c.n) && <span className="pulso-f6-cifra-cat-n">{c.n}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <input className="pulso-f6-input" aria-labelledby={`${id}-cat`} value={categoria} placeholder="Código de la respuesta"
              onChange={(e) => onCambio({ categoria: e.target.value })} />
          )}
          {cats.length > 0 && <span className="pulso-f6-dato-ayuda">El porcentaje es sobre quienes respondieron, con el peso del estudio.</span>}
        </div>
      )}

      <div className="pulso-f6-cifra-textos" role="group" aria-label="Texto de la cifra" data-qa-geometry-group="graficos/f6-cifra-textos" data-qa-geometry-contract="intrinsic">
        <Campo rotulo="Rótulo" valor={texto(args.rotulo)} placeholder="Vacío, se arma desde la pregunta"
          ayuda="Lo que dice la cifra, debajo del número." onCambio={(t) => onCambio({ rotulo: t || null })} />
        {deMedida && (
          <Campo rotulo="Unidad" valor={texto(args.unidad)} placeholder="horas, años, cursos" corto
            onCambio={(t) => onCambio({ unidad: t || null })} />
        )}
        <Campo rotulo="Detalle" valor={texto(args.detalle)} placeholder="Vacío, la base de respuestas"
          ayuda="La línea gris del final." onCambio={(t) => onCambio({ detalle: t || null })} />
      </div>
    </div>
  );
}

function Campo({ rotulo, valor, placeholder, ayuda, corto, onCambio }: {
  rotulo: string; valor: string; placeholder: string; ayuda?: string; corto?: boolean; onCambio: (t: string) => void;
}) {
  const id = useId();
  return (
    <div className={`pulso-f6-dato is-apilado${corto ? " is-corto" : ""}`}>
      <label className="pulso-f6-dato-rotulo" htmlFor={id}>{rotulo}</label>
      <input id={id} className="pulso-f6-input" value={valor} placeholder={placeholder}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined} onChange={(e) => onCambio(e.target.value)} />
      {ayuda && <span id={`${id}-ayuda`} className="pulso-f6-dato-ayuda">{ayuda}</span>}
    </div>
  );
}
