// «La cifra al lado» en Lámina › Composición de la lámina de dos gráficos (U13 del checklist de mandos del mazo). El
// modelo y lo que el motor pide están en modeloCifraLateral.ts; la lámina la compone lamina_cifra_y_grafico.R.

import { useId } from "react";
import { useLocation } from "react-router-dom";
import type { Slide } from "../../../../api/graficos";
import { Switch } from "../../../../components/Switch";
import { useSession } from "../../../../lib/SessionContext";
import { useGraficosReportScope } from "../../reportScope";
import { leerSlideMeta } from "../../slideMeta";
import { usePlanStore } from "../../store";
import { Segmentado } from "../../subpestanas/Segmentado";
import type { TipoComparacion } from "../hallazgos/modeloCapitulosHallazgos";
import { varCalificada } from "../ordenCategorias";
import { SelectorCategorias } from "../SelectorCategorias";
import {
  cifraCompleta,
  cifraLateralActiva,
  desgloseEncendido,
  faltaParaCifraLateral,
  LAMINA_CIFRA_LATERAL,
  leerCifraLateral,
  metaConCifra,
  metaConComposicion,
  preguntaDeLaCifra,
  type CifraLateral,
} from "./modeloCifraLateral";

const COMPARACIONES: readonly { clave: TipoComparacion; rotulo: string }[] = [
  { clave: "auto", rotulo: "Automática" },
  { clave: "ninguna", rotulo: "Ninguna" },
  { clave: "escrita", rotulo: "Escrita" },
];

/** Sólo en la lámina de dos gráficos: en las demás no monta nada (ni pide la sesión). */
export function CifraAlLado({ slide }: { slide: Slide }) {
  return slide.tipo === LAMINA_CIFRA_LATERAL ? <CifraAlLadoEditor slide={slide} /> : null;
}

function CifraAlLadoEditor({ slide }: { slide: Slide }) {
  const id = useId();
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const meta = leerSlideMeta(slide);
  const activa = cifraLateralActiva(meta);
  const cifra = leerCifraLateral(meta);
  const falta = faltaParaCifraLateral(slide);
  const pregunta = preguntaDeLaCifra(slide);
  const cambiar = (c: Partial<CifraLateral>) => updatePayload(slide.id, { meta: metaConCifra(meta, c) });
  const respaldo = (
    <div className="pulso-f6-dato is-apilado">
      <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-fila`}>Respuesta que cuenta</label>
      <input id={`${id}-fila`} className="pulso-f6-input" value={cifra.fila} placeholder="Etiqueta de la respuesta, p. ej. Privado"
        onChange={(e) => cambiar({ fila: e.target.value })} />
    </div>
  );
  return (
    <section data-qa="cifra-al-lado" data-estado={activa ? "encendida" : "apagada"} aria-labelledby={id}
      data-qa-geometry-group="graficos/f6-cifra-al-lado" data-qa-geometry-contract="intrinsic">
      <h3 className="pulso-f6-subtitulo pulso-f6-inspector-apartado" id={id}>Cifra al lado</h3>
      <div className="pulso-f6-dato" data-qa-geometry-member="">
        <span className="pulso-f6-dato-rotulo">La cifra a la izquierda</span>
        <Switch checked={activa} ariaLabel="La cifra a la izquierda y el gráfico de la derecha con sus grupos bajo cada barra"
          onToggle={() => updatePayload(slide.id, { meta: metaConComposicion(meta, !activa) })} />
        <span className="pulso-f6-dato-ayuda">
          {activa
            ? "Una respuesta del gráfico de la izquierda en grande. A la derecha, el gráfico con sus grupos bajo cada barra."
            : "Cambia el gráfico de la izquierda por una cifra grande con su intervalo y su comparación."}
        </span>
      </div>
      {activa && falta && <span className="pulso-f6-dato-ayuda is-aviso" role="note" data-qa-geometry-member="">{falta} Mientras tanto la lámina sale con los dos gráficos.</span>}
      {activa && !falta && !desgloseEncendido(meta) && (
        <span className="pulso-f6-dato-ayuda" role="note" data-qa-geometry-member="">
          Los grupos bajo cada barra salen al encender las tarjetas del gráfico de la derecha, en su sección Diferencias.
        </span>
      )}
      {activa && (
        <>
          <SelectorCategorias id={`${id}-cats`} variable={pregunta ? varCalificada(pregunta, baseActiva, scope) : ""} scope={scope} graficador="" modo="una"
            porEtiqueta valor={cifra.fila ? [cifra.fila] : []} onCambio={(e) => cambiar({ fila: e[0] ?? "" })}
            etiqueta={<span className="pulso-f6-dato-rotulo">Respuesta que cuenta</span>} textoRespaldo={respaldo}
            nota={!cifraCompleta(cifra) ? <span className="pulso-f6-dato-ayuda is-aviso" role="note">Sin respuesta elegida no hay cifra.</span> : null} />
          <div className="pulso-f6-dato is-apilado" data-qa-geometry-member="">
            <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-rotulo`}>Rótulo sobre la cifra</label>
            <input id={`${id}-rotulo`} className="pulso-f6-input" value={cifra.rotulo} placeholder="Sin rótulo"
              onChange={(e) => cambiar({ rotulo: e.target.value })} />
          </div>
          <div className="pulso-f6-dato is-apilado" data-qa-geometry-member="">
            <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-texto`}>Texto tras la cifra</label>
            <textarea id={`${id}-texto`} className="pulso-f6-input" rows={2} value={cifra.texto}
              placeholder="p. ej. estudió la secundaria en un colegio privado" onChange={(e) => cambiar({ texto: e.target.value })} />
          </div>
          <div className="pulso-f6-dato" data-qa-geometry-member="">
            <span className="pulso-f6-dato-rotulo">Franja con la otra respuesta</span>
            <Switch checked={cifra.franja} ariaLabel="Franja con la otra respuesta" onToggle={() => cambiar({ franja: !cifra.franja })} />
            <span className="pulso-f6-dato-ayuda">Con dos respuestas, la barra partida entre las dos. Si no, va la del intervalo.</span>
          </div>
          <div className="pulso-f6-dato is-apilado" data-qa-geometry-member="">
            <span className="pulso-f6-dato-rotulo">Comparación</span>
            <Segmentado etiqueta="Comparación de la cifra" opciones={COMPARACIONES} valor={cifra.comparacion}
              onCambiar={(c) => cambiar({ comparacion: c })} />
            {cifra.comparacion === "escrita" && (
              <input className="pulso-f6-input" value={cifra.comparacionTexto} aria-label="Comparación escrita de la cifra"
                placeholder="p. ej. 12 puntos más que en 2025" onChange={(e) => cambiar({ comparacionTexto: e.target.value })} />
            )}
            <span className="pulso-f6-dato-ayuda">
              {cifra.comparacion === "auto" ? "La diferencia más fuerte entre grupos, con la regla del estudio." : cifra.comparacion === "escrita" ? "Sale tal cual." : "Sin comparación bajo la cifra."}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
