import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { apiAnaliticaCodebook, apiAnaliticaConfigPut } from "../../../api/client";
import { apiAnaliticaCodigosEspeciales, type CodigoEspecialSugerido } from "../../../api/analitica";
import { CabeceraDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { MesaDePestana, PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { useSession } from "../../../lib/SessionContext";
import { formatoConteo } from "../../../lib/formatoNumero";
import { BookOpen } from "../../../vendor/lucide-react";
import { searchConPanel } from "../../../lib/navegacion/paneles";
import { seccionesVisibles } from "../estructuraDeSecciones";
import { PANEL_VARIABLES_EXCLUIDAS } from "../panelesAnalitica";
import { useAnaliticaStore } from "../store";
import { useReporteRun } from "../useReporteRun";
import { buildDataReviewDraft, buildDataReviewSectionGroups, dataReviewEffectiveOptionLabel } from "../datos/borradorDeEtiquetas";
import { baseComunDeCasos } from "../datos/modeloDeVariables";
import { useRevisionDeDatos } from "../datos/useRevisionDeDatos";
import { ArchivosDelLibro } from "../libro/ArchivosDelLibro";
import { CodigosEspeciales } from "../libro/CodigosEspeciales";
import { seccionesDelLibro } from "../libro/modeloDelLibro";
import { PanelDelLibro, type FormatoDelLibro } from "../libro/PanelDelLibro";
import { SeConstruyeCon } from "../libro/SeConstruyeCon";
import { opcionesCodigosEspeciales } from "./codigosEspecialesModel";
import { UniversoAnalisis } from "../UniversoAnalisis";
import "../libro/libro.css";

// Analítica › Libro de códigos con la forma del prototipo (panel "Libro de
// códigos" de "Analítica, Entrega"): la cabecera de la pestaña con sus cifras;
// al centro, las variables que entran al libro con el formato y "Generar"; a la
// izquierda, los códigos especiales; a la derecha, de qué se construye y los
// archivos. La
// inclusión y las etiquetas se deciden en Datos; el XLSForm final se genera en
// la misma corrida que el Excel.

export function CodebookPane({ fuente }: {
  /** De qué versión de la base sale y la plantilla de Analítica, que la página pone en "Se construye con". */
  fuente?: ReactNode;
} = {}) {
  const config = useAnaliticaStore((s) => s.config);
  const setCodebook = useAnaliticaStore((s) => s.setCodebook);
  const setColorRecodificaciones = useAnaliticaStore((s) => s.setColorRecodificaciones);
  const revision = useRevisionDeDatos();
  const runExcel = useReporteRun("Libro de códigos", { articulo: "el", formato: "xlsx" });
  const runPdf = useReporteRun("Libro de códigos en PDF", { articulo: "el", formato: "pdf" });
  const [formato, setFormato] = useState<FormatoDelLibro>("xlsx");
  const { state } = useSession();
  const location = useLocation();

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

  // Lo que entra: las variables incluidas de Datos, con las etiquetas que la config ya guarda.
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
  const total = formatoConteo(revision.variables.length);
  const leida = !revision.cargando && !revision.error;

  async function generar() {
    const run = formato === "pdf" ? runPdf : runExcel;
    await run.runSync(async () => {
      await apiAnaliticaConfigPut(config);
      return formato === "pdf" ? apiAnaliticaCodebook({ formato: "pdf" }) : apiAnaliticaCodebook();
    });
  }

  // ADR 0144: sin montar desde que el libro vive en Entrega (`entrega/EntregaDelLibro.tsx`); su borrado espera confirmación.
  const meta = { label: "Libro de códigos", icon: BookOpen };
  return (
    // La lectura de las variables retiene la vista con la carga del bloque (CargaDeBloque) en el panel del libro.
    <div className="libro-superficie">
      <MesaDePestana
        grupo="analitica/libro"
        columnas={3}
        cabecera={(
          <CabeceraDePestana
            seccion="Analítica"
            titulo={meta.label}
            icono={meta.icon}
            ariaCifras="Cifras del libro de códigos"
            cifrasPendientes="Estado del archivo (al día, desactualizado): la app no guarda cuándo se generó el libro"
            cifras={leida ? [
              { clave: "variables", valor: formatoConteo(enElLibro), base: total, rotulo: "variables en el libro", rango: 1 },
              { clave: "secciones", valor: formatoConteo(secciones.length), rotulo: secciones.length === 1 ? "sección" : "secciones" },
              {
                clave: "excluidas",
                valor: formatoConteo(excluidas.size),
                rotulo: excluidas.size === 1 ? "excluida" : "excluidas",
                enlace: { pathname: location.pathname, search: searchConPanel(location.search, PANEL_VARIABLES_EXCLUIDAS) },
                titulo: "Abre la lista de variables que no salen en los entregables",
              },
            ] : []}
          />
        )}
      >
        <CodigosEspeciales opciones={codigos} leyendo={sugeridos === null} onAlternar={alternarCodigo} />
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
        <PilaDeMesa grupo="analitica/libro-lateral">
          <SeConstruyeCon
            dependencias={[
              // La versión de la base y la plantilla van en la banda del módulo según el plan 5.4;
              // mientras la banda no las lleve, quedan aquí, junto a lo que el libro usa.
              { clave: "base", titulo: "Versión de la base", detalle: fuente ?? version },
              { clave: "casos", titulo: "Casos que cuentan", detalle: <UniversoAnalisis /> },
              { clave: "etiquetas", titulo: "Etiquetas y secciones", detalle: leida ? `Datos, ${formatoConteo(enElLibro)} incluidas` : "Datos", pestana: "datos" },
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
          <ArchivosDelLibro excel={runExcel} pdf={runPdf} />
        </PilaDeMesa>
      </MesaDePestana>
    </div>
  );
}
