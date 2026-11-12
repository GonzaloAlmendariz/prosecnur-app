import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageFrame } from "../../../components/PageFrame";
import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { useSession } from "../../../lib/SessionContext";
import { LayoutGrid } from "../../../vendor/lucide-react";
import { aprobacionesDelCatalogo } from "./aprobacionesModel";
import { archivosDelEstudio } from "./archivosDelEstudioModel";
import { basesDelEstudio } from "./basesDelEstudioModel";
import { cifrasDelEstudio, cifrasPendientesDelEstudio, estadoDelEstudio } from "./cabeceraDelEstudioModel";
import { cambiosRecientes } from "./cambiosRecientesModel";
import { PanelArchivos } from "./PanelArchivos";
import { PanelBases } from "./PanelBases";
import { PanelCambios } from "./PanelCambios";
import { PanelQueSigue } from "./PanelQueSigue";
import { porHacer, type TareaPorHacer } from "./porHacerModel";
import { queSigue, RUTA_DE_SECCION } from "./queSigueModel";
import { useEstudioDeProcesamiento } from "./useEstudioDeProcesamiento";
import "./estado-del-estudio.css";

// Estado del estudio: lo que muestra `/procesamiento` desde la etapa P2 del ADR
// 0142 (decisión D7), con la forma del prototipo "estado": la cabecera de
// pestaña del kit con el estado y las cifras del estudio, y una mesa de dos
// columnas. A la izquierda, el avance por base y por fase y los archivos de
// cada base; a la derecha, lo que queda por hacer y los cambios recientes.
//
// Fuentes, cada una en su panel:
//  - Avance, archivos de las bases no activas y cambios: `GET /api/estudio`,
//    lo que el motor sabe de CADA base.
//  - Aprobación para informe: `GET /api/processing/releases`, solo en bases
//    independientes.
//  - Por hacer y archivos de la base activa: el estado de la sesión, el mismo
//    que lee la banda.
export default function EstadoDelEstudioPage() {
  const { state } = useSession();
  const navigate = useNavigate();
  const { lectura, catalogoDeAprobaciones, recargar, activandoA, errorDeActivar, activar } = useEstudioDeProcesamiento();
  const [yendo, setYendo] = useState<string | null>(null);

  const estudio = lectura.fase === "lista" ? lectura.estudio : null;
  const aprobaciones = useMemo(() => aprobacionesDelCatalogo(catalogoDeAprobaciones), [catalogoDeAprobaciones]);
  const bases = useMemo(() => (estudio ? basesDelEstudio(estudio, aprobaciones) : null), [estudio, aprobaciones]);
  const sesionLeida = state != null;
  // Mientras se cambia de base la vista todavía no está lista: sus filas van a cambiar.
  const cargando = !sesionLeida || lectura.fase === "cargando" || activandoA !== null;

  const sigue = sesionLeida ? queSigue(state) : null;
  const tareas = sigue ? porHacer(sigue, aprobaciones, bases?.filas ?? []) : null;
  const archivos = bases ? archivosDelEstudio(bases, state ?? null) : null;
  const cambios = estudio ? cambiosRecientes(estudio, aprobaciones) : null;

  // Una tarea de una base que no es la activa la activa antes de ir: Analítica trabaja sobre la activa.
  const ir = async (tarea: TareaPorHacer) => {
    const activa = bases?.filas.find((fila) => fila.activa)?.nombre ?? null;
    if (tarea.base && tarea.base !== activa) {
      setYendo(tarea.clave);
      const ok = await activar(tarea.base);
      setYendo(null);
      if (!ok) return;
    }
    navigate(tarea.to);
  };

  return (
    <PageFrame
      title="Procesamiento"
      className="pulso-estado-estudio-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      auditReady={cargando ? false : "procesamiento-estado"}
    >
      <MesaDePestana
        grupo="estado-estudio"
        columnas={2}
        cabecera={
          <CabeceraDePestana
            seccion="Procesamiento"
            titulo="Estado del estudio"
            icono={LayoutGrid}
            estado={estadoDelEstudio(bases, aprobaciones)}
            cifras={cifrasDelEstudio(bases, aprobaciones)}
            ariaCifras="Cifras del estudio"
            cifrasPendientes={cifrasPendientesDelEstudio(aprobaciones)}
          />
        }
      >
        <PilaDeMesa grupo="estado-estudio-bases">
          <PanelBases
            bases={bases}
            errorDeLectura={lectura.fase === "error" ? lectura.detalle : null}
            activandoA={activandoA}
            errorDeActivar={errorDeActivar}
            onActivar={(nombre) => void activar(nombre)}
            onReintentar={() => void recargar()}
            onAbrirCarga={() => navigate(RUTA_DE_SECCION.carga)}
          />
          <PanelArchivos filas={lectura.fase === "error" ? [] : archivos} />
        </PilaDeMesa>
        <PilaDeMesa grupo="estado-estudio-seguimiento">
          <PanelQueSigue
            tareas={tareas}
            paso={sigue?.paso ?? null}
            yendo={yendo}
            onIr={(tarea) => void ir(tarea)}
            onAbrir={(to) => navigate(to)}
          />
          <PanelCambios cambios={lectura.fase === "error" ? [] : cambios} />
        </PilaDeMesa>
      </MesaDePestana>
    </PageFrame>
  );
}
