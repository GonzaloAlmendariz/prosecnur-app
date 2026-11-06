// Cabecera del Home del proyecto (5 nov 2026, Gonzalo: «puede tener un homepage más elegante y que ocupe mejor
// el espacio»). Reemplaza la franja suelta «desde tu última apertura»: a la izquierda el estudio —su nombre en
// grande y la meta en una línea—, a la derecha lo que cambió desde la última apertura. Es UNA fila, la misma que
// ya ocupaba la franja, así que no le roba alto a las tarjetas. Sin porcentajes globales ni «avance» del estudio
// (los módulos son herramientas independientes: feedback_home_substancia_no_avance).

import type { ProjectOverview } from "../../api/client";
import { BloqueHoy } from "./BloqueHoy";
import { formatSavedAt } from "./moduleCardModel";
import { useNombreOficial } from "./useNombreOficial";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_ESTUDIO } from "../estudio/panelEstudio";
import { FileText } from "../../vendor/lucide-react";
import "./home-hero.css";

export function metaDelEstudio(project: ProjectOverview["project"]): string[] {
  const nombre = (project.name || "").trim();
  const archivo = (project.project_file || "").trim();
  return [
    project.code?.trim(),
    project.client?.trim(),
    // El archivo sólo se nombra si dice algo distinto del nombre (en un .pulso sin Ficha, ambos son «acnur_acg»).
    archivo && archivo.replace(/\.pulso$/i, "") !== nombre ? archivo : "",
    formatSavedAt(project.saved_at),
  ].filter((parte): parte is string => Boolean(parte));
}

/**
 * Qué nombre encabeza el Home y si hay que avisar. Mientras la Ficha no se lee (`undefined`) no se afirma que
 * falte: se muestra el del overview sin aviso.
 */
export function nombreDelEstudio(oficial: string | undefined, project: ProjectOverview["project"]) {
  const respaldo = (project.name || project.project_file || "Proyecto").replace(/\.pulso$/i, "").trim();
  return { nombre: oficial || respaldo, faltaOficial: oficial === "" };
}

export function HomeHero({ overview }: { overview: ProjectOverview }) {
  // 6 nov 2026 (Gonzalo: «la ficha del estudio debería avisar cuando no hay nombre oficial y el nombre oficial
  // debería estar arriba del aviso de forma elegante»): el nombre oficial es el de la Ficha. Arriba va ese
  // nombre en grande; si la Ficha no lo declara, arriba va el del archivo y debajo un aviso que lleva a la
  // Ficha. La línea «desde tu última apertura» queda al final, como estado.
  const oficial = useNombreOficial();
  const panelEstudio = usePanelDireccionable(PANEL_ESTUDIO);
  const { nombre, faltaOficial } = nombreDelEstudio(oficial, overview.project);
  const meta = metaDelEstudio({ ...overview.project, name: nombre });
  return (
    <header className={`home-hero${faltaOficial ? " is-sin-nombre-oficial" : ""}`}>
      <div className="home-hero-estudio">
        <p className="home-hero-ceja">Estudio</p>
        <h1 className="home-hero-nombre" title={nombre}>{nombre}</h1>
        {meta.length ? (
          <p className="home-hero-meta">
            {meta.map((parte, idx) => (
              <span key={parte}>
                {idx > 0 ? <span className="home-hero-sep" aria-hidden="true" /> : null}
                {parte}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="home-hero-estado">
        {faltaOficial ? (
          <p className="home-hero-aviso" role="note">
            <span className="home-hero-aviso-punto" aria-hidden="true" />
            <span>Sin nombre oficial: se muestra el del archivo.</span>
            <button type="button" className="home-hero-aviso-accion" onClick={panelEstudio.abrir}>
              <FileText size={13} aria-hidden="true" /> Declararlo en la Ficha
            </button>
          </p>
        ) : null}
        <BloqueHoy overview={overview} />
      </div>
    </header>
  );
}
