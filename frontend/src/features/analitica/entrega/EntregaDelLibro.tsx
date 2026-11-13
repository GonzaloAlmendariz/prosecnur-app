// Entrega › Libro de códigos (prototipo "Analítica, Entrega", el entregable
// elegido por defecto): al centro la vista del archivo con el formato y
// "Generar"; a la derecha, de qué se construye, los códigos especiales del
// libro y los archivos. Viene de la pestaña Libro de códigos (ADR 0144). Los
// códigos especiales se quedan con el libro: deciden qué códigos salen en él,
// no el orden de una lista (que es Categorías).

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { apiAnaliticaCodebook, apiAnaliticaConfigPut } from "../../../api/client";
import { apiAnaliticaCodigosEspeciales, type CodigoEspecialSugerido } from "../../../api/analitica";
import { PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { useSession } from "../../../lib/SessionContext";
import { formatoConteo } from "../../../lib/formatoNumero";
import { seccionesVisibles } from "../estructuraDeSecciones";
import { useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";
import { buildDataReviewDraft, buildDataReviewSectionGroups, dataReviewEffectiveOptionLabel } from "../datos/borradorDeEtiquetas";
import { baseComunDeCasos } from "../datos/modeloDeVariables";
import { useRevisionDeDatos } from "../datos/useRevisionDeDatos";
import { CodigosEspeciales } from "../libro/CodigosEspeciales";
import { seccionesDelLibro } from "../libro/modeloDelLibro";
import { PanelDelLibro, type FormatoDelLibro } from "../libro/PanelDelLibro";
import { SeConstruyeCon } from "../libro/SeConstruyeCon";
import { opcionesCodigosEspeciales } from "../panes/codigosEspecialesModel";
import { UniversoAnalisis } from "../UniversoAnalisis";
import { estadoDeEntregable } from "./modeloDeEntrega";
import { XlsformFinal } from "./XlsformFinal";
import { ArchivosDeEntrega } from "./ArchivosDeEntrega";

export function EntregaDelLibro({ fuente }: { fuente: ReactNode }) {
  const config = useAnaliticaStore((s) => s.config);
  const setCodebook = useAnaliticaStore((s) => s.setCodebook);
  const setColorRecodificaciones = useAnaliticaStore((s) => s.setColorRecodificaciones);
  const revision = useRevisionDeDatos();
  const runExcel = useReporteRun("Libro de códigos", { articulo: "el", formato: "xlsx" });
  const runPdf = useReporteRun("Libro de códigos en PDF", { articulo: "el", formato: "pdf" });
  const [formato, setFormato] = useState<FormatoDelLibro>("xlsx");
  const { state } = useSession();
  const estadoLibro = estadoDeEntregable("libro", state);

  // Sugerencias del estudio, no una lista fija: los códigos especiales que traen
  // los instrumentos, con su etiqueta, más los ya marcados.
  const [sugeridos, setSugeridos] = useState<CodigoEspecialSugerido[] | null>(null);
  useEffect(() => {
    let vivo = true;
    apiAnaliticaCodigosEspeciales()
      .then((c) => { if (vivo) setSugeridos(c); })
      .catch(() => { if (vivo) setSugeridos([]); });
    return () => { vivo = false; };
  }, []);

  const codes = config.codebook.codigos_solo_si_presentes;
  const codigos = opcionesCodigosEspeciales(sugeridos ?? [], codes);
  function alternarCodigo(n: number) {
    setCodebook({
      codigos_solo_si_presentes: codes.includes(n) ? codes.filter((x) => x !== n) : [...codes, n].sort((a, b) => a - b),
    });
  }

  // Lo que entra: las variables incluidas en Variables, con las etiquetas que la config ya guarda.
  const excluidas = useMemo(() => new Set(config.variables_excluidas), [config.variables_excluidas]);
  const guardado = useMemo(
    () => buildDataReviewDraft(revision.variables, config.datos.variable_labels, config.datos.value_labels),
    [revision.variables, config.datos.variable_labels, config.datos.value_labels],
  );
  const grupos = useMemo(
    () => buildDataReviewSectionGroups(revision.variables, seccionesVisibles(config.secciones, revision.seccionesDetectadas)),
    [revision.variables, config.secciones, revision.seccionesDetectadas],
  );
  const secciones = seccionesDelLibro(grupos, (v, g) => !excluidas.has(v.name) && !(g.hidden && !g.synthetic));
  const enElLibro = secciones.reduce((suma, s) => suma + s.variables.length, 0);
  const version = state?.analitica_fuente?.startsWith("adaptados") ? "Codificada" : "Cargada";
  const listasConOrden = Object.keys(config.orden_categorias ?? {}).length;
  const indices = config.dimensiones?.indices?.length ?? 0;
  const leida = !revision.cargando && !revision.error;

  async function generar() {
    const run = formato === "pdf" ? runPdf : runExcel;
    await run.runSync(async () => {
      await apiAnaliticaConfigPut(config);
      return formato === "pdf" ? apiAnaliticaCodebook({ formato: "pdf" }) : apiAnaliticaCodebook();
    });
  }

  return (
    <>
      <PanelDelLibro
        secciones={secciones}
        etiquetaDe={(v) => guardado.variableLabels[v.name] ?? v.name}
        etiquetaDeOpcion={(v, code) => {
          const opcion = v.opciones.find((o) => o.code === code);
          return guardado.valueLabels[v.name]?.[code] ?? (opcion ? dataReviewEffectiveOptionLabel(opcion) : "");
        }}
        baseComun={baseComunDeCasos(revision.variables)}
        cargando={revision.cargando}
        error={revision.error}
        formato={formato}
        generando={(formato === "pdf" ? runPdf : runExcel).generacion.estado.fase === "en_curso"}
        colorRecods={config.color_recodificaciones}
        onFormato={setFormato}
        onGenerar={() => void generar()}
        onColorRecods={() => setColorRecodificaciones(!config.color_recodificaciones)}
      />
      <PilaDeMesa grupo="analitica/entrega-lateral">
        <SeConstruyeCon
          dependencias={[
            // La versión de la base y la plantilla van en la banda del módulo según el plan 5.4;
            // mientras la banda no las lleve, quedan aquí, junto a lo que el libro usa.
            { clave: "base", titulo: "Versión de la base", detalle: fuente ?? version },
            { clave: "casos", titulo: "Casos que cuentan", detalle: <UniversoAnalisis /> },
            { clave: "etiquetas", titulo: "Etiquetas y secciones", detalle: leida ? `Variables, ${formatoConteo(enElLibro)} incluidas` : "Variables", pestana: "datos" },
            {
              clave: "orden",
              titulo: "Orden de categorías",
              detalle: listasConOrden === 0 ? "Como en el formulario" : `${formatoConteo(listasConOrden)} ${listasConOrden === 1 ? "lista con orden propio" : "listas con orden propio"}`,
              pestana: "orden",
            },
            {
              clave: "dimensiones",
              titulo: "Dimensiones",
              detalle: indices === 0 ? "Sin índices declarados" : `${formatoConteo(indices)} ${indices === 1 ? "índice" : "índices"}`,
              pestana: "dimensiones",
            },
          ]}
        />
        <ArchivosDeEntrega
          archivos={[
            {
              clave: "xlsx",
              formato: "xlsx",
              nombre: "Libro de códigos en Excel",
              run: runExcel,
              estado: estadoLibro,
              pie: <XlsformFinal result={runExcel.lastResult?.xlsform} />,
            },
            { clave: "pdf", formato: "pdf", nombre: "Libro de códigos en PDF", run: runPdf, estado: estadoLibro },
          ]}
        />
        <CodigosEspeciales opciones={codigos} leyendo={sugeridos === null} onAlternar={alternarCodigo} />
      </PilaDeMesa>
    </>
  );
}
