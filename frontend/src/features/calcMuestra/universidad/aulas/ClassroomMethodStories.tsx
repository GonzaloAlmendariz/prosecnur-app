import { Award, MoveHorizontal, Scale, Shuffle } from "../../../../vendor/lucide-react";
import type { ClassroomMethodDecision } from "./classroomMethodStoriesModel";
import { CLASSROOM_METHOD_STORIES } from "./classroomMethodStoriesModel";
import "./classroomMethodStories.css";

function MethodStoryVisual({ visual }: { visual: typeof CLASSROOM_METHOD_STORIES[number]["visual"] }) {
  if (visual === "systematic") {
    return (
      <div className="cmv2-method-story-visual is-systematic" role="img" aria-label="Recta ordenada que selecciona un curso-horario cada paso k">
        <MoveHorizontal size={14} aria-hidden="true" />
        <div>{Array.from({ length: 10 }, (_, index) => <i key={index} data-picked={index % 3 === 1 || undefined} />)}</div>
        <strong>+ k</strong>
      </div>
    );
  }
  if (visual === "cube") {
    return (
      <div className="cmv2-method-story-visual is-cube" role="img" aria-label="Tres balanzas ajustan facultad, sexo esperado y tamaño">
        <Scale size={14} aria-hidden="true" />
        {[
          ["Facultad", "68%"],
          ["Sexo", "52%"],
          ["Tamaño", "76%"],
        ].map(([label, width]) => <span key={label}><b>{label}</b><i><em style={{ width }} /></i></span>)}
      </div>
    );
  }
  if (visual === "pivotal") {
    return (
      <div className="cmv2-method-story-visual is-pivotal" role="img" aria-label="Pares de vecinos parecidos se separan conservando su probabilidad total">
        <Shuffle size={14} aria-hidden="true" />
        <div>{Array.from({ length: 6 }, (_, index) => <i key={index} data-side={index % 2 ? "right" : "left"} />)}</div>
        <strong>vecinos → separados</strong>
      </div>
    );
  }
  return (
    <div className="cmv2-method-story-visual is-pool" role="img" aria-label="Quinientas muestras candidatas se reducen a la de mejor resultado">
      <Shuffle size={14} aria-hidden="true" />
      <div>{Array.from({ length: 9 }, (_, index) => <i key={index} data-best={index === 6 || undefined} />)}</div>
      <strong>500 → mejor 1</strong>
    </div>
  );
}

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
  onConfigure,
}: {
  configuredMethodId: string;
  recommendedMethodId?: string;
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
            <strong>{story.title}</strong>
            <p>{story.story}</p>
            <MethodStoryVisual visual={story.visual} />
            <button
              type="button"
              className={configured ? "cmv2-primary" : "cmv2-ghost"}
              aria-pressed={configured}
              onClick={() => onConfigure(story.id)}
            >
              {configured ? "Método configurado" : "Configurar este método"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
