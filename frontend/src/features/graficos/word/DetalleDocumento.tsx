// Word › Documento (W2 del rediseño, 2026-10-15): el encabezado corrido (título corto), la fuente que cierra la base de
// cada gráfico, los índices y «Cómo leer este informe». Escribe `documento_word` (contrato de
// `.graficos_opciones_documento`, api/R/graficos_documento_word.R), que el autosave ya guarda y el job del Word lee.
// Lo vacío no se guarda: usa el valor del recetario.

import { useEffect, useId, useState } from "react";
import { usePlanStore } from "../store";
import { Segmentado } from "../subpestanas/Segmentado";
import { tituloCortoWord } from "../vistaGeneral/paginasWord";

type ComoLeer = "auto" | "si" | "no";

/** Campo de texto que se guarda al salir (no en cada tecla: cada cambio es un paso deshacible del plan). */
function CampoTexto({ etiqueta, valor, placeholder, ayuda, max, onGuardar }: {
  etiqueta: string; valor: string; placeholder: string; ayuda: string; max: number; onGuardar: (v: string) => void;
}) {
  const id = useId();
  const [borrador, setBorrador] = useState(valor);
  useEffect(() => setBorrador(valor), [valor]);
  return (
    <label className="pulso-f6-w-campo" htmlFor={id}>
      <span>{etiqueta}</span>
      <input id={id} className="pulso-f6-input" aria-label={etiqueta} value={borrador} placeholder={placeholder} maxLength={max}
        onChange={(e) => setBorrador(e.target.value)} onBlur={() => { if (borrador.trim() !== valor) onGuardar(borrador.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} aria-describedby={`${id}-ayuda`} />
      <small id={`${id}-ayuda`}>{ayuda}</small>
    </label>
  );
}

export function DetalleDocumento({ tituloInforme, resumen }: { tituloInforme: string; resumen: string }) {
  const dw = usePlanStore((s) => s.documentoWord);
  const setDw = usePlanStore((s) => s.setDocumentoWord);
  const comoLeer: ComoLeer = dw.como_leer === true ? "si" : dw.como_leer === false ? "no" : "auto";
  const automatico = tituloCortoWord(tituloInforme);
  return (
    <>
      <section className="pulso-f6-informe-seccion" aria-label="Encabezado y fuente" data-qa-geometry-member data-seccion="word-documento">
        <h3 className="pulso-f6-w-titulo">Encabezado y fuente</h3>
        <p className="pulso-f6-informe-ayuda">El encabezado corre arriba de cada página; la fuente cierra la base de cada gráfico.</p>
        <div className="pulso-f6-w-campos">
          <CampoTexto etiqueta="Título corto" valor={dw.titulo_corto ?? ""} placeholder={automatico} max={80}
            ayuda="Vacío, va el título del informe cortado a 60 caracteres." onGuardar={(v) => setDw({ ...dw, titulo_corto: v })} />
          <CampoTexto etiqueta="Fuente" valor={dw.fuente ?? ""} placeholder="Por ejemplo «Fuente: PULSO PUCP 2026.»" max={160}
            ayuda="Vacío, la base va sin fuente." onGuardar={(v) => setDw({ ...dw, fuente: v })} />
        </div>
      </section>
      <section className="pulso-f6-informe-seccion" aria-label="Índices" data-qa-geometry-member data-seccion="word-indices">
        <h3 className="pulso-f6-w-titulo">Índices</h3>
        <p className="pulso-f6-informe-ayuda">
          El documento lleva {resumen.split(" · ")[0].toLowerCase()}.{resumen.includes("tablas") ? "" : " El de tablas aparece cuando el informe tiene tablas."}
        </p>
      </section>
      <section className="pulso-f6-informe-seccion" aria-label="«Cómo leer este informe»" data-qa-geometry-member data-seccion="word-como-leer">
        <h3 className="pulso-f6-w-titulo">«Cómo leer este informe»</h3>
        <p className="pulso-f6-informe-ayuda">Explica el Top Two Box, el redondeo, las escalas y las bases chicas antes de los resultados.</p>
        <Segmentado etiqueta="«Cómo leer este informe»" valor={comoLeer}
          onCambiar={(k) => setDw({ ...dw, como_leer: k === "auto" ? undefined : k === "si" })}
          opciones={[{ clave: "auto", rotulo: "Automático" }, { clave: "si", rotulo: "Siempre" }, { clave: "no", rotulo: "Nunca" }]} />
        <p className="pulso-f6-informe-ayuda">
          {comoLeer === "auto" ? "Va si el informe tiene gráficos de escala." : comoLeer === "si" ? "Va siempre, antes de los resultados." : "El documento no lo lleva."}
        </p>
      </section>
    </>
  );
}
