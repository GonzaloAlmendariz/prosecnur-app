// AulasSexoYDescartes.tsx — qué valor de la variable de sexo cuenta como
// mujeres y cuál como hombres, y qué llega por la plataforma pero no es del
// operativo. Unidad A5 del loop de mejora estética y técnica (2026-09-08).
//
// El 07/09, primer día de campo de HSVG2026, estas tres cosas se declararon
// POR API (`sex_female_values = ["1"]`, `sex_male_values = ["2"]`,
// `descartes = [{collectorID: CAPACITACION, PRUEBA_2026, INTERNOPULSO…}]`),
// porque la pantalla sólo dejaba declarar la variable de sexo y los filtros
// de efectiva. Sin esto el próximo estudio repite ese día 1: cuenta enviadas
// como efectivas, deja las treinta celdas de cuota en cero y no sabe qué
// código es «mujeres» (`sub_a` ya costó una lectura al revés por adivinar).
//
// Es la contracara visible de dos claves de `source_mapping` que la whitelist
// del motor ya persiste (`monitoreo_aulas_normalize_config`). La UI sólo
// enseña y guarda; no deriva nada.
import { Ban, Plus, X } from "../../../../vendor/lucide-react";

/** Clave canónica de un collectorID: mayúsculas, sin espacios, `_`/`,` como punto. */
const clave = (x: string) => String(x ?? "").trim().toUpperCase().replace(/[_,]/g, ".").replace(/\s+/g, "");

/**
 * Los valores del colector que no casan con ningún curso-horario del plan,
 * menos los ya descartados: son los candidatos a «fuera del operativo» (el QR
 * de capacitación, el de prueba, el interno). Ordenados para que la lista sea
 * estable de un refresco al otro.
 */
export function sugerenciasDeDescarte(
  valoresDelColector: ReadonlyArray<string>,
  codigosDelPlan: ReadonlyArray<string>,
  descartados: ReadonlyArray<string> = [],
): string[] {
  const plan = new Set(codigosDelPlan.map(clave));
  const fuera = new Set(descartados.map(clave));
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const v of valoresDelColector) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    const k = clave(s);
    if (plan.has(k) || fuera.has(k) || vistos.has(k)) continue;
    vistos.add(k);
    out.push(s);
  }
  return out.sort((a, b) => a.localeCompare(b, "es"));
}

export type ValoresDeSexo = { mujeres: string[]; hombres: string[] };

export function AulasSexoYDescartes({
  variableDeSexo, valoresDeLaVariable, mujeres, hombres, descartes, sugerencias,
  onValoresDeSexo = null, onDescartes = null,
}: {
  /** La variable declarada como sexo; vacía = todavía no se declaró. */
  variableDeSexo: string;
  /** Los valores distintos que esa variable trae en la base. */
  valoresDeLaVariable: ReadonlyArray<string>;
  mujeres: ReadonlyArray<string>;
  hombres: ReadonlyArray<string>;
  /** Valores del colector declarados fuera del operativo. */
  descartes: ReadonlyArray<string>;
  /** Candidatos: valores del colector que no casan con el plan. */
  sugerencias: ReadonlyArray<string>;
  /** `null` = sólo lectura: se enseña, no se toca. */
  onValoresDeSexo?: ((v: ValoresDeSexo) => void) | null;
  onDescartes?: ((valores: string[]) => void) | null;
}) {
  const esMujer = (v: string) => mujeres.includes(v);
  const esHombre = (v: string) => hombres.includes(v);
  const sinSexo = valoresDeLaVariable.filter((v) => !esMujer(v) && !esHombre(v));

  // Un valor cuenta en UN sexo: marcarlo en uno lo saca del otro.
  const alternar = (grupo: "mujeres" | "hombres", v: string) => {
    if (!onValoresDeSexo) return;
    const m = new Set(mujeres);
    const h = new Set(hombres);
    if (grupo === "mujeres") { if (m.has(v)) m.delete(v); else { m.add(v); h.delete(v); } }
    else { if (h.has(v)) h.delete(v); else { h.add(v); m.delete(v); } }
    onValoresDeSexo({ mujeres: [...m], hombres: [...h] });
  };

  const chips = (grupo: "mujeres" | "hombres", marcado: (v: string) => boolean) =>
    valoresDeLaVariable.map((v) => (
      onValoresDeSexo ? (
        <button
          key={v} type="button" className="aulas-sexo-chip" aria-pressed={marcado(v)}
          onClick={() => alternar(grupo, v)}
          title={marcado(v) ? `«${v}» cuenta como ${grupo}` : `Marcar «${v}» como ${grupo}`}
        >
          {v}
        </button>
      ) : (
        <span key={v} className="aulas-sexo-chip" aria-pressed={marcado(v)}>{v}</span>
      )
    ));

  return (
    <div className="aulas-sexo-descartes">
      <div className="aulas-sexo-valores">
        {!variableDeSexo ? (
          <em>Declara primero la variable que dice el sexo: sin ella no hay valores que repartir.</em>
        ) : !valoresDeLaVariable.length ? (
          <em>La base todavía no trae valores en «{variableDeSexo}»: sincroniza y vuelve.</em>
        ) : (
          <>
            <div className="aulas-sexo-grupo">
              <span>Cuentan como mujeres</span>
              <div className="aulas-sexo-chips">{chips("mujeres", esMujer)}</div>
            </div>
            <div className="aulas-sexo-grupo">
              <span>Cuentan como hombres</span>
              <div className="aulas-sexo-chips">{chips("hombres", esHombre)}</div>
            </div>
            <em>
              {sinSexo.length
                ? `${sinSexo.map((v) => `«${v}»`).join(", ")} no ${sinSexo.length === 1 ? "cuenta" : "cuentan"} en ningún sexo: ${sinSexo.length === 1 ? "suma" : "suman"} al total y a ningún grupo de facultad y sexo.`
                : "Cada valor cuenta en un sexo; la cuota de cada grupo de facultad y sexo se llena con esto."}
            </em>
          </>
        )}
      </div>

      <div className="aulas-descartes">
        <span className="aulas-descartes-rotulo"><Ban size={14} aria-hidden="true" /> Fuera del operativo</span>
        <em>
          Respuestas que llegan por la plataforma pero no son del estudio (el QR de capacitación, el de prueba,
          el interno): pasan los filtros y por eso hay que descartarlas aquí. Se sugieren los códigos de
          colector que no casan con ningún curso-horario del plan.
        </em>
        <div className="aulas-sexo-chips">
          {descartes.length ? descartes.map((d) => (
            <span key={d} className="aulas-sexo-chip aulas-descarte" aria-pressed="true">
              {d}
              {onDescartes ? (
                <button type="button" aria-label={`Volver a contar «${d}»`}
                  onClick={() => onDescartes(descartes.filter((x) => x !== d))}>
                  <X size={12} aria-hidden="true" />
                </button>
              ) : null}
            </span>
          )) : <em>Ningún código descartado.</em>}
        </div>
        {onDescartes && sugerencias.length ? (
          <div className="aulas-descartes-sugerencias">
            <span>No casan con ningún curso-horario:</span>
            {sugerencias.map((s) => (
              <button key={s} type="button" className="aulas-sexo-chip"
                title={`Descartar «${s}»: no suma al avance`}
                onClick={() => onDescartes([...descartes, s])}>
                <Plus size={12} aria-hidden="true" /> {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
