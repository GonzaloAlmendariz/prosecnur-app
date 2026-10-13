// G16: la tarjeta de la matriz de cuadrantes. Los temas y sus dos preguntas, qué respuestas suman cada eje y los nombres
// de los cuadrantes. Nombres de ejes, cortes y cuadrante destacado van como campos de la tarjeta (argsDatosGrafico).

import { X } from "../../../../vendor/lucide-react";
import VariablePicker from "../../VariablePicker";
import { useVariables } from "../../useVariables";
import {
  CUADRANTES, NOMBRE_NEUTRO, ROTULO_CUADRANTE, conCorte, conNombre, conTemas, corteDe, escalaDe, faltaEnMatriz, nombreDePartida,
  nombresDe, temasDe, type Tema,
} from "./modeloMatrizCuadrantes";
import "../brecha/brechaEntreGrupos.css";

type Props = { args: Readonly<Record<string, unknown>>; onCambio: (patch: Record<string, unknown>) => void };

const esSelectOne = (tipo: string) => /^select_one/.test(tipo) || tipo === "so";

export function MatrizCuadrantes({ args, onCambio }: Props) {
  const { variables } = useVariables();
  const temas = temasDe(args);
  const nombres = nombresDe(args);
  const falta = faltaEnMatriz(args);
  const cambiar = (t: Tema[]) => onCambio(conTemas(variables, t));

  return (
    <div className="pulso-f6-brecha" data-qa-geometry-group="graficos/f6-matriz" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo">Temas</span>
        <ul className="pulso-f6-brecha-preguntas">
          {temas.map((t, i) => (
            <li key={`${t.nombre}-${i}`} className="pulso-f6-matriz-tema">
              <input className="pulso-f6-input" aria-label="Nombre del tema" value={t.nombre}
                     onChange={(e) => cambiar(temas.map((u, j) => (j === i ? { ...u, nombre: e.target.value } : u)))} />
              <button type="button" className="pulso-f6-icono-boton" aria-label="Quitar el tema" onClick={() => cambiar(temas.filter((_, j) => j !== i))}>
                <X size={14} aria-hidden="true" />
              </button>
              <div className="pulso-f6-dato-control">
                <VariablePicker value={t.x || null} allowEmpty filter={esSelectOne} placeholder="Pregunta del eje horizontal…"
                                onChange={(v) => cambiar(temas.map((u, j) => (j === i ? { ...u, x: v ?? "" } : u)))} />
              </div>
              <div className="pulso-f6-dato-control">
                <VariablePicker value={t.y || null} allowEmpty filter={esSelectOne} placeholder="Pregunta del eje vertical…"
                                onChange={(v) => cambiar(temas.map((u, j) => (j === i ? { ...u, y: v ?? "" } : u)))} />
              </div>
            </li>
          ))}
        </ul>
        <div className="pulso-f6-dato-control">
          <VariablePicker value={null} allowEmpty filter={esSelectOne} placeholder="Agregar tema: su pregunta del eje horizontal…"
                          onChange={(v) => v && cambiar([...temas, { nombre: nombreDePartida(variables, v), x: v, y: "" }])} />
        </div>
        <span className="pulso-f6-dato-ayuda">El nombre parte de la etiqueta de la pregunta; si es larga, escríbelo corto.</span>
      </div>
      {(["x", "y"] as const).map((eje) => {
        const escala = escalaDe(variables, temas, eje);
        if (!escala.length) return null;
        const marcadas = new Set(corteDe(args, eje));
        return (
          <fieldset key={eje} className="pulso-f6-dato is-apilado pulso-f6-brecha-corte">
            <legend className="pulso-f6-dato-rotulo">{eje === "x" ? "Respuestas que suman el eje horizontal" : "Respuestas que suman el eje vertical"}</legend>
            {escala.map((o) => (
              <label key={o.codigo} className="pulso-f6-brecha-opcion">
                <input type="checkbox" checked={marcadas.has(o.codigo)} onChange={(e) => onCambio(conCorte(args, eje, o.codigo, e.target.checked))} />
                {o.etiqueta}
              </label>
            ))}
          </fieldset>
        );
      })}
      <div className="pulso-f6-dato is-apilado">
        <span className="pulso-f6-dato-rotulo">Nombres de los cuadrantes</span>
        {CUADRANTES.map((q) => (
          <label key={q} className="pulso-f6-matriz-cuadrante">
            <span className="pulso-f6-dato-ayuda">{ROTULO_CUADRANTE[q]}</span>
            <input className="pulso-f6-input" value={nombres[q] ?? ""} placeholder={NOMBRE_NEUTRO[q]}
                   onChange={(e) => onCambio(conNombre(args, q, e.target.value))} />
          </label>
        ))}
      </div>
      {falta && <p className="pulso-f6-dato-ayuda is-aviso" role="status">{falta}</p>}
    </div>
  );
}
