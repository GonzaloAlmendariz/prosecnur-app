// Pestaña Word de Gráficos (W1 del rediseño, 2026-10-15): el documento en cinco partes —Documento, Portada, Capítulos,
// Gráficos y Cierre— con su menú a la izquierda, los ajustes de la parte en el centro y, a la derecha, la página del
// documento que la muestra (maqueta de `paginasWord`, la misma del Informe › Word). Gráficos lleva los ajustes de Word de
// cada tipo (`WordPresetsEditor`); las demás partes dicen lo que hoy hace el documento y llegan con sus ajustes en W2–W7.
// En el informe compartido el Word no sale: se dice por qué.

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOptionalSession } from "../../../lib/SessionContext";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import { disponibilidadInforme } from "../estiloInforme/disponibilidadInforme";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { useSubpestana } from "../subpestanas/Subpestanas";
import { PaginaMaqueta, useArmadoWord } from "../vistaGeneral/VistaWordInforme";
import { contarFiguras, tituloCortoWord } from "../vistaGeneral/paginasWord";
import { DetalleDocumento } from "./DetalleDocumento";
import { DetallePortada } from "./DetallePortada";
import { WordPresetsEditor } from "../WordPresetsEditor";
import { PartesWord } from "./PartesWord";
import { PARTES_WORD, paginaDeParte, resumenDeParte, type ParteWord } from "./modeloPestanaWord";
import "../estilo/estilo.css";
import "../estiloInforme/estiloInforme.css";
import "../vistaGeneral/vistaGeneral.css";
import "./word.css";

const ID_PANEL = "f6-w-detalle";
// Sin `foco`, abre en Gráficos: es la parte que hoy tiene ajustes (useSubpestana toma la primera como defecto).
const OPCIONES_FOCO = [...PARTES_WORD].sort((a, b) => Number(b.key === "graficos") - Number(a.key === "graficos"));

/** Un enlace a otra pestaña de Gráficos, con su `foco` (p. ej. Identidad › Logos). */
function Vinculo({ pestana, foco, children }: { pestana: string; foco?: string; children: string }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const ir = () => {
    const s = searchConNivel(search, "pestana", pestana);
    navigate({ pathname, search: foco ? conNivel(s, "foco", foco) : s });
  };
  return <button type="button" className="pulso-f6-w-vinculo" onClick={ir}>{children}</button>;
}

function DetalleParte({ parte, resumen, tituloInforme, portada }: {
  parte: ParteWord; resumen: string; tituloInforme: string; portada: { titulo: string; sub: string; fecha: string };
}) {
  if (parte === "documento") return <DetalleDocumento tituloInforme={tituloInforme} resumen={resumen} />;
  if (parte === "portada") return <DetallePortada desdeLamina={portada} />;
  if (parte === "graficos") {
    return (
      <section className="pulso-f6-informe-seccion" aria-label="Ajustes por tipo de gráfico" data-qa-geometry-member data-seccion="word-graficos">
        <WordPresetsEditor />
      </section>
    );
  }
  const textos: Record<Exclude<ParteWord, "graficos" | "documento" | "portada">, { titulo: string; cuerpo: string; vinculo?: { pestana: string; foco?: string; texto: string } }> = {
    capitulos: { titulo: "Capítulos", cuerpo: `Cada capítulo abre con su número y su título (${resumen}).` },
    cierre: { titulo: "Cierre", cuerpo: "La contraportada lleva el logo y el contacto al centro.", vinculo: { pestana: "identidad", foco: "logos", texto: "Identidad › Logos" } },
  };
  const t = textos[parte];
  return (
    <section className="pulso-f6-informe-seccion" aria-label={t.titulo} data-qa-geometry-member data-seccion={`word-${parte}`}>
      <h3 className="pulso-f6-w-titulo">{t.titulo}</h3>
      <p className="pulso-f6-informe-ayuda">{t.cuerpo}</p>
      {t.vinculo && <p className="pulso-f6-informe-ayuda">Los logos vienen de <Vinculo pestana={t.vinculo.pestana} foco={t.vinculo.foco}>{t.vinculo.texto}</Vinculo>.</p>}
      {parte === "cierre" && <p className="pulso-f6-informe-ayuda">Las respuestas «Otros» se deciden en <Vinculo pestana="reglas" foco="otros">Reglas › Otros</Vinculo>.</p>}
    </section>
  );
}

export default function PestanaWord() {
  const { search } = useLocation();
  const scope = useGraficosReportScope(search);
  const sesion = useOptionalSession();
  const disponibilidad = disponibilidadInforme(scope, sesion?.state?.estudio_processing_mode === "independent_siblings");
  const [parte, setParte] = useSubpestana(OPCIONES_FOCO);
  const slides = usePlanStore((s) => s.plan.slides);
  const paginas = useArmadoWord(slides);
  const partes = useMemo(() => PARTES_WORD.map((p) => ({ ...p, resumen: resumenDeParte(paginas, p.key) })), [paginas]);
  const pagina = paginaDeParte(paginas, parte);
  const tituloInforme = paginas[0]?.clase === "portada" ? paginas[0].titulo : "Informe";
  const tituloCorto = tituloCortoWord(tituloInforme, usePlanStore((s) => s.documentoWord.titulo_corto));
  const nGraficos = contarFiguras(paginas);

  return (
    <div className="pulso-f6-informe" data-audit-ready="graficos-word" data-qa-surface="graficos/f6-word" data-scope={scope}>
      <header className="pulso-f6-informe-barra">
        <h2 className="pulso-f6-informe-titulo">Word</h2>
        <p className="pulso-f6-informe-ayuda" role="note">A4 · ≈ {paginas.length} páginas · {nGraficos} {nGraficos === 1 ? "gráfico" : "gráficos"}</p>
      </header>
      <div className="pulso-f6-informe-cuerpo" data-qa-scroll-owner="word">
        {disponibilidad.motivoWord ? (
          <div className="pulso-f6-informe-secciones" data-qa-geometry-group="graficos/f6-word-secciones" data-qa-geometry-contract="intrinsic">
            <p className="pulso-f6-informe-motivo" role="note">{disponibilidad.motivoWord}</p>
          </div>
        ) : (
          <div className="pulso-f6-w">
            <PartesWord partes={partes} actual={parte} onElegir={setParte} idPanel={ID_PANEL} />
            <div className="pulso-f6-informe-secciones pulso-f6-w-detalle" id={ID_PANEL} role="tabpanel" aria-labelledby={`f6-w-parte-${parte}`}
              data-qa-geometry-group="graficos/f6-word-secciones" data-qa-geometry-contract="intrinsic">
              <DetalleParte parte={parte} resumen={partes.find((p) => p.key === parte)?.resumen ?? ""} tituloInforme={tituloInforme}
                portada={paginas[0]?.clase === "portada" ? { titulo: paginas[0].titulo, sub: paginas[0].sub, fecha: paginas[0].fecha } : { titulo: tituloInforme, sub: "", fecha: "" }} />
            </div>
            <aside className="pulso-f6-w-prev" aria-label="Así queda">
              <span className="pulso-f6-lectura-lab">Así queda · {PARTES_WORD.find((p) => p.key === parte)?.label}</span>
              {pagina
                ? <div className="pulso-f6-w-pagina"><PaginaMaqueta pagina={pagina} tituloCorto={tituloCorto} /></div>
                : <p className="pulso-f6-informe-ayuda">El informe todavía no tiene esta página.</p>}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
