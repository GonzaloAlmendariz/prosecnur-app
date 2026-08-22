import { classroomMethodLabel } from "./classroomLabels";
import { Link } from "react-router-dom";
import { Award } from "../../../../vendor/lucide-react";
import { CALC_MUESTRA_UNIVERSIDAD_PESTANAS } from "../../../../lib/navegacion/catalogos/calcMuestra";
import { MetodoGooEsquema } from "../../didactica/MetodoGooEsquema";
import type { ClassroomMethodDecision } from "./classroomMethodStoriesModel";
import { CLASSROOM_METHOD_STORIES } from "./classroomMethodStoriesModel";
import "./classroomMethodStories.css";

/**
 * La dirección canónica del Relato sale del catálogo (ADR 0044/0067): la
 * tarjeta enlaza a «ver con tus aulas reales» cuando la selección existe.
 */
const RELATO_TO =
  CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas.find((tab) => tab.id === "aulas-relato")?.to ??
  "/calc-muestra?modo=opinion-universitaria&seccion=aulas&pestana=aulas-relato";

export function ClassroomMethodDecisionHero({ decision }: { decision: ClassroomMethodDecision }) {
  const recommended = decision.kind === "recommended";
  return (
    <section
      className={`cmv2-panel cmv2-aulas-panel cmv2-method-decision${recommended ? " is-recommended" : ""}`}
      data-qa-geometry-group="aulas-metodo-decision"
      data-qa-geometry-contract="intrinsic"
    >
      <div data-qa-geometry-member>
        <small>{recommended ? "Recomendado por el comparador vigente" : "Método configurado"}</small>
        <strong>{decision.label}</strong>
        <p>{decision.reason}</p>
      </div>
      <span data-qa-geometry-member data-qa-geometry-capacity="owned">
        {recommended ? <><Award size={16} aria-hidden="true" /> Recomendación acreditada</> : "Sin atribución al engine"}
      </span>
    </section>
  );
}

export function ClassroomMethodStories({
  configuredMethodId,
  recommendedMethodId,
  relatoDisponible = false,
  onConfigure,
}: {
  configuredMethodId: string;
  recommendedMethodId?: string;
  /** true cuando existe una selección vigente: habilita el enlace al Relato. */
  relatoDisponible?: boolean;
  onConfigure: (methodId: string) => void;
}) {
  return (
    <div
      className="cmv2-method-stories"
      data-qa-geometry-group="aulas-metodo-historias"
      data-qa-geometry-contract="equal"
    >
      {CLASSROOM_METHOD_STORIES.map((story) => {
        const configured = story.id === configuredMethodId;
        const recommended = story.id === recommendedMethodId;
        return (
          <article
            key={story.id}
            className={`cmv2-method-story${configured ? " is-configured" : ""}${recommended ? " is-recommended" : ""}`}
            data-qa-geometry-member
          >
            <header>
              <small>{story.badge}</small>
              {recommended && <span><Award size={11} aria-hidden="true" /> recomendado</span>}
            </header>
            <strong>{classroomMethodLabel(story.id)}</strong>
            <p>{story.story}</p>
            {/* Mini-goo ilustrativo del mecanismo (didactica/): declara que no
                son aulas reales; la corrida real se narra en el Relato. */}
            <MetodoGooEsquema metodo={story.id} leyenda={false} />
            <button
              type="button"
              className={configured ? "cmv2-primary" : "cmv2-ghost"}
              aria-pressed={configured}
              onClick={() => onConfigure(story.id)}
            >
              {configured ? "Método configurado" : "Configurar este método"}
            </button>
            {relatoDisponible && (
              <Link className="cmv2-method-story-relato" to={RELATO_TO}>
                Ver con tus aulas reales
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
