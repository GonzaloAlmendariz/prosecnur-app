import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { PageFrame } from "../../../components/PageFrame";
import { Panel } from "../../../components/Panel";
import { TabHeading, type TabHeadingChip } from "../../../components/TabHeading";
import { formatoConteo } from "../../../lib/formatoNumero";
import { useSession } from "../../../lib/SessionContext";
import { LayoutGrid } from "../../../vendor/lucide-react";
import { basesDelEstudio } from "./basesDelEstudioModel";
import { PanelBases } from "./PanelBases";
import { PanelQueSigue } from "./PanelQueSigue";
import { queSigue, RUTA_DE_SECCION } from "./queSigueModel";
import { useEstudioDeProcesamiento } from "./useEstudioDeProcesamiento";
import "./estado-del-estudio.css";

// Estado del estudio: lo que muestra `/procesamiento` desde la etapa P2 del ADR
// 0142 (decisión D7). Antes la ruta redirigía a la primera sección sin hacer;
// esa regla sigue viva en `seccionQueSigue` y ahora es el botón de "Qué sigue".
//
// Dos fuentes, cada una en su panel y sin mezclarse:
//  - "Bases del estudio" lee `GET /api/estudio`: lo que el motor sabe de CADA base.
//  - "Qué sigue" lee el estado de la sesión, igual que la banda: describe el estudio.
export default function EstadoDelEstudioPage() {
  const { state } = useSession();
  const navigate = useNavigate();
  const { lectura, recargar, activandoA, errorDeActivar, activar } = useEstudioDeProcesamiento();

  const estudio = lectura.fase === "lista" ? lectura.estudio : null;
  const bases = useMemo(() => (estudio ? basesDelEstudio(estudio) : null), [estudio]);
  const sesionLeida = state != null;
  // Mientras se cambia de base la vista todavía no está lista: sus filas van a cambiar.
  const cargando = !sesionLeida || lectura.fase === "cargando" || activandoA !== null;

  // Las cifras del estudio van sólo aquí: el panel de bases no las repite.
  const chips: TabHeadingChip[] = [];
  if (bases && bases.filas.length > 0) {
    chips.push({
      id: "bases",
      valor: formatoConteo(bases.nBases),
      label: bases.nBases === 1 ? "base" : "bases",
      rank: 1,
    });
    if (bases.nGruposRepetidos > 0) {
      chips.push({
        id: "grupos-repetidos",
        valor: formatoConteo(bases.nGruposRepetidos),
        label: bases.nGruposRepetidos === 1 ? "grupo repetido" : "grupos repetidos",
        // Son sólo dos cifras: ninguna se recoge al menú cuando el ancho aprieta.
        rank: 1,
      });
    }
  }

  return (
    <PageFrame
      title="Procesamiento"
      className="pulso-estado-estudio-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="document"
      scrollOwner="body"
      auditReady={cargando ? false : "procesamiento-estado"}
    >
      <div className="pulso-estado-estudio">
        <Panel noPadding className="pulso-estado-estudio-cabecera">
          <TabHeading eyebrow="Procesamiento" titulo="Estado del estudio" icono={LayoutGrid} chips={chips} />
        </Panel>
        <div
          className="pulso-estado-estudio-mesa"
          data-qa-geometry-group="estado-estudio-paneles"
          data-qa-geometry-contract="intrinsic"
        >
          <PanelBases
            bases={bases}
            errorDeLectura={lectura.fase === "error" ? lectura.detalle : null}
            activandoA={activandoA}
            errorDeActivar={errorDeActivar}
            onActivar={(nombre) => void activar(nombre)}
            onReintentar={() => void recargar()}
            onAbrirCarga={() => navigate(RUTA_DE_SECCION.carga)}
          />
          <PanelQueSigue sigue={sesionLeida ? queSigue(state) : null} onAbrir={(to) => navigate(to)} />
        </div>
      </div>
    </PageFrame>
  );
}
