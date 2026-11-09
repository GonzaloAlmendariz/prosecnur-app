// P21 (enmienda al ADR 0103, «la matriz sugiere, la lámina decide»): el radar entre públicos, la brecha entre dos
// bases y la serie temporal se arman en la tarjeta del gráfico con el editor tema × público de las multiapiladas
// (TemasPorPublico), con las sugerencias de la matriz. Cambia qué es un «público» según el gráfico: las bases del
// estudio (radar), las de dos a cuatro bases elegidas en orden (brecha) o las mediciones en el orden de Carga (serie).

import { useId, useState } from "react";
import { ordenEfectivo, resumenOrdenSerie } from "../../carga/armonizacionModel";
import { nombrePublico, type TemaPublicos } from "../multiapiladas/temasPublicos";
import { TemasPorPublico } from "../multiapiladas/TemasPorPublico";
import { useVariables } from "../useVariables";
import { AyudaGlobo } from "../laminas/AyudaGlobo";
import { ExplicaTemas, type TipoTemas } from "./ExplicaTemas";
import {
  argsATemas, basesAGuardar, basesDeBrecha, basesDeclaradas, basesDelPar, casillasDePublicos, codigosComunes, conBases, conCodigo, elegirEnPar, corteGuardado, avisoCriteriosRadar, faltaEnBrechaBases, faltaEnRadarPublicos, REGLA_CRITERIOS_RADAR,
  faltaEnSerie, esSelectOne, temasAArgs,
} from "./temasEquivalentesModel";
import { useEquivalenciasDeTemas } from "./useEquivalenciasDeTemas";
import { SeparadorEntreFilas } from "../laminas/brecha/SeparadorEntreFilas";
import { conSeparador, separadoresDe } from "../laminas/brecha/separadoresFilas";
import "../multiapiladas/multiapiladas.css";
import "./temasEquivalentes.css";

type Props = {
  tipo: TipoTemas;
  args: Readonly<Record<string, unknown>>;
  onCambio: (patch: Record<string, unknown>) => void;
};

const ORDINAL_PUBLICO: readonly string[] = ["Primero", "Segundo", "Tercero", "Cuarto"];
const ORDINAL_OPCION: readonly string[] = ["Primer", "Segundo", "Tercer", "Cuarto"];

const nuevoTema = (n: number): TemaPublicos => ({ key: `tema_${n}`, title: "", vars: [] });

export function EditorTemasEquivalentes({ tipo, args, onCambio }: Props) {
  const id = useId();
  const { variables, sources } = useVariables();
  const eq = useEquivalenciasDeTemas(true);
  const temas = argsATemas(args);
  const basesEstudio = sources.map((s) => s.name);
  const guardadas = basesDeBrecha(temas);
  // El contraste entre públicos (estilo resumen) guarda sus bases (de dos a cuatro) en `bases` (graficos_dumbbell_auto.R):
  // las leen el emparejado, el conteo de la regla y el motor. En el recetario `bases` sin preguntas implicaría una regla
  // que ese estilo rechaza, así que ahí la brecha guarda sus bases en el orden de las preguntas.
  const resumen = tipo === "brecha" && args.estilo === "resumen";
  const [elegidas, setElegidas] = useState<string[]>(guardadas);
  // En el recetario la elección vive aquí mientras las preguntas no la alcanzan (una tercera base recién elegida aún no
  // tiene preguntas): manda si incluye las bases de las preguntas; si no (deshacer, otro cambio), mandan las preguntas.
  const delRecetario = elegidas.some(Boolean) && guardadas.every((b) => elegidas.includes(b)) ? elegidas : guardadas;
  const basesBrecha = resumen ? basesDeclaradas(args) ?? basesDelPar(args, basesEstudio) : delRecetario;
  const casillas = casillasDePublicos(basesEstudio.length, basesBrecha.length);
  const elegidasBrecha = basesBrecha.filter(Boolean);
  const separadores = separadoresDe(args);
  const periodos = ordenEfectivo(eq.periodos, eq.bases.length ? eq.bases : basesEstudio);

  const publicos = tipo === "radar" ? basesEstudio : tipo === "brecha" ? basesBrecha.filter(Boolean) : periodos;

  const conTemas = (next: readonly TemaPublicos[]) => {
    const extra: Record<string, unknown> =
      tipo === "brecha" ? { cruce: null, grupos: null } : tipo === "serie" ? { orden_periodos: periodos } : {};
    onCambio({ ...temasAArgs(next), ...extra });
  };

  const elegirBase = (k: number, base: string) => {
    const next = elegirEnPar(basesBrecha, k, base, casillas);
    const preguntas = temas.length ? { ...temasAArgs(conBases(temas, next.filter(Boolean))), cruce: null, grupos: null } : {};
    if (resumen) { onCambio({ ...preguntas, bases: basesAGuardar(next) }); return; }
    setElegidas(next);
    if (temas.length) onCambio(preguntas);
  };

  const problemas =
    tipo === "radar" ? faltaEnRadarPublicos(temas, variables)
      : tipo === "brecha" ? faltaEnBrechaBases(temas, elegidasBrecha, variables, resumen)
        : faltaEnSerie(temas, periodos, variables);
  const escala = codigosComunes(temas, variables);
  const corte = corteGuardado(args.corte);
  const conPreguntas = temas.some((t) => t.vars.length > 0);
  if (conPreguntas && !escala.length) problemas.push("Las preguntas no comparten respuestas: no hay un indicador que sirva para todas.");
  else if (escala.length && !corte.length) problemas.push("Marca qué respuestas suman el indicador.");
  const fueraDeEscala = escala.length ? corte.filter((c) => !escala.some((o) => o.codigo === c)) : [];
  if (fueraDeEscala.length) problemas.push(`El indicador marca códigos que no están en todas las preguntas: ${fueraDeEscala.join(", ")}.`);

  const [p1, p2] = [basesBrecha[0] ?? "", basesBrecha[1] ?? ""];
  const ayudaBases = elegidasBrecha.length > 2
    ? "Con más de dos públicos, la diferencia es el mayor menos el menor, sin signo."
    : p1 && p2
      ? `La brecha es ${nombrePublico(p1)} menos ${nombrePublico(p2)}: si ${nombrePublico(p1)} está arriba, sale con signo +.`
      : "Con dos públicos, la brecha es el primero menos el segundo; con tres o cuatro, el mayor menos el menor.";
  const faltanBases = tipo === "radar" ? basesEstudio.length < 2 : tipo === "serie" ? periodos.length < 2 : false;

  return (
    <div className="pulso-teq" data-qa-geometry-group={`graficos/temas-equivalentes-${tipo}`} data-qa-geometry-contract="intrinsic">
      <ExplicaTemas tipo={tipo} />

      {tipo === "brecha" && (
        <div className="pulso-f6-dato is-apilado">
          <span className="pulso-f6-dato-rotulo" id={`${id}-bases`}>
            Públicos que se comparan
            <AyudaGlobo
              rotulo="Públicos que se comparan"
              detalle={`${ayudaBases}${resumen ? " Sin temas elegidos, entran las preguntas con el mismo nombre y la misma escala en todos." : ""}`}
            />
          </span>
          <div className="pulso-teq-bases" role="group" aria-labelledby={`${id}-bases`} data-casillas={casillas}
            data-qa-geometry-group="graficos/temas-equivalentes-bases" data-qa-geometry-contract="equal">
            {Array.from({ length: casillas }, (_, k) => (
              <label key={k} data-qa-geometry-member>
                {ORDINAL_PUBLICO[k]}
                <select className="pulso-f6-input pulso-f6-dato-select" value={basesBrecha[k] ?? ""} onChange={(e) => elegirBase(k, e.target.value)}>
                  <option value="">{k < 2 ? `${ORDINAL_OPCION[k]} público…` : `${ORDINAL_OPCION[k]} público (opcional)…`}</option>
                  {basesEstudio.map((b) => <option key={b} value={b}>{nombrePublico(b)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {tipo === "serie" && periodos.length > 0 && (
        <div className="pulso-f6-dato is-apilado">
          <span className="pulso-f6-dato-rotulo">Mediciones</span>
          <p className="pulso-teq-orden">{resumenOrdenSerie(periodos.map(nombrePublico))}</p>
          <span className="pulso-f6-dato-ayuda">El orden se declara en Carga › Equivalencias.</span>
        </div>
      )}

      {tipo === "radar" && (
        <p className="pulso-f6-dato-ayuda" role="status" data-testid="regla-criterios-radar">
          {avisoCriteriosRadar(temas.length) ?? REGLA_CRITERIOS_RADAR}
        </p>
      )}

      {faltanBases ? (
        <p className="pulso-teq-problemas" role="status">
          {tipo === "radar" ? "El radar entre públicos necesita bases separadas: una por público." : "La serie necesita una base por medición, al menos dos."}
        </p>
      ) : publicos.length > 0 ? (
        <TemasPorPublico temas={temas} publicos={publicos} variables={variables} matriz={eq.matriz} filtroTipo={esSelectOne} nuevoTema={nuevoTema} onChange={conTemas}
          // D4: en el contraste de públicos, un separador entre dos temas con un clic (el motor nunca lo pone solo).
          entreTemas={resumen ? (i) => (
            <SeparadorEntreFilas posicion={i + 1} activo={separadores.includes(i + 1)} onCambiar={(on) => onCambio(conSeparador(args, i + 1, on))} />
          ) : undefined} />
      ) : null}

      {resumen && separadores.length > 0 && temas.length > 1 && (
        <span className="pulso-f6-dato-ayuda">Con separador, las filas salen en el orden de los temas.</span>
      )}

      {escala.length > 0 && (
        <fieldset className="pulso-teq-corte">
          <legend className="pulso-f6-dato-rotulo">Indicador: respuestas que suman</legend>
          {escala.map((o) => (
            <label key={o.codigo} className="pulso-teq-opcion">
              <input type="checkbox" checked={corte.includes(o.codigo)}
                     onChange={(e) => onCambio({ corte: conCodigo(corte, o.codigo, e.target.checked, escala) })} />
              {o.etiqueta}
            </label>
          ))}
        </fieldset>
      )}

      {problemas.length > 0 ? (
        <ul className="pulso-teq-problemas" role="status" aria-label="Lo que falta para dibujar el gráfico">
          {problemas.map((p) => <li key={p}>{p}</li>)}
        </ul>
      ) : (
        <p className="pulso-teq-listo" role="status">Listo para dibujar.</p>
      )}
    </div>
  );
}
