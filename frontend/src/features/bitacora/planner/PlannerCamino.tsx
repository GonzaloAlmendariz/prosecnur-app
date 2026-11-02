// Planner › Camino › Recorrido (ADR 0123 §4, Q5): por qué módulos pasa cada
// perfil del estudio, una fila por perfil y una columna por etapa. Sale de los
// tipos declarados y no guarda otra verdad. Es un camino, no un mando: no lee
// el avance de nadie ni bloquea nada; cada módulo sigue mostrando el suyo.

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import type { PlannerPerfil } from "../../../api/planner";
import { moduleChromeVars, PROSECNUR_MODULES, type ProsecnurModuleSlug } from "../../../lib/modules";
import { PlannerCabecera } from "./PlannerCabecera";
import { campanasDeAcreditacion, ETIQUETA_PERFIL } from "./plannerCopia";
import type { ControlPlanner } from "./usePlanner";

const ETAPAS = ["Diseño muestral", "Instrumento", "Material de campo", "Seguimiento", "Resultados"] as const;

type Paso = { modulo: ProsecnurModuleSlug | null; titulos: string[]; detalle: string };

function tono(slug: ProsecnurModuleSlug | null): CSSProperties | undefined {
  const meta = slug ? PROSECNUR_MODULES.find((m) => m.slug === slug) : null;
  return meta ? moduleChromeVars(meta) : undefined;
}

function recorrido(p: PlannerPerfil): Paso[] {
  const diseno: Paso = p.diseno === "calc-muestra"
    ? { modulo: "calc-muestra", titulos: ["Cálculo de muestra"], detalle: "Tamaño y reparto" }
    : p.diseno === "hojas-ruta"
      ? { modulo: "hojas-ruta", titulos: ["Hojas de ruta"], detalle: "Sorteo de manzanas" }
      : p.diseno === "cuotas"
        ? { modulo: null, titulos: ["Metas por cuota"], detalle: "Sin sorteo" }
        : { modulo: null, titulos: ["Lista del cliente"], detalle: "Sin sorteo" };
  const material: Paso = p.tipo === "acreditacion"
    ? { modulo: "material-campo", titulos: campanasDeAcreditacion(p), detalle: "Una campaña por canal" }
    : { modulo: "material-campo", titulos: [{ territorial: "Campaña territorial", aulas: "Campo en aulas", telefonico: "Barrido telefónico" }[p.tipo]], detalle: "Lo que sale a campo" };
  return [
    diseno,
    { modulo: "editor-xlsform", titulos: ["Formularios"], detalle: "El instrumento" },
    material,
    { modulo: "monitoreo", titulos: ["Monitoreo"], detalle: { territorial: "Territorial", aulas: "Cursos-horario", telefonico: "Telefónico", acreditacion: "Acreditación" }[p.tipo] },
    { modulo: "procesamiento", titulos: ["Procesamiento"], detalle: "Y el Dashboard" },
  ];
}

export function PlannerCamino({ control }: { control: ControlPlanner }) {
  const { estado } = control;
  if (!estado) return null;
  const perfiles = estado.origen.perfiles === "declarado" ? estado.planner.perfiles : [];

  return (
    <div className="planner-seccion" data-audit-ready="planner-camino">
      <PlannerCabecera
        titulo="Recorrido del estudio"
        lead="Por qué módulos pasa cada perfil. Sale de los tipos de estudio: no lee el avance de nadie ni obliga a seguir el orden, y cada módulo sigue mostrando su propio camino."
      />
      {perfiles.length === 0 ? (
        <div className="planner-vacio">
          El recorrido sale de los tipos de estudio, y todavía no hay ninguno declarado.{" "}
          <Link to="/planner?seccion=estudio&pestana=perfiles">Declarar los tipos de estudio</Link>
        </div>
      ) : (
        <div className="planner-carriles" role="table" aria-label="Recorrido por perfil y etapa">
          <div className="planner-carril planner-carril--cabecera" role="row">
            <span role="columnheader">Perfil</span>
            {ETAPAS.map((e) => <span key={e} role="columnheader">{e}</span>)}
          </div>
          {perfiles.map((p) => (
            <div key={p.tipo} className="planner-carril" role="row">
              <span className="planner-carril-perfil" role="rowheader">{ETIQUETA_PERFIL[p.tipo]}</span>
              {recorrido(p).map((paso, i) => (
                <span key={ETAPAS[i]} className="planner-carril-celda" role="cell">
                  <span className="planner-carril-pila">
                    {paso.titulos.map((t) => (
                      <span key={t} className={`planner-paso${paso.modulo ? "" : " is-sin-modulo"}`} style={tono(paso.modulo)}>
                        <b>{t}</b>
                        {paso.titulos.length === 1 ? <small>{paso.detalle}</small> : null}
                      </span>
                    ))}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
