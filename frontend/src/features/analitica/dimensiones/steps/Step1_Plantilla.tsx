import { useState } from "react";
import { CheckCircle2, FilePlus2, FileSpreadsheet, Gauge, ListChecks, Network } from "lucide-react";
import { PlantillaCard } from "../shared/PlantillaCard";
import { JsonImportPanel } from "../confirmar-import/JsonImportPanel";
import { useDimensionesWizardStore } from "../store";

// Step 1 — Punto de partida. Dos caminos genéricos:
//
// • Confirmar JSON: el analista sube una plantilla exportada (de otro
//   proyecto, de una plantilla institucional, etc.). Se valida contra
//   el instrumento del proyecto activo. El wizard arranca en step 3
//   con las coincidencias preseleccionadas.
// • Desde cero: arranca el wizard vacío. Step 2 detecta listas, step 3
//   propone bloques desde el XLSForm.
//
// El software es neutral por diseño: no incluye plantillas hardcoded
// específicas a ningún estudio. Las plantillas concretas (GIZ, otros)
// viven como archivos JSON que el analista elige importar.

const FLUJO_GUIA = [
  {
    icon: ListChecks,
    title: "Selecciona preguntas evaluativas",
    copy: "Confirma qué escalas del instrumento entran al cálculo.",
  },
  {
    icon: Network,
    title: "Agrupa por temas",
    copy: "Ordena las preguntas en bloques que reflejen el diseño del estudio.",
  },
  {
    icon: Gauge,
    title: "Genera puntajes comparables",
    copy: "Crea variables 0-100 listas para Cruces, Gráficos y Dashboard.",
  },
];

export function Step1_Plantilla({ onAdvance }: { onAdvance: (toStep: 2 | 3 | 5) => void }) {
  const setDraft = useDimensionesWizardStore((s) => s.setDraft);
  const setVarsFaltantesJson = useDimensionesWizardStore((s) => s.setVarsFaltantesJson);
  const [importOpen, setImportOpen] = useState(false);

  function elegirDesdeCero() {
    // No tocamos draft (queda en EMPTY_DRAFT por default).
    onAdvance(2);
  }

  return (
    <div className="analitica-dimensiones-step-one">
      <header className="analitica-dimensiones-step-one-head">
        <h2>
          Elige el punto de partida
        </h2>
        <p>
          Las dimensiones convierten preguntas evaluativas en puntajes 0-100.
          Puedes partir de una estructura ya acordada o crear una nueva con ayuda del asistente.
        </p>
      </header>

      <div className="analitica-dimensiones-step-one-layout">
        <div className="analitica-dimensiones-template-grid">
          <PlantillaCard
            index={0}
            icon={FileSpreadsheet}
            accent="#7c3aed"
            iconBg="#f5f3ff"
            iconFg="#7c3aed"
            iconBorder="#ddd6fe"
            title="Aplicar plantilla de dimensiones"
            blurb="Para estudios con una estructura ya acordada. Prosecnur la compara con el instrumento activo antes de generar puntajes."
            highlights={[
              "Revisa qué preguntas coinciden",
              "Marca lo que no aplica a este estudio",
              "Conserva bloques e índices acordados",
            ]}
            ctaLabel="Elegir plantilla .json"
            onClick={() => setImportOpen(true)}
          />
          <PlantillaCard
            index={1}
            icon={FilePlus2}
            accent="#059669"
            iconBg="#ecfdf5"
            iconFg="#059669"
            iconBorder="#a7f3d0"
            title="Crear desde el instrumento"
            blurb="Para estudios sin plantilla previa. El asistente detecta escalas, sugiere bloques desde el XLSForm y deja que confirmes la organización final."
            highlights={[
              "Elige las preguntas evaluativas",
              "Agrupa variables por tema",
              "Genera puntajes listos para analizar",
            ]}
            ctaLabel="Empezar desde preguntas"
            onClick={elegirDesdeCero}
          />
        </div>

        <aside className="analitica-dimensiones-guide" aria-label="Resumen del flujo de dimensiones">
          <div className="analitica-dimensiones-guide-head">
            <span className="analitica-dimensiones-guide-icon" aria-hidden="true">
              <CheckCircle2 size={16} />
            </span>
            <div>
              <span>Ruta de trabajo</span>
              <strong>De preguntas a puntajes</strong>
            </div>
          </div>
          <ol className="analitica-dimensiones-guide-steps">
            {FLUJO_GUIA.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span className="analitica-dimensiones-guide-step-icon" aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="analitica-dimensiones-guide-result">
            <span>Resultado</span>
            <strong>Índices comparables sin perder trazabilidad</strong>
          </div>
        </aside>
      </div>

      <JsonImportPanel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={(parsed, faltantes) => {
          setDraft(parsed);
          setVarsFaltantesJson(faltantes);
          setImportOpen(false);
          // Saltamos a step 3 (Bloques) — listas y semáforo ya vienen
          // pre-llenadas del JSON; el step crítico de revisión humana
          // es la asignación de variables a bloques.
          onAdvance(3);
        }}
      />
    </div>
  );
}
