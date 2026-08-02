import { useEffect, useRef, useState } from "react";
import {
  createCriteriosPreviewCoordinator,
  type CalcMuestraCriteriosCascada,
  type CalcMuestraCriteriosPreviewInput,
  type CalcMuestraCriteriosPreviewState,
} from "../../../../api/calcMuestraCriteriosI18b";
import "./criteriosI18b.css";

const INTEGER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });

function fmt(value: number): string {
  return INTEGER.format(value);
}

function useCascadePreview(request: CalcMuestraCriteriosPreviewInput | null) {
  const coordinatorRef = useRef<ReturnType<typeof createCriteriosPreviewCoordinator> | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = createCriteriosPreviewCoordinator();
  const [state, setState] = useState<CalcMuestraCriteriosPreviewState | null>(null);

  useEffect(() => {
    const coordinator = coordinatorRef.current!;
    if (!request) {
      coordinator.cancel();
      setState(null);
      return;
    }
    setState({ status: "loading" });
    const timer = globalThis.setTimeout(() => {
      void coordinator.run(request, setState);
    }, 220);
    return () => {
      globalThis.clearTimeout(timer);
      coordinator.cancel();
    };
  }, [request]);

  return state;
}

export function CriteriosEmbudoVivo({
  cardId,
  executed,
  previewRequest,
  facultyKey,
}: {
  cardId: string;
  executed: CalcMuestraCriteriosCascada | null;
  previewRequest: CalcMuestraCriteriosPreviewInput | null;
  facultyKey?: string;
}) {
  const previewState = useCascadePreview(previewRequest);
  const cascade = previewState?.status === "ready" ? previewState.data : executed;
  const firstIndex = cascade?.steps.findIndex((step) => step.card_id === cardId) ?? -1;
  const siguientes = firstIndex >= 0 ? cascade!.steps.slice(firstIndex) : [];

  if (!cascade) {
    return (
      <div className="cmv2-i18b-cascade-empty" role="status" data-state="sin_cascada">
        <strong>Sin cascada secuencial acreditable</strong>
        <span>Reconstruye el marco para publicar el orden real y sus recortes por facultad.</span>
      </div>
    );
  }

  return (
    <div className="cmv2-i18b-cascade" data-momento={cascade.momento}>
      <header className="cmv2-i18b-cascade-head">
        <div>
          <strong>Qué queda después de cada criterio</strong>
          <span>En el orden en que el motor los aplica, desde este criterio en adelante</span>
        </div>
        <span>{cascade.momento === "borrador_no_persistido" ? "Borrador no persistido" : "Marco ejecutado"}</span>
      </header>
      {previewState?.status === "loading" ? (
        <p className="cmv2-i18b-cascade-state" role="status">Recalculando lo que queda después de este criterio…</p>
      ) : previewState?.status === "stale" || previewState?.status === "error" ? (
        <p className="cmv2-i18b-cascade-state" role="alert" data-state={previewState.status}>
          {previewState.message} Se conserva visible la última cascada ejecutada.
        </p>
      ) : null}
      {!siguientes.length ? (
        <p className="cmv2-i18b-cascade-state" role="status">
          El motor no publicó un paso para esta tarjeta dentro de la cascada vigente.
        </p>
      ) : (
        <ol
          className="cmv2-i18b-cascade-steps"
          data-qa-geometry-group="calc-muestra/criterios-cascada-pasos"
          data-qa-geometry-contract="intrinsic"
        >
          {siguientes.map((step) => (
            <li
              key={`${step.order}:${step.criterion_id}`}
              data-current-card={step.card_id === cardId ? "true" : "false"}
              data-applies={step.applies ? "true" : "false"}
              data-qa-geometry-member
              data-qa-geometry-capacity="owned"
            >
              <header>
                <span>Paso {step.order}</span>
                <strong>{step.label}</strong>
                {/* ADR 0057 · «gate · aplicado» era vocabulario del motor y se
                    tradujo a «recorta el marco». Pero `status === "aplicado"`
                    significa que el criterio **se aplicó**, no que quitara
                    nada: el Paso 6 mostraba «recorta el marco» junto a su
                    propia fila «849 → 849 · quedan fuera: ninguno».
                    Una etiqueta que contradice la cifra de al lado es peor que
                    la jerga que vino a reemplazar, porque la jerga al menos no
                    afirmaba nada falso. Ahora la etiqueta la decide el dato. */}
                <small>
                  {!step.gate
                    ? "no quita cursos-horario"
                    : step.status !== "aplicado"
                      ? "todavía no se aplicó"
                      : (step.total?.excluded_ch ?? 0) > 0
                        ? "recorta el marco"
                        : "se aplicó y no quitó ninguno"}
                </small>
              </header>
              <div className="cmv2-i18b-cascade-table-wrap">
                <table>
                  <thead><tr><th scope="col">Facultad efectiva</th><th scope="col">Cursos-horario: antes → después</th><th scope="col">Quedan fuera</th></tr></thead>
                  <tbody>
                    {!facultyKey ? (
                      <tr data-row-kind="total">
                        <th scope="row">Total recalculado por R</th>
                        <td>{fmt(step.total.before_ch)} → {fmt(step.total.after_ch)}</td>
                        <td>{step.total.excluded_ch ? `−${fmt(step.total.excluded_ch)}` : "ninguno"}</td>
                      </tr>
                    ) : null}
                    {step.faculties.filter((faculty) => (
                      !facultyKey || faculty.faculty_key === facultyKey
                    )).map((faculty) => (
                      <tr key={faculty.faculty_key}>
                        <th scope="row">{faculty.label}</th>
                        <td>{fmt(faculty.before_ch)} → {fmt(faculty.after_ch)}</td>
                        <td>{faculty.excluded_ch ? `−${fmt(faculty.excluded_ch)}` : "ninguno"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ol>
      )}
      <footer>Unidad: curso-horario único · firma {cascade.criteria_hash.slice(0, 12)}</footer>
    </div>
  );
}
