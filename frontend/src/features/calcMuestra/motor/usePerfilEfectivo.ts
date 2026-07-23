/**
 * Cálculo compartido del motor: resuelve el perfil efectivo (datos del
 * proyecto activo o perfil manual/ejemplo) y deriva los resultados reactivos
 * (E1, E2, cobertura). Lo consumen la franja de resultados del desk y las
 * pestañas del motor — un solo punto de verdad para toda la sección.
 */
import { useMemo } from "react";
import type { CalcMuestraAulasState, CalcMuestraEstudio } from "../../../api/client";
import {
  cobertura,
  escenario1,
  escenario2,
  type PerfilInstitucional,
  type ResultadoEscenario1,
  type ResultadoEscenario2,
} from "../dominio";
import { datosDelProyecto } from "./datosProyecto";
import { useMotorStore } from "../store";

export type MotorEfectivo = {
  perfil: PerfilInstitucional;
  e1: ResultadoEscenario1;
  e2: ResultadoEscenario2 | null;
  cob: ReturnType<typeof cobertura>;
  usaProyecto: boolean;
  hayDatosProyecto: boolean;
  /** Etiqueta corta de la fuente activa ("Proyecto activo" · "Ejemplo" · "Manual"). */
  marcaFuente: string;
  tocado: boolean;
};

export function usePerfilEfectivo(
  estudio: CalcMuestraEstudio,
  aulasState: CalcMuestraAulasState | null,
): MotorEfectivo {
  const fuente = useMotorStore((s) => s.fuente);
  const perfilManual = useMotorStore((s) => s.perfil);
  const decisiones = useMotorStore((s) => s.decisiones);
  const tocado = useMotorStore((s) => s.tocado);

  const datos = useMemo(() => datosDelProyecto(estudio, aulasState), [estudio, aulasState]);
  const usaProyecto = fuente === "proyecto" && datos != null;

  // Perfil efectivo: configuración (criterios, parámetros, mapas) del perfil
  // editable + datos del proyecto activo cuando esa es la fuente. En modo
  // proyecto, el impacto de los opcionales (c7/c8) SOLO puede ser el medido
  // sobre la base (se descarta cualquier impacto heredado del ejemplo), y el
  // mapa de niveles del workspace config pisa el del perfil manual/ejemplo.
  const perfil: PerfilInstitucional = useMemo(() => {
    if (!usaProyecto || !datos) return perfilManual;
    return {
      ...perfilManual,
      nombre: estudio.titulo || "Proyecto activo",
      siglas: "Proyecto",
      esEjemplo: false,
      etiquetasSexo: datos.etiquetasSexo,
      facultades: datos.unidades,
      universo: null,
      embudoAlumno: null,
      aulasTotales: datos.aulasTotales,
      embudoAula: datos.embudoAula,
      marcoAulas: datos.marcoAulas,
      criteriosAula: perfilManual.criteriosAula.map((criterio) => {
        if (criterio.tipo !== "opcional") return criterio;
        const impacto = datos.impactoOpcionales?.[criterio.id];
        if (impacto) return { ...criterio, impactoActivar: impacto };
        if (!criterio.impactoActivar) return criterio;
        const { impactoActivar: _heredado, ...sinImpacto } = criterio;
        return sinImpacto;
      }),
      mapaNivelPorFacultad: datos.mapaNivel ?? perfilManual.mapaNivelPorFacultad,
    };
  }, [usaProyecto, datos, perfilManual, estudio.titulo]);

  const e1 = useMemo(
    () => escenario1(perfil, { parametros: decisiones.parametros, bolsaExtraPorFacultad: decisiones.bolsaExtraPorFacultad }),
    [perfil, decisiones.parametros, decisiones.bolsaExtraPorFacultad],
  );
  const e2 = useMemo(() => escenario2(perfil), [perfil]);
  const cob = useMemo(() => cobertura(perfil, e1.cuotas), [perfil, e1.cuotas]);

  return {
    perfil,
    e1,
    e2,
    cob,
    usaProyecto,
    hayDatosProyecto: datos != null,
    marcaFuente: usaProyecto ? "Proyecto activo" : perfil.esEjemplo ? "Ejemplo" : "Manual",
    tocado,
  };
}
