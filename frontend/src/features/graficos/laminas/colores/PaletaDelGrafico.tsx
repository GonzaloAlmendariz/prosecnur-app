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
import { combinacionesPara, textoSobre } from "../../estilo/modeloColoresRespuestas";
import { conColoresDeFila, conGrupoEnPaleta, paletaDeLaPregunta, type FilaPaleta } from "../../estilo/modeloPaletasConNombre";
import { usePaletasRespuestas } from "../../estilo/usePaletasRespuestas";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { GRAFICOS_POR_CATEGORIA } from "../modeloMaqueta";
import { varCalificada } from "../ordenCategorias";
import "../../estilo/coloresRespuestas.css";
import "./paletaDelGrafico.css";

type Props = { valor: GraficadorRef };

function Barra({ fila }: { fila: FilaPaleta }) {
  return (
    <span className="pulso-cr-barra" aria-label={`Respuestas: ${fila.opciones.join(", ")}`}>
      {fila.opciones.map((o) => (
        <span key={o} className={`pulso-cr-segmento is-${fila.colores[o] ? textoSobre(fila.colores[o]) : "vacio"}`} style={fila.colores[o] ? { background: fila.colores[o] } : undefined} title={fila.colores[o] ? o : `${o}: sin color`}>
          <span className="pulso-cr-segmento-texto">{o}</span>
        </span>
      ))}
    </span>
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
  const variable = typeof args.var === "string" ? args.var : Array.isArray(args.vars) && typeof args.vars[0] === "string" ? args.vars[0] : "";
  if (!variable || !listas) return null;
  const hallada = paletaDeLaPregunta(filas, varCalificada(variable, baseActiva, scope)) ?? paletaDeLaPregunta(filas, variable);
  if (!hallada) return null;
  const { fila, grupo } = hallada;
  // Sólo los gráficos que pintan cada respuesta, o los que ya tienen colores elegidos para ellas.
  if (!GRAFICOS_POR_CATEGORIA.has(valor.graficador) && fila.faltan === fila.opciones.length) return null;

  const nombradas = filas.filter((f) => f.clave);
  const otras = fila.preguntas.length - 1;
  const irAIdentidad = () =>
    navigate({ pathname: loc.pathname, search: conNivel(conNivel(searchConNivel(loc.search, "pestana", "estilo"), "foco", "colores"), "panel", null) });
  const elegir = (clave: string) => {
    const destino = nombradas.find((f) => f.clave === clave);
    if (!destino) return;
    const m = conGrupoEnPaleta(fila, grupo, destino, listas, { paletas, vinculos });
    setPaletasYVinculos(m.paletas, m.vinculos);
  };
  const completar = () => {
    const sugerida = combinacionesPara(fila.opciones)[0];
    if (!sugerida) return;
    const faltantes = Object.fromEntries(fila.opciones.filter((o) => !fila.colores[o]).map((o) => [o, sugerida.colores[o]]));
    setPaletas(conColoresDeFila(fila, faltantes, listas, paletas));
  };

  return (
    <div className="pulso-f6-dato is-apilado pulso-pg" role="group" aria-labelledby={`${id}-rot`} data-qa="paleta-del-grafico">
      <span id={`${id}-rot`} className="pulso-f6-dato-rotulo">Colores</span>
      <div className="pulso-pg-cuerpo">
        <div className="pulso-pg-cabecera">
          <span className="pulso-pg-nombre">{fila.nombre}</span>
          {fila.clave ? <span className="pulso-cr-sello">Paleta con nombre</span> : null}
        </div>
        <Barra fila={fila} />
        {fila.faltan > 0 ? (
          <div className="pulso-pg-aviso" role="status">
            <span>{fila.faltan === 1 ? "Falta el color de una respuesta." : `Faltan los colores de ${fila.faltan} respuestas.`}</span>
            <PulsoButton variant="secondary" size="sm" onClick={completar}>Completar con la marca</PulsoButton>
          </div>
        ) : null}
        {nombradas.length ? (
          <label className="pulso-pg-elegir">
            <span>Usar la paleta</span>
            <select value={fila.clave ?? ""} onChange={(e) => elegir(e.target.value)}>
              {fila.clave ? null : <option value="">Elegir una paleta con nombre</option>}
              {nombradas.map((f) => <option key={f.id} value={f.clave ?? ""}>{f.nombre}</option>)}
            </select>
          </label>
        ) : null}
        <p className="pulso-f6-dato-ayuda">
          {otras > 0 ? `Estos colores también pintan otras ${otras} ${otras === 1 ? "pregunta" : "preguntas"} con las mismas respuestas.` : "Estos colores son los de esta pregunta."}{" "}
          <button type="button" className="pulso-pg-enlace" onClick={irAIdentidad}>Editar colores</button>
        </p>
      </div>
    </div>
  );
}
