import { useMemo } from "react";

import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt } from "./kpisDeAulas";
import "./efectividadSeguimiento.css";

/**
 * La τ del diseño contra la del campo (ADR 0082).
 *
 * **Qué es τ.** El dimensionamiento compra aforo con `⌈cuota / (p25 × τ)⌉`. Esa
 * τ no es una constante de la app: cada facultad tiene la suya, compuesta como
 * `mix_de_tamaños × factor_residual`, y los quince valores de HSVG2026 —de
 * 0,409 en EE.GG. Ciencias a 0,800 en Letras— salen del campo 2025 y de ningún
 * otro sitio.
 *
 * **Por qué esta pantalla existe.** El módulo de certeza declara, literal, que
 * NO cubre la incertidumbre de τ, y esa exención no tenía destinatario: el
 * tablero contaba aulas aplicadas y encuestas conseguidas, nunca la tasa que
 * las liga. Medido: con τ un 5 % por debajo, EE.GG. Ciencias cierra 4,1 alumnos
 * corta. Y el riesgo no es el que el operativo teme —en 2025 sólo 2 de 196
 * aulas no se aplicaron—: es que baje la asistencia general, que hasta hoy no
 * disparaba nada.
 *
 * **Qué NO es esta pantalla.** No es cumplimiento: la brecha contra la cuota
 * vive en el bloque de cuotas y tiene otro denominador. Lo de aquí son los
 * alumnos ATRIBUIBLES A τ —lo que se pierde porque las aulas rinden distinto de
 * lo supuesto— sobre las aulas que ya se aplicaron.
 *
 * **Y no recalcula nada.** Tasas, bandas, déficits y reservas los publica el
 * motor: si la vista los recompusiera, dos superficies del mismo número
 * acabarían discrepando, que es cómo nacieron las tres tasas homónimas que este
 * ADR vino a separar.
 */

const p1 = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Alumnos con signo: el signo ES el dato, y un «4,1» pelado no dice de qué lado. */
const alumnos = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.round(Math.abs(n) * 10) / 10;
  if (v === 0) return "0";
  return `${n < 0 ? "−" : "+"}${v.toLocaleString("es-PE")}`;
};

/**
 * Lo que hay que hacer con esta facultad, en una frase.
 *
 * La regla de la señal vive en el motor; aquí sólo se traduce. Ninguna rama
 * inventa un veredicto que el bloque no haya declarado: `conforme` y
 * `sin_banda` dicen por qué NO se actúa, que es tan informativo como el rojo —y
 * es lo que impide que alguien lea un silencio como un visto bueno.
 */
function lectura(f: MonitoreoAulasEfectividadFacultad): string {
  if (f.senal === "sin_previsto") return "El diseño no le supuso una tasa: no hay vara contra la que medir.";
  if (f.senal === "sin_banda") {
    return f.aulas_aplicadas === 0
      ? "Todavía no tiene aulas aplicadas."
      : "Una sola aula aplicada: no hay dispersión que medir todavía.";
  }
  if (f.senal === "sobre") return "Rinde por encima de lo supuesto.";
  if (f.senal === "conforme") return "La diferencia cabe dentro de lo que el dato sostiene.";
  const falta = f.alumnos_cierre != null && f.alumnos_cierre < 0 ? Math.round(Math.abs(f.alumnos_cierre)) : 0;
  if (f.reservas_libres === 0) {
    return `Rinde por debajo: al cierre faltarían ${fmt(falta)} y no le quedan reservas libres.`;
  }
  if (f.reservas_alcanzan && f.reservas_necesarias != null) {
    return `Rinde por debajo: ${fmt(f.reservas_necesarias)} ${f.reservas_necesarias === 1 ? "reserva cierra" : "reservas cierran"} los ${fmt(falta)} que faltarían al cierre.`;
  }
  const resto = f.sin_cubrir != null && Number.isFinite(f.sin_cubrir) ? Math.round(f.sin_cubrir) : null;
  return `Rinde por debajo: ni activando sus ${fmt(f.reservas_libres)} reservas se cierran los ${fmt(falta)}${resto ? `, quedarían ${fmt(resto)}` : ""}.`;
}

export function AulasEfectividadSeguimiento({
  bloque, facultadEnFoco, onFoco,
}: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  /** Resalta, no filtra: igual que el resto de listas del perfil. */
  facultadEnFoco?: string;
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const filas = useMemo(
    () => (bloque?.facultades ?? []).filter((f) => f.tau_previsto != null || f.aulas_aplicadas > 0),
    [bloque],
  );

  // La escala COMPARTIDA por todas las filas. Se calcula sobre lo que hay que
  // dibujar —previstas, observadas y extremos de banda— y no sobre [0,1]: con
  // τ entre 0,4 y 0,8 la mitad de la pista quedaría siempre vacía y las
  // diferencias que deciden se verían como matices.
  const tope = useMemo(() => {
    const vals = filas.flatMap((f) => [f.tau_previsto, f.tau_observado, f.banda_alto])
      .filter((v): v is number => v != null && Number.isFinite(v));
    return Math.min(1, Math.max(0.2, ...vals) * 1.08);
  }, [filas]);

  // C3: el vacío es SUYO y dice cuál de los dos vacíos es. «Sin diseño» y «sin
  // campo» se arreglan de maneras distintas, y un mensaje único obligaría a
  // adivinar cuál toca.
  if (!bloque) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        El estudio todavía no publica el seguimiento de efectividad.
      </p>
    );
  }
  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {bloque.vigencia === "sin_diseno"
          ? "El estudio importado no trae la tasa de efectividad que dimensionó las aulas, así que no hay vara contra la que medir el campo."
          : "Todavía no hay aulas aplicadas: la tasa que rinde el campo se puede empezar a medir con la primera."}
      </p>
    );
  }

  const t = bloque.total;
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / tope) * 100))}%`;

  return (
    <div className="aulas-tau" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* C1: la superficie declara qué mide ANTES de la primera cifra. Sin esto,
          «0,51» junto a «0,53» son dos números sin pregunta. */}
      <p className="aulas-tau-cabeza">
        <span>
          El diseño supuso <strong>{p1(t.tau_previsto)}</strong> de efectividad para el aforo ya
          aplicado; el campo está rindiendo <strong>{p1(t.tau_observado)}</strong>
          {t.banda_bajo != null && t.banda_alto != null
            ? <> (banda {p1(t.banda_bajo)}–{p1(t.banda_alto)})</>
            : null}
          {" "}sobre {fmt(t.aulas_aplicadas)} {t.aulas_aplicadas === 1 ? "aula aplicada" : "aulas aplicadas"}.
        </span>
        {/* Los alumnos en riesgo NO se compensan entre facultades: pasarse en una
            no cubre lo que falta en otra. Por eso se dice cuántas facultades los
            producen, en vez de un neto que siempre saldría más favorable. */}
        {t.facultades_senaladas > 0 ? (
          <span>
            <strong>{fmt(Math.round(t.alumnos_en_riesgo))}</strong> alumnos en riesgo en{" "}
            {fmt(t.facultades_senaladas)} {t.facultades_senaladas === 1 ? "facultad" : "facultades"}.
          </span>
        ) : (
          <span>Ninguna facultad rinde por debajo de forma que el dato lo sostenga.</span>
        )}
        <span className="aulas-tau-sello">
          numerador: efectiva de plataforma · respaldo del supuesto: campo anterior
          {bloque.vigencia !== "vigente" && bloque.motivo ? ` · ${bloque.motivo}` : ""}
        </span>
      </p>

      <ul className="aulas-tau-lista">
        <li className="aulas-tau-cabecera" aria-hidden="true">
          <span>Facultad</span>
          <span>τ campo</span>
          <span>banda contra la τ del diseño</span>
          <span>alumnos</span>
          <span>reservas</span>
        </li>
        {filas.map((f) => {
          const enFoco = f.facultad === facultadEnFoco;
          const clases = [
            f.senal === "bajo" ? "es-bajo" : f.senal === "sobre" ? "es-sobre" : "",
            enFoco ? "es-en-foco" : "",
          ].filter(Boolean).join(" ");
          return (
            <li key={f.faculty_key} className={clases || undefined}>
              <NombreDeFacultad facultad={f.facultad} className="aulas-tau-nombre"
                enFoco={enFoco} onFoco={onFoco}>
                {f.facultad}
                <em>
                  {fmt(f.aulas_aplicadas)} {f.aulas_aplicadas === 1 ? "aula" : "aulas"} ·{" "}
                  {fmt(f.efectivas)} de {fmt(f.elegibles_aplicados)}
                  {/* Un residual de 1 sin base propia se DICE. Nueve de quince
                      facultades lo llevan y hasta hoy se leían como medidas. */}
                  {f.residual_base === "sin_base" ? " · sin base histórica propia" : ""}
                </em>
              </NombreDeFacultad>
              <span className={`aulas-tau-cifra${f.senal === "sin_banda" ? " es-debil" : ""}`}>
                {p1(f.tau_observado)}
              </span>
              <span className="aulas-tau-pista" title={lectura(f)}>
                {f.banda_bajo != null && f.banda_alto != null ? (
                  <span
                    className="aulas-tau-banda"
                    style={{ left: pos(f.banda_bajo), width: `calc(${pos(f.banda_alto)} - ${pos(f.banda_bajo)})` }}
                  />
                ) : f.tau_observado != null ? (
                  <span className="aulas-tau-punto" style={{ left: pos(f.tau_observado) }} />
                ) : null}
                {f.tau_previsto != null ? (
                  <span className="aulas-tau-vara" style={{ left: pos(f.tau_previsto) }} title={`τ del diseño ${p1(f.tau_previsto)}`} />
                ) : null}
              </span>
              <span className={`aulas-tau-cifra${f.senal === "bajo" ? "" : " es-debil"}`}>
                {alumnos(f.alumnos_cierre)}
              </span>
              <span className="aulas-tau-cifra es-debil">
                {f.senal === "bajo" && f.reservas_alcanzan && f.reservas_necesarias != null
                  ? `${fmt(f.reservas_necesarias)} de ${fmt(f.reservas_libres)}`
                  : `${fmt(f.reservas_libres)} libres`}
              </span>
            </li>
          );
        })}
      </ul>

      {/* El pie nombra las columnas que no se explican solas, una vez. Sin él,
          «alumnos» se lee como brecha contra la cuota, que es otro número. */}
      <p className="aulas-tau-pie">
        La marca vertical es la <code>τ</code> que el diseño supuso para esa facultad; la barra, lo
        que el campo rinde con su margen al 95 %. Se señala cuando la barra no llega a tocar la
        marca — nunca por la diferencia sola, que con pocas aulas es ruido.{" "}
        <strong>Alumnos</strong> son los que sobran o faltan por rendir distinto de lo supuesto, no
        la brecha contra la cuota.
      </p>
    </div>
  );
}
