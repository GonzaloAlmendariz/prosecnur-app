import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Compass, ListTree, PieChart } from "lucide-react";
import {
  apiEstudioGet,
  EstudioPayload,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { PageHeader } from "../../components/PageHeader";
import { TabStrip, TabMeta } from "../../components/TabStrip";
import { ErrorBlock } from "../../components/States";
import BaseSelector from "./BaseSelector";
import LimpiezaTab from "./tabs/LimpiezaTab";
import InstrumentoTab from "./tabs/InstrumentoTab";
import ExplorarTab from "./tabs/ExplorarTab";
import ReglasCustomTab from "./tabs/ReglasCustomTab";
import { useValidacionStore } from "./store";
import type { ValidacionTabId } from "./types";

// =============================================================================
// Fase 2 — Validación v2 (shell)
// =============================================================================
// La Fase 2 es la "bisagra": antes de avanzar a Codificación, acá se
// revisa que la data cumple lo que el XLSForm promete, se definen reglas
// más finas y se explora cómo viene distribuida cada variable.
//
// Estructura:
//   - Header + PageHeader.
//   - BaseSelector (solo visible cuando el estudio tiene ≥2 bases).
//   - TabStrip con 4 pestañas; el contenido de cada una vive en un
//     componente aparte (ver ./tabs/*).
//
// Estado "pesado" (plan, evaluación, reglas custom) vive en el backend
// scoped por base. Acá sólo manejamos el selector y el tab activo vía
// zustand (ver ./store.ts).
//
// Sprint 1: shell + stubs. Sprints 2-5 llenan cada tab.

const TABS: TabMeta<ValidacionTabId>[] = [
  {
    key: "explorar",
    label: "Explorar datos",
    icon: Compass,
    desc: "Distribuciones y anomalías",
  },
  {
    key: "instrumento",
    label: "Reglas del instrumento",
    icon: ListTree,
    desc: "Validar contra el XLSForm",
  },
  {
    key: "reglas_custom",
    label: "Reglas personalizadas",
    icon: PieChart,
    desc: "Reglas finas definidas por ti",
  },
  {
    key: "limpieza",
    label: "Limpieza y normalización",
    icon: Activity,
    desc: "Decidir y cerrar la base",
  },
];

export default function ValidacionPage() {
  const { sessionId, state } = useSession();
  const activeTab = useValidacionStore((s) => s.activeTab);
  const setActiveTab = useValidacionStore((s) => s.setActiveTab);
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const setBaseNombre = useValidacionStore((s) => s.setBaseNombre);
  const resetForSession = useValidacionStore((s) => s.resetForSession);

  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const lastSessionRef = useRef(sessionId);
  const basesSignature = useMemo(
    () => `${state?.session_id ?? sessionId}|${state?.n_bases ?? 0}|${(state?.bases_nombres ?? []).join("|")}`,
    [sessionId, state?.session_id, state?.n_bases, state?.bases_nombres],
  );

  useEffect(() => {
    if (!sessionId || lastSessionRef.current === sessionId) return;
    lastSessionRef.current = sessionId;
    setEstudio(null);
    setLoadError("");
    resetForSession();
  }, [sessionId, resetForSession]);

  // Cargar el estudio para poblar el BaseSelector (si multi-base).
  useEffect(() => {
    let cancel = false;
    setLoadError("");
    apiEstudioGet()
      .then((p) => {
        if (cancel) return;
        setEstudio(p);
        // Si todavía no hay base seleccionada y el estudio tiene bases,
        // preseleccionamos la primera. El backend habría hecho el mismo
        // fallback, pero esto mantiene el store sincronizado.
        if (!baseNombre && p.n_bases > 0) {
          const first = Object.keys(p.bases)[0];
          if (first) setBaseNombre(first);
        }
        // Caso borde: base guardada en store ya no existe en el estudio
        // (puede pasar tras quitar una base en Fase 1).
        if (baseNombre && !p.bases[baseNombre]) {
          const first = Object.keys(p.bases)[0] ?? null;
          setBaseNombre(first);
        }
      })
      .catch((e) => {
        if (!cancel) setLoadError((e as Error).message);
      });
    return () => {
      cancel = true;
    };
  }, [baseNombre, setBaseNombre, basesSignature]);

  const prereqsOk = !!state?.xlsform && !!state?.data;

  return (
    <section>
      <PageHeader
        title="Fase 2 — Validación"
        lead="Explora la base, valida contra el XLSForm, afina reglas personalizadas y cierra con limpieza y normalización antes de avanzar."
      />

      {!prereqsOk && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 18px",
            borderRadius: 10,
            background: "var(--pulso-warn-bg)",
            border: "1px solid var(--pulso-warn-border)",
            color: "var(--pulso-warn-fg)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Faltan insumos.</strong> Para validar necesitas un
          XLSForm y una base de datos cargados en la Fase 1.
        </div>
      )}

      {loadError && <ErrorBlock label="No se pudo cargar el estudio" detail={loadError} />}

      <BaseSelector
        estudio={estudio}
        selected={baseNombre}
        onChange={setBaseNombre}
      />

      <div style={{ marginBottom: 18 }}>
        <TabStrip<ValidacionTabId>
          tabs={TABS}
          active={activeTab}
          onChange={setActiveTab}
          ariaLabel="Secciones de validación"
        />
      </div>

      <div role="tabpanel" aria-labelledby={activeTab}>
        {activeTab === "limpieza" && <LimpiezaTab />}
        {activeTab === "instrumento" && <InstrumentoTab />}
        {activeTab === "explorar" && <ExplorarTab />}
        {activeTab === "reglas_custom" && <ReglasCustomTab />}
      </div>
    </section>
  );
}
