/**
 * Perfil de la muestra seleccionada.
 *
 * Gonzalo, al cerrar el trabajo del histórico: «es un poco irónico, porque
 * ahora el histórico tiene muchísima información y muchísimo detalle […] y no
 * tenemos esa misma calidad de gráficos y hovers para las aulas que
 * seleccionemos este año».
 *
 * La pestaña de titulares ya responde «cuáles salieron» y el diagnóstico de
 * `SeleccionAulasVisual` responde «¿se parece al marco?». Falta la tercera, que
 * es la que se usa al preparar el operativo: **de qué está hecha la muestra**.
 * Una facultad a la que le tocaron sobre todo talleres pequeños no se trabaja
 * como una a la que le tocaron clases teóricas de sesenta, y eso no se ve ni en
 * la lista ni en la desviación respecto al marco.
 *
 * Aquí no hay asistencia ni efectividad: eso todavía no ocurrió. Lo que sí se
 * puede describir es la composición, y sobre ella el marco vigente entra como
 * marca fina de referencia; el año pasado, cuando existe, como una línea de
 * lectura al pie. Ninguno es el protagonista: el dato es la muestra de este año.
 */
import { PieChart } from "lucide-react";
import { useMemo } from "react";
import type { CalcMuestraReferenciaAsistencia } from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { fmtInt } from "../../sharedCore";
import {
  ComposicionCriterio,
  componerCriterio,
  pct,
  type ComposicionDatos,
} from "../shared/graficos/PrimitivasGrafico";
import { tip, useTooltipGrafico } from "../shared/graficos/TooltipGrafico";
import { PerfilSexoBloque } from "./PerfilSexoBloque";
import { construirPerfilSexo } from "./perfilSexoModel";
import "./perfilMuestra.css";

/** Los ejes con los que Marco decide qué aulas entran, en el orden en que se deciden. */
const CRITERIOS: { campos: string[]; label: string }[] = [
  { campos: ["size_group", "grupo_tamano"], label: "Grupo de tamaño" },
  { campos: ["session_type", "tipo_sesion", "tipo_de_curso"], label: "Tipo de sesión" },
  { campos: ["condicion_curso", "condicion"], label: "Condición del curso" },
  { campos: ["course_level_num", "nivel_curso", "level"], label: "Nivel del curso" },
  { campos: ["teacher_type", "tipo_docente"], label: "Tipo de docente" },
  { campos: ["modality", "modalidad"], label: "Modalidad" },
  { campos: ["rango_horario", "bloque_horario"], label: "Rango horario" },
];

const texto = (fila: Record<string, unknown>, campos: string[]): string => {
  for (const campo of campos) {
    const valor = fila[campo];
    if (valor === null || valor === undefined) continue;
    const limpio = String(valor).trim();
    if (limpio && limpio.toUpperCase() !== "NA") return limpio;
  }
  return "";
};

const numero = (fila: Record<string, unknown>, campos: string[]): number => {
  for (const campo of campos) {
    const parsed = Number(fila[campo]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export function AulasPerfilTab({
  titulares,
  marco,
  referencia,
}: {
  /** Los cursos-horario que campo intenta primero. */
  titulares: Record<string, unknown>[];
  /** El marco vigente, para la marca de referencia. */
  marco: Record<string, unknown>[];
  /** El estudio anterior, si el proyecto lo declaró. */
  referencia: CalcMuestraReferenciaAsistencia | null;
}) {
  const { manejadores, tooltip } = useTooltipGrafico();

  const facultadDe = (fila: Record<string, unknown>) =>
    texto(fila, ["faculty", "facultad", "stratum"]) || "Sin facultad";
  const elegiblesDe = (fila: Record<string, unknown>) => numero(fila, ["eligible_n", "elegibles"]);

  const composiciones = useMemo(() => {
    if (!titulares.length) return [];
    return CRITERIOS.flatMap((criterio) => {
      const composicion = componerCriterio({
        filas: titulares,
        criterio: (fila) => texto(fila, criterio.campos) || "Sin dato",
        grupo: facultadDe,
        label: criterio.label,
        peso: elegiblesDe,
      });
      if (!composicion) return [];
      // El marco vigente, en las mismas categorías, para la marca de referencia.
      const enMarco = marco.length
        ? componerCriterio({
            filas: marco,
            criterio: (fila) => texto(fila, criterio.campos) || "Sin dato",
            grupo: () => "marco",
            label: criterio.label,
          })
        : null;
      return [{
        composicion,
        referencia: enMarco?.categorias.map((c) => ({ categoria: c.categoria, pct: c.pct })) ?? undefined,
      }];
    });
  }, [titulares, marco]);

  const porFacultad = useMemo(() => {
    const mapa = new Map<string, { n: number; elegibles: number }>();
    for (const fila of titulares) {
      const clave = facultadDe(fila);
      const actual = mapa.get(clave) ?? { n: 0, elegibles: 0 };
      mapa.set(clave, { n: actual.n + 1, elegibles: actual.elegibles + elegiblesDe(fila) });
    }
    return [...mapa.entries()]
      .map(([facultad, datos]) => ({ facultad, ...datos }))
      .sort((a, b) => b.n - a.n);
  }, [titulares]);

  const totalElegibles = porFacultad.reduce((acc, f) => acc + f.elegibles, 0);
  const maxAulas = Math.max(1, ...porFacultad.map((f) => f.n));

  if (!titulares.length) {
    return (
      <section
        className="cmv2-perfil-vacio"
        data-audit-ready="false"
        data-qa-geometry-group="calc-muestra/aulas-perfil"
        data-qa-geometry-contract="intrinsic"
        aria-label="Perfil de la muestra seleccionada"
      >
        <EmptyState
          icon={<PieChart size={22} aria-hidden="true" />}
          title="Todavía no hay una selección que perfilar"
          hint="Corre la selección en «Cursos-horario titulares» y aquí verás de qué está hecha, facultad por facultad."
        />
      </section>
    );
  }

  return (
    <section
      className="cmv2-perfil"
      data-audit-ready="true"
      data-qa-geometry-group="calc-muestra/aulas-perfil"
      data-qa-geometry-contract="intrinsic"
      aria-label="Perfil de la muestra seleccionada"
      {...manejadores}
    >
      {tooltip}

      {/* 1 · Cuánto pesa cada facultad en la muestra que va a campo. */}
      <div className="cmv2-perfil-bloque">
        <header className="cmv2-perfil-head">
          <span className="cmv2-eyebrow">Lo que va a campo</span>
          <h4>
            {fmtInt(titulares.length)} cursos-horario titulares en {fmtInt(porFacultad.length)}{" "}
            facultades
          </h4>
          <p>
Aulas y estudiantes elegibles no van juntos: una facultad puede tener pocas aulas
            y muchos elegibles si las suyas son grandes.
          </p>
        </header>
        <ol className="cmv2-perfil-facultades">
          {porFacultad.map((fila) => (
            <li key={fila.facultad}>
              <span className="cmv2-perfil-facultad-nombre">{fila.facultad}</span>
              <span
                className="cmv2-perfil-facultad-track"
                {...tip({
                  titulo: fila.facultad,
                  filas: [
                    { label: "Cursos-horario", valor: fmtInt(fila.n) },
                    { label: "Estudiantes elegibles", valor: fmtInt(fila.elegibles) },
                    {
                      label: "De la muestra",
                      valor: pct(fila.n / titulares.length, 0),
                    },
                    {
                      label: "Elegibles por aula",
                      valor: fila.n > 0 ? fmtInt(Math.round(fila.elegibles / fila.n)) : "—",
                    },
                  ],
                })}
              >
                <span style={{ width: `${(fila.n / maxAulas) * 100}%` }} />
              </span>
              <span className="cmv2-perfil-facultad-n">{fmtInt(fila.n)}</span>
              <span className="cmv2-perfil-facultad-eleg">{fmtInt(fila.elegibles)}</span>
            </li>
          ))}
        </ol>
        <p className="cmv2-perfil-pie">
          <strong>{fmtInt(totalElegibles)}</strong> estudiantes elegibles alcanzables en total,{" "}
          <strong>{fmtInt(Math.round(totalElegibles / titulares.length))}</strong> por aula en
          promedio.
        </p>
      </div>

      {/* 2 · De qué tipo son esas aulas, criterio por criterio. */}
      {composiciones.length > 0 ? (
        <div className="cmv2-perfil-bloque">
          <header className="cmv2-perfil-head">
            <span className="cmv2-eyebrow">De qué está hecha la muestra</span>
            <h4>Qué tipo de cursos-horario le tocó a cada facultad</h4>
            <p>
              Quién concentra un tipo de aula que el resto casi no tiene, porque eso cambia cómo hay
              que trabajarla en campo.
              {marco.length > 0
                ? " La línea marca dónde caería el corte con la composición del marco."
                : ""}
            </p>
          </header>
          {composiciones.map(({ composicion, referencia: marcas }) => (
            <div className="cmv2-perfil-criterio" key={composicion.criterio_label}>
              <span className="cmv2-eyebrow">{composicion.criterio_label}</span>
              <ComposicionCriterio composicion={composicion} referencia={marcas} />
            </div>
          ))}
        </div>
      ) : null}

      {/* 2b · I5: el sexo, la dimensión que el estudio certifica por celda y
          este perfil callaba mientras enseñaba tamaño, sesión y nivel. */}
      <PerfilSexoBloque perfil={construirPerfilSexo(titulares, marco)} />

      {/* 3 · El año pasado, como lectura al pie y nunca como protagonista. */}
      {referencia?.cadena ? (
        <div className="cmv2-perfil-bloque cmv2-perfil-bloque-tenue">
          <header className="cmv2-perfil-head">
            <span className="cmv2-eyebrow">Lo que pasó el año pasado</span>
            <h4>Qué esperar de estas aulas, según el estudio anterior</h4>
          </header>
          <ul className="cmv2-perfil-referencia">
            <li>
              <strong>{pct(referencia.cadena.asistencia.tasa, 0)}</strong>
              <span>de los estudiantes del estudio fue a clase el día de la visita</span>
            </li>
            <li>
              <strong>{pct(referencia.cadena.efectividad.tasa, 0)}</strong>
              <span>de quienes tocaba encuestar completó la encuesta</span>
            </li>
            <li>
              <strong>{pct(referencia.cadena.rendimiento.tasa, 0)}</strong>
              <span>encuestas completas por estudiante del estudio</span>
            </li>
            {referencia.cadenas_reemplazo ? (
              <li>
                <strong>
                  {pct(
                    referencia.cadenas_reemplazo.cadenas_declaradas > 0
                      ? referencia.cadenas_reemplazo.resueltas_con_reemplazo /
                        referencia.cadenas_reemplazo.cadenas_declaradas
                      : null,
                    0,
                  )}
                </strong>
                <span>de los titulares necesitó bajar a un reemplazo</span>
              </li>
            ) : null}
          </ul>
          <p className="cmv2-perfil-pie">
            Del estudio {referencia.estudio.label || "anterior"}
            {referencia.estudio.periodo ? ` · ${referencia.estudio.periodo}` : ""}. El detalle
            completo vive en Datos › Histórico.
          </p>
        </div>
      ) : null}
    </section>
  );
}
