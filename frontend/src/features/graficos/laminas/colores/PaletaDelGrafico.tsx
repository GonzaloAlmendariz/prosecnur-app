// «Colores» en la tarjeta de un gráfico que pinta cada respuesta con su color (P6; Gonzalo 2026-10-11: «darle un nombre
// personalizado, que pueda ser reutilizable desde láminas también»). Muestra la barra con los colores que hoy usa la
// pregunta, deja elegir una de las paletas con nombre de Identidad y lleva a editarla allí. Elegir una paleta cambia los
// colores de todas las preguntas con esas mismas respuestas, y la tarjeta lo dice.

import { useId } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { GraficadorRef } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../../lib/navegacion/useDireccion";
import { useSession } from "../../../../lib/SessionContext";
import { coloresParaCompletar, conColoresDeFila, conGrupoEnPaleta, paletaDeLaPregunta, type FilaPaleta } from "../../estilo/modeloPaletasConNombre";
import type { GrupoRespuestas } from "../../estilo/modeloColoresRespuestas";
import { usePaletasRespuestas } from "../../estilo/usePaletasRespuestas";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { GRAFICOS_POR_CATEGORIA, preguntasDelGrafico } from "../modeloMaqueta";
import { varCalificada } from "../ordenCategorias";
import { fraseOtrasPreguntas } from "./frasesPaleta";
import "../../estilo/coloresRespuestas.css";
import "./paletaDelGrafico.css";

type Props = { valor: GraficadorRef };

/** En la tarjeta (angosta) la barra va sin texto y las respuestas en una leyenda debajo, enteras. */
function Barra({ fila }: { fila: FilaPaleta }) {
  return (
    <>
      <span className="pulso-pg-barra" aria-hidden="true">
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
    navigate({ pathname: loc.pathname, search: conNivel(conNivel(searchConNivel(loc.search, "pestana", "identidad"), "foco", "colores"), "panel", null) });
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
        const { fila } = h;
        const otras = fila.preguntas.length - 1;
        return (
          <div key={fila.id} className="pulso-pg-cuerpo">
            <div className="pulso-pg-cabecera">
              <span className="pulso-pg-nombre">{fila.nombre}</span>
              {fila.clave ? <span className="pulso-cr-sello">Paleta con nombre</span> : null}
            </div>
            <Barra fila={fila} />
            {fila.faltan > 0 ? (
              <div className="pulso-pg-aviso" role="status">
                {/* La paleta no las nombra, pero la lámina no sale sin color: el motor les pone los de fábrica del gráfico (loop UI). */}
                <span>{fila.faltan === 1 ? "Esta respuesta sale con el color por defecto del gráfico." : `Estas ${fila.faltan} respuestas salen con los colores por defecto del gráfico.`}</span>
                <PulsoButton variant="secondary" size="sm" onClick={() => completar(fila)}>Fijar los de la marca</PulsoButton>
              </div>
            ) : null}
            {nombradas.length ? (
              <label className="pulso-pg-elegir">
                <span>Usar la paleta</span>
                <select value={fila.clave ?? ""} onChange={(e) => elegir(h, e.target.value)}>
                  {fila.clave ? null : <option value="">Elegir una paleta con nombre</option>}
                  {nombradas.map((f) => <option key={f.id} value={f.clave ?? ""}>{f.nombre}</option>)}
                </select>
              </label>
            ) : null}
            <p className="pulso-f6-dato-ayuda">
              {fraseOtrasPreguntas(otras)}{" "}
              <button type="button" className="pulso-pg-enlace" onClick={irAIdentidad}>Editar colores</button>
            </p>
          </div>
        );
      })}
    </div>
  );
}
