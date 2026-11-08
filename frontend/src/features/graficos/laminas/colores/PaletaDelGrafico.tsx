// «Colores» en la tarjeta de un gráfico que pinta cada respuesta con su color (P6; Gonzalo 2026-10-11: «darle un nombre
// personalizado, que pueda ser reutilizable desde láminas también»). Muestra la barra con los colores que hoy usa la
// pregunta, deja elegir una de las paletas con nombre de Identidad y lleva a editarla allí. Elegir una paleta cambia los
// colores de todas las preguntas con esas mismas respuestas, y la tarjeta lo dice.
// Ítem 8 de la oleada del inspector (2026-11-08): las paletas son muestras pintadas sobre las respuestas de esta pregunta
// (MuestrasPaleta); pasar el cursor por una la pinta en la barra de arriba como vista previa, sin tocar el plan.

import { useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { GraficadorRef } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { useSession } from "../../../../lib/SessionContext";
import { coloresParaCompletar, conColoresDeFila, conGrupoEnPaleta, paletaDeLaPregunta, type FilaPaleta } from "../../estilo/modeloPaletasConNombre";
import type { GrupoRespuestas } from "../../estilo/modeloColoresRespuestas";
import { usePaletasRespuestas } from "../../estilo/usePaletasRespuestas";
import { searchDePiezaIdentidad } from "../../estilo/direccionIdentidad";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { GRAFICOS_POR_CATEGORIA, preguntasDelGrafico } from "../modeloMaqueta";
import { varCalificada } from "../ordenCategorias";
import { fraseOtrasPreguntas } from "./frasesPaleta";
import { MuestrasPaleta } from "./MuestrasPaleta";
import { coloresConPaleta } from "./vistaPaleta";
import "../../estilo/coloresRespuestas.css";
import "./paletaDelGrafico.css";

type Props = { valor: GraficadorRef };

/** En la tarjeta (angosta) la barra va sin texto y las respuestas en una leyenda debajo, enteras. */
function Barra({ fila, vista }: { fila: FilaPaleta; vista: boolean }) {
  return (
    <>
      <span className={`pulso-pg-barra${vista ? " is-vista" : ""}`} aria-hidden="true">
        {fila.opciones.map((o) => (
          <span key={o} className={fila.colores[o] ? undefined : "is-vacio"} style={fila.colores[o] ? { background: fila.colores[o] } : undefined} />
        ))}
      </span>
      <ul className="pulso-pg-leyenda" aria-label="Respuestas y sus colores">
        {fila.opciones.map((o) => (
          <li key={o} className={fila.colores[o] ? undefined : "is-falta"}>
            <span className={fila.colores[o] ? "pulso-cr-punto" : "pulso-cr-punto is-vacio"} style={fila.colores[o] ? { background: fila.colores[o] } : undefined} aria-hidden="true" />
            {o}
            {fila.colores[o] ? null : <span className="pulso-sr-only"> (color por defecto)</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function PaletaDelGrafico({ valor }: Props) {
  const id = useId();
  const navigate = useNavigate();
  const loc = useLocation();
  const scope = useGraficosReportScope(loc.search);
  const baseActiva = useSession().state?.active_base;
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const setPaletas = usePlanStore((s) => s.setPaletas);
  const setPaletasYVinculos = usePlanStore((s) => s.setPaletasYVinculos);
  const { listas, filas } = usePaletasRespuestas();
  // La muestra bajo el cursor o el foco: se pinta en la barra de su pregunta; nunca va al plan.
  const [vista, setVista] = useState<{ fila: string; clave: string } | null>(null);

  const args = (valor.args ?? {}) as Record<string, unknown>;
  if (!listas) return null;
  // Todas las preguntas del gráfico (también los bloques de multi-apiladas); una paleta por juego de respuestas.
  const halladas: { fila: FilaPaleta; grupo: GrupoRespuestas }[] = [];
  for (const pregunta of preguntasDelGrafico(args)) {
    const h = paletaDeLaPregunta(filas, varCalificada(pregunta, baseActiva, scope)) ?? paletaDeLaPregunta(filas, pregunta);
    if (h && !halladas.some((x) => x.fila.id === h.fila.id)) halladas.push(h);
  }
  // Sólo los gráficos que pintan cada respuesta, o los que ya tienen colores elegidos para ellas.
  const visibles = halladas.filter((h) => GRAFICOS_POR_CATEGORIA.has(valor.graficador) || h.fila.faltan < h.fila.opciones.length);
  if (!visibles.length) return null;

  const nombradas = filas.filter((f) => f.clave);
  const irAIdentidad = () =>
    navigate({ pathname: loc.pathname, search: searchDePiezaIdentidad(loc.search, "colores") });
  const elegir = ({ fila, grupo }: { fila: FilaPaleta; grupo: GrupoRespuestas }, clave: string) => {
    const destino = nombradas.find((f) => f.clave === clave);
    if (!destino) return;
    const m = conGrupoEnPaleta(fila, grupo, destino, listas, { paletas, vinculos });
    setPaletasYVinculos(m.paletas, m.vinculos);
  };
  const completar = (fila: FilaPaleta) => setPaletas(conColoresDeFila(fila, coloresParaCompletar(fila), listas, paletas));

  return (
    <div className="pulso-f6-dato is-apilado pulso-pg" role="group" aria-labelledby={`${id}-rot`} data-qa="paleta-del-grafico">
      <span id={`${id}-rot`} className="pulso-f6-dato-rotulo">Colores</span>
      {visibles.map((h) => {
        const { fila, grupo } = h;
        const otras = fila.preguntas.length - 1;
        const destino = vista?.fila === fila.id ? nombradas.find((f) => f.clave === vista.clave && f.clave !== fila.clave) : undefined;
        const mostrada: FilaPaleta = destino ? { ...fila, colores: coloresConPaleta(fila.opciones, fila.colores, destino) } : fila;
        return (
          <div key={fila.id} className="pulso-pg-cuerpo">
            <div className="pulso-pg-cabecera">
              <span className={`pulso-pg-nombre${destino ? " is-vista" : ""}`} aria-live="polite">
                {destino ? `Vista previa: ${destino.nombre}` : fila.nombre}
              </span>
              {fila.clave ? <span className="pulso-cr-sello">Paleta con nombre</span> : null}
            </div>
            <Barra fila={mostrada} vista={!!destino} />
            {/* Con la vista previa nada cambia de alto: la muestra bajo el cursor no se mueve. */}
            {fila.faltan > 0 ? (
              <div className="pulso-pg-aviso" role="status">
                {/* La paleta no las nombra, pero la lámina no sale sin color: el motor les pone los de fábrica del gráfico (loop UI). */}
                <span>{fila.faltan === 1 ? "Esta respuesta sale con el color por defecto del gráfico." : `Estas ${fila.faltan} respuestas salen con los colores por defecto del gráfico.`}</span>
                <PulsoButton variant="secondary" size="sm" onClick={() => completar(fila)}>Fijar los de la marca</PulsoButton>
              </div>
            ) : null}
            {nombradas.length ? (
              <MuestrasPaleta opciones={fila.opciones} propios={fila.colores} paletas={nombradas} enUso={fila.clave}
                preguntas={grupo.preguntas.length}
                onVista={(clave) => setVista(clave ? { fila: fila.id, clave } : null)}
                onElegir={(clave) => { setVista(null); elegir(h, clave); }} />
            ) : null}
            {/* Estado (a qué más alcanza la paleta) con su acción, no ayuda: sigue visible (ADR 0135 §8). */}
            <p className="pulso-f6-dato-ayuda" role="note">
              {fraseOtrasPreguntas(otras)}{" "}
              <button type="button" className="pulso-pg-enlace" onClick={irAIdentidad}>Editar colores</button>
            </p>
          </div>
        );
      })}
    </div>
  );
}
