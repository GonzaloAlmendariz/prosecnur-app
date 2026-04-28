import { useState } from "react";
import { FilePlus2, FileSpreadsheet } from "lucide-react";
import { PlantillaCard } from "../shared/PlantillaCard";
import { JsonImportPanel } from "../confirmar-import/JsonImportPanel";
import { useDimensionesWizardStore } from "../store";

// Step 1 — Punto de partida. Dos caminos genéricos:
//
// • Confirmar JSON: el analista sube una receta exportada (de otro
//   proyecto, de una plantilla institucional, etc.). Se valida contra
//   el instrumento del proyecto activo. El wizard arranca en step 3
//   con las coincidencias preseleccionadas.
// • Desde cero: arranca el wizard vacío. Step 2 detecta listas, step 3
//   propone bloques desde el XLSForm.
//
// El software es neutral por diseño: no incluye plantillas hardcoded
// específicas a ningún estudio. Las recetas concretas (GIZ, otros)
// viven como archivos JSON que el analista elige importar.

export function Step1_Plantilla({ onAdvance }: { onAdvance: (toStep: 2 | 3 | 5) => void }) {
  const setDraft = useDimensionesWizardStore((s) => s.setDraft);
  const setVarsFaltantesJson = useDimensionesWizardStore((s) => s.setVarsFaltantesJson);
  const [importOpen, setImportOpen] = useState(false);

  function elegirDesdeCero() {
    // No tocamos draft (queda en EMPTY_DRAFT por default).
    onAdvance(2);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ marginBottom: 4 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "var(--pulso-text)",
          }}
        >
          ¿Cómo quieres armar las dimensiones?
        </h2>
        <p
          style={{
            margin: "6px 0 0 0",
            fontSize: 13,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.5,
            maxWidth: 720,
          }}
        >
          Las <strong>dimensiones</strong> agrupan preguntas evaluativas en bloques
          temáticos y los combinan en índices 0-100. Elige por dónde empezar.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          maxWidth: 820,
        }}
      >
        <PlantillaCard
          index={0}
          icon={FileSpreadsheet}
          accent="#7c3aed"
          iconBg="#f5f3ff"
          iconFg="#7c3aed"
          iconBorder="#ddd6fe"
          title="Importar receta y confirmar"
          blurb="Sube un JSON de dimensiones (exportado desde otro proyecto o entregado por el equipo de diseño). Lo validamos contra tu XLSForm y te mostramos qué piezas aplican y cuáles requieren atención."
          highlights={[
            "Cruza listas, bloques e índices con tu instrumento",
            "Marca ✓ coincidencias / ⚠ faltantes",
            "Continúa con lo que sí calza",
          ]}
          ctaLabel="Subir JSON"
          onClick={() => setImportOpen(true)}
        />
        <PlantillaCard
          index={1}
          icon={FilePlus2}
          accent="#059669"
          iconBg="#ecfdf5"
          iconFg="#059669"
          iconBorder="#a7f3d0"
          title="Construir desde cero"
          blurb="Para estudios sin receta previa. Te guiamos paso a paso: detectamos las escalas evaluativas del instrumento, sugerimos bloques desde los grupos del XLSForm y combinas los índices."
          highlights={[
            "Detección automática de escalas",
            "Sugerencias de bloques por grupo del XLSForm",
            "Drag-drop para refinar",
          ]}
          ctaLabel="Empezar desde cero"
          onClick={elegirDesdeCero}
        />
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
