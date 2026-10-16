// «Variables calculadas» (ADR 0106, punto 2): las que la base declara, con su
// regla en llano y, si se guardaron aquí, su resumen por código. Una a la vez se
// crea o edita en `CalculadaEditor`.

import { useState } from "react";
import type { CalculadaADeclarar, ResumenCalculada, VariableCalculada } from "../../../api/baseVariables";
import type { VariableDeBase } from "../../../api/equivalencias";
import { PulsoButton } from "../../../components/PulsoButton";
import { Pencil, Plus, Sigma, Trash2 } from "../../../vendor/lucide-react";
import { CalculadaEditor } from "./CalculadaEditor";
import type { MensajeVariablesBase } from "./useVariablesBase";
import { reglaLegible, textoResumen } from "./variablesBaseModel";

export type VariablesCalculadasProps = {
  /** La base del panel: el editor lee de ella los códigos observados. */
  base: string;
  calculadas: readonly VariableCalculada[];
  resumenes: Readonly<Record<string, ResumenCalculada>>;
  preguntas: readonly VariableDeBase[] | null;
  catalogoError: boolean;
  ocupados: readonly string[];
  guardando: boolean;
  quitando: boolean;
  mensaje: MensajeVariablesBase | null;
  onGuardar: (c: CalculadaADeclarar) => Promise<boolean>;
  onQuitar: (nombre: string) => void;
};

/** `null`: ningún editor abierto; `""`: una nueva; un nombre: esa calculada. */
type Edicion = string | null;

export function VariablesCalculadas({
  base,
  calculadas,
  resumenes,
  preguntas,
  catalogoError,
  ocupados,
  guardando,
  quitando,
  mensaje,
  onGuardar,
  onQuitar,
}: VariablesCalculadasProps) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const enEdicion = edicion ? calculadas.find((c) => c.nombre === edicion) ?? null : null;
  const errorDelEditor = edicion !== null && mensaje?.tono === "error" ? mensaje.texto : "";
  const avisoDeLista = edicion === null && mensaje ? mensaje : null;

  const guardar = async (c: CalculadaADeclarar) => {
    const ok = await onGuardar(c);
    if (ok) setEdicion(null);
    return ok;
  };

  return (
    <section className="pulso-armon-seccion" aria-labelledby="pulso-vb-calculadas" data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-vb-calculadas">
            Variables calculadas
            {calculadas.length > 0 && <small>{calculadas.length}</small>}
          </h3>
          <p className="pulso-armon-ayuda">Se calculan al leer la base; la data no se modifica.</p>
        </div>
        {edicion === null && (
          <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={() => setEdicion("")}>
            <Plus size={14} aria-hidden="true" />
            Nueva variable calculada
          </PulsoButton>
        )}
      </div>

      {edicion === "" && (
        <CalculadaEditor
          base={base}
          inicial={null}
          preguntas={preguntas}
          catalogoError={catalogoError}
          ocupados={ocupados}
          guardando={guardando}
          error={errorDelEditor}
          onGuardar={guardar}
          onCancelar={() => setEdicion(null)}
        />
      )}

      {calculadas.length === 0 ? (
        // C3: el vacío es de esta sección y dice cómo se llena.
        edicion === null && <p className="pulso-armon-vacio">Ninguna todavía. Combina varias preguntas o recodifica una.</p>
      ) : (
        <ul className="pulso-vb-calculadas" aria-label="Variables calculadas de la base">
          {calculadas.map((c) =>
            c.nombre === edicion && enEdicion ? (
              <li key={c.nombre}>
                <CalculadaEditor
                  key={c.nombre}
                  base={base}
                  inicial={enEdicion}
                  preguntas={preguntas}
                  catalogoError={catalogoError}
                  ocupados={ocupados}
                  guardando={guardando}
                  error={errorDelEditor}
                  onGuardar={guardar}
                  onCancelar={() => setEdicion(null)}
                />
              </li>
            ) : (
              <li key={c.nombre} className="pulso-vb-calculada">
                <span className="pulso-vb-calculada-marca" aria-hidden="true"><Sigma size={14} /></span>
                <div className="pulso-vb-calculada-texto">
                  <p className="pulso-vb-calculada-titulo">
                    <code>{c.nombre}</code>
                    <span>{c.etiqueta}</span>
                  </p>
                  <p className="pulso-vb-calculada-regla">{reglaLegible(c)}</p>
                  {resumenes[c.nombre] && <p className="pulso-vb-calculada-resumen">{textoResumen(resumenes[c.nombre])}</p>}
                </div>
                {confirmando === c.nombre ? (
                  <span className="pulso-vb-confirmar" role="alert">
                    <span>¿Quitar «{c.nombre}»?</span>
                    <PulsoButton
                      variant="danger"
                      size="sm"
                      disabled={quitando}
                      onClick={() => { onQuitar(c.nombre); setConfirmando(null); }}
                    >
                      Quitar
                    </PulsoButton>
                    <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(null)}>Cancelar</PulsoButton>
                  </span>
                ) : (
                  <span className="pulso-vb-calculada-acciones">
                    <PulsoButton
                      variant="ghost"
                      size="sm"
                      className="pulso-armon-btn"
                      disabled={edicion !== null}
                      aria-label={`Editar ${c.nombre}`}
                      onClick={() => setEdicion(c.nombre)}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Editar
                    </PulsoButton>
                    <PulsoButton
                      variant="ghost"
                      size="sm"
                      className="pulso-armon-btn"
                      disabled={edicion !== null || quitando}
                      aria-label={`Quitar ${c.nombre}`}
                      onClick={() => setConfirmando(c.nombre)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Quitar
                    </PulsoButton>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {avisoDeLista && (
        <p className={avisoDeLista.tono === "error" ? "pulso-armon-error" : "pulso-vb-ok"} role={avisoDeLista.tono === "error" ? "alert" : "status"}>
          {avisoDeLista.texto}
        </p>
      )}
    </section>
  );
}
