// P21 (enmienda al ADR 0103, «la matriz sugiere, la lámina decide»): el radar entre públicos, la brecha entre dos
// bases y la serie temporal se arman en la tarjeta del gráfico con el editor tema × público de las multiapiladas
// (TemasPorPublico), con las sugerencias de la matriz. Cambia qué es un «público» según el gráfico: las bases del
// estudio (radar), las dos bases elegidas en orden (brecha) o las mediciones en el orden de Carga (serie).

import { useId, useState } from "react";
import { ordenEfectivo, resumenOrdenSerie } from "../../carga/armonizacionModel";
import { nombrePublico, type TemaPublicos } from "../multiapiladas/temasPublicos";
import { TemasPorPublico } from "../multiapiladas/TemasPorPublico";
import { useVariables } from "../useVariables";
import { ExplicaTemas, type TipoTemas } from "./ExplicaTemas";
import {
  argsATemas, basesDeBrecha, codigosComunes, conBases, conCodigo, corteGuardado, avisoCriteriosRadar, faltaEnBrechaBases, faltaEnRadarPublicos, REGLA_CRITERIOS_RADAR,
  faltaEnSerie, esSelectOne, temasAArgs,
} from "./temasEquivalentesModel";
import { useEquivalenciasDeTemas } from "./useEquivalenciasDeTemas";
import "../multiapiladas/multiapiladas.css";
import "./temasEquivalentes.css";

type Props = {
  tipo: TipoTemas;
  args: Readonly<Record<string, unknown>>;
  onCambio: (patch: Record<string, unknown>) => void;
};

const nuevoTema = (n: number): TemaPublicos => ({ key: `tema_${n}`, title: "", vars: [] });

export function EditorTemasEquivalentes({ tipo, args, onCambio }: Props) {
  const id = useId();
  const { variables, sources } = useVariables();
  const eq = useEquivalenciasDeTemas(true);
  const temas = argsATemas(args);
  const basesEstudio = sources.map((s) => s.name);
  const guardadas = basesDeBrecha(temas);
  // La brecha guarda sus dos bases en el orden de las preguntas; mientras ningún tema las tiene a las dos, la elección
  // vive aquí (el contrato de args no tiene dónde guardarla).
  const [elegidas, setElegidas] = useState<string[]>(guardadas);
  const basesBrecha = guardadas.length === 2 ? guardadas : elegidas;
  const periodos = ordenEfectivo(eq.periodos, eq.bases.length ? eq.bases : basesEstudio);

  const publicos = tipo === "radar" ? basesEstudio : tipo === "brecha" ? basesBrecha.filter(Boolean) : periodos;

  const conTemas = (next: readonly TemaPublicos[]) => {
    const extra: Record<string, unknown> =
      tipo === "brecha" ? { cruce: null, grupos: null } : tipo === "serie" ? { orden_periodos: periodos } : {};
    onCambio({ ...temasAArgs(next), ...extra });
  };

  const elegirBase = (k: 0 | 1, base: string) => {
    const next = [basesBrecha[0] ?? "", basesBrecha[1] ?? ""];
    // Elegir como primera la que era la segunda las intercambia: la brecha cambia de signo, las preguntas se conservan.
    if (base && next[1 - k] === base) next[1 - k] = next[k];
    next[k] = base;
    setElegidas(next);
    if (temas.length) conTemas(conBases(temas, next.filter(Boolean)));
  };

  const problemas =
    tipo === "radar" ? faltaEnRadarPublicos(temas, variables)
      : tipo === "brecha" ? faltaEnBrechaBases(temas, basesBrecha.filter(Boolean), variables)
        : faltaEnSerie(temas, periodos, variables);
  const escala = codigosComunes(temas, variables);
  const corte = corteGuardado(args.corte);
  const conPreguntas = temas.some((t) => t.vars.length > 0);
  if (conPreguntas && !escala.length) problemas.push("Las preguntas no comparten respuestas: no hay un indicador que sirva para todas.");
  else if (escala.length && !corte.length) problemas.push("Marca qué respuestas suman el indicador.");
  const fueraDeEscala = escala.length ? corte.filter((c) => !escala.some((o) => o.codigo === c)) : [];
  if (fueraDeEscala.length) problemas.push(`El indicador marca códigos que no están en todas las preguntas: ${fueraDeEscala.join(", ")}.`);

  const [p1, p2] = [basesBrecha[0] ?? "", basesBrecha[1] ?? ""];
  const faltanBases = tipo === "radar" ? basesEstudio.length < 2 : tipo === "serie" ? periodos.length < 2 : false;

  return (
    <div className="pulso-teq" data-qa-geometry-group={`graficos/temas-equivalentes-${tipo}`} data-qa-geometry-contract="intrinsic">
      <ExplicaTemas tipo={tipo} />

      {tipo === "brecha" && (
        <div className="pulso-f6-dato is-apilado">
          <span className="pulso-f6-dato-rotulo" id={`${id}-bases`}>Bases que se comparan</span>
          <div className="pulso-teq-bases" role="group" aria-labelledby={`${id}-bases`}>
            {([0, 1] as const).map((k) => (
              <label key={k}>
                {k === 0 ? "Primera" : "Segunda"}
                <select className="pulso-f6-input pulso-f6-dato-select" value={k === 0 ? p1 : p2} onChange={(e) => elegirBase(k, e.target.value)}>
                  <option value="">{k === 0 ? "Primera base…" : "Segunda base…"}</option>
                  {basesEstudio.map((b) => <option key={b} value={b}>{nombrePublico(b)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <span className="pulso-f6-dato-ayuda">
            {p1 && p2
              ? `La brecha es ${nombrePublico(p1)} menos ${nombrePublico(p2)}: si ${nombrePublico(p1)} está arriba, sale con signo +.`
              : "La brecha es la primera base menos la segunda."}
          </span>
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
        <TemasPorPublico temas={temas} publicos={publicos} variables={variables} matriz={eq.matriz} filtroTipo={esSelectOne} nuevoTema={nuevoTema} onChange={conTemas} />
      ) : null}

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
