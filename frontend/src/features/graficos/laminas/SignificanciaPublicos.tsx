// La tarjeta de «Diferencias significativas entre públicos» (recetario p111–p112): los temas se eligen de la matriz de
// equivalencias —la que dice qué pregunta de un público equivale a cuál de otro (ADR 0103)— y las respuestas que suman el
// porcentaje (Top Two Box o «Sí») se eligen entre las de la pregunta. Se guardan en `vars` (tema -> preguntas por
// público) y `corte` (rótulos).

import { useEffect, useId, useState } from "react";
import { getEquivalencias, type EquivalenciaFila } from "../../../api/equivalencias";
import { parseVarRef, useVariables } from "../useVariables";

type Props = { args: Record<string, unknown>; onCambio: (patch: Record<string, unknown>) => void };

/**
 * Los temas de la matriz que se pueden comparar: confirmados y en dos públicos o más. Un indicador compuesto (ADR 0105)
 * no entra: su columna sólo existe en los comparativos, no en los datos de Gráficos. Un segmento de cruce (ADR 0107)
 * tampoco: es una variable de cruce, no un tema, igual que en los comparativos.
 */
export function temasComparables(filas: readonly EquivalenciaFila[]): EquivalenciaFila[] {
  return filas.filter((f) => !f.sugerida && !f.derivada && !f.cruce && f.etiqueta_estandar.trim() && Object.values(f.variables).filter(Boolean).length >= 2);
}

/** Las preguntas de un tema, una por público, como las guarda el gráfico (`base$variable`). */
export function preguntasDelTema(f: EquivalenciaFila): string[] {
  return Object.entries(f.variables).filter(([, v]) => v).map(([b, v]) => `${b}$${v}`);
}

export function SignificanciaPublicos({ args, onCambio }: Props) {
  const idTemas = useId();
  const idCorte = useId();
  const { variables } = useVariables();
  const [filas, setFilas] = useState<EquivalenciaFila[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    getEquivalencias().then((e) => { if (vivo) setFilas(temasComparables(e.filas ?? [])); }).catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, []);

  const vars = (args.vars && typeof args.vars === "object" && !Array.isArray(args.vars) ? args.vars : {}) as Record<string, unknown>;
  const elegidos = new Set(Object.keys(vars));
  const alternarTema = (tema: string, f?: EquivalenciaFila) => {
    const siguiente = { ...vars };
    if (elegidos.has(tema)) delete siguiente[tema];
    else if (f) siguiente[tema] = preguntasDelTema(f);
    onCambio({ vars: Object.keys(siguiente).length ? siguiente : null });
  };
  // Los temas elegidos se ven siempre, estén o no en la matriz (un plan armado antes, o una matriz que cambió): si la
  // tarjeta sólo listara la matriz, un tema elegido quedaría escondido y la lámina lo seguiría dibujando.
  const deLaMatriz = new Map((filas ?? []).map((f) => [f.etiqueta_estandar, f]));
  const opciones = [...new Set([...elegidos, ...deLaMatriz.keys()])];

  // Las respuestas que suman salen de la primera pregunta elegida (los temas comparten escala entre públicos).
  const primera = Object.values(vars).flatMap((v) => (Array.isArray(v) ? v.map(String) : []))[0];
  const ref = primera ? parseVarRef(primera) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  const corte = new Set((Array.isArray(args.corte) ? args.corte : typeof args.corte === "string" ? args.corte.split(",") : [])
    .map((x) => String(x).trim()).filter(Boolean));
  const alternarCorte = (r: string) => {
    const siguiente = respuestas.filter((x) => (x === r ? !corte.has(x) : corte.has(x)));
    onCambio({ corte: siguiente.length ? siguiente : null });
  };
  const publicos = new Set(Object.values(vars).flatMap((v) => (Array.isArray(v) ? v.map((r) => parseVarRef(String(r)).source ?? "") : [])));

  return (
    <>
      <div className="pulso-f6-dato is-apilado" data-qa="significancia-temas">
        <span className="pulso-f6-dato-rotulo" id={idTemas}>Temas</span>
        {opciones.length > 0 && (
          <div className="pulso-f6-destacar" role="group" aria-labelledby={idTemas}>
            {opciones.map((t) => (
              <button key={t} type="button" className="pulso-f6-destacar-opcion is-unica" role="checkbox" aria-checked={elegidos.has(t)}
                title={deLaMatriz.has(t) ? undefined : "Este tema no está en la matriz de equivalencias"} onClick={() => alternarTema(t, deLaMatriz.get(t))}>{t}</button>
            ))}
          </div>
        )}
        {error ? <span className="pulso-f6-dato-ayuda" role="note">No se pudo leer la matriz de equivalencias.</span>
          : filas === null ? <span className="pulso-f6-dato-ayuda">Leyendo la matriz de equivalencias…</span>
          : filas.length === 0 ? <span className="pulso-f6-dato-ayuda" role="note">La matriz de equivalencias no tiene temas confirmados en dos públicos; se declaran en Carga › Equivalencias.</span>
          : null}
        {publicos.size > 3 && <span className="pulso-f6-dato-ayuda" role="note">La lámina compara hasta tres públicos; con más, sale como dibujo de respaldo.</span>}
      </div>
      {respuestas.length > 0 && (
        <div className="pulso-f6-dato is-apilado" data-qa="significancia-corte">
          <span className="pulso-f6-dato-rotulo" id={idCorte}>Respuestas que suman</span>
          <div className="pulso-f6-destacar" role="group" aria-labelledby={idCorte}>
            {respuestas.map((r) => (
              <button key={r} type="button" className="pulso-f6-destacar-opcion is-unica" role="checkbox" aria-checked={corte.has(r)}
                onClick={() => alternarCorte(r)}>{r}</button>
            ))}
          </div>
          {corte.size === 0 && <span className="pulso-f6-dato-ayuda" role="note">Elige las que forman el porcentaje (Top Two Box o Sí).</span>}
        </div>
      )}
    </>
  );
}
