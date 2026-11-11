// Inspector de una base (Carga › Bases, prototipo "carga-bases"): la columna
// derecha, siempre a la vista, con la base elegida (`foco=<base>`) o la primera.
// Tres bloques: "Fuentes de respuestas" (cada fuente con su origen y las
// acciones que le cambian los datos), "Cómo se unieron" (solo si la base junta
// varias fuentes y el motor dice cómo) y "Formulario". El pie lleva Renombrar,
// Quitar y Descargar. La cifra de respuestas ya la dice la fila: aquí no se repite.

import { useState, type ReactNode } from "react";
import type { FormularioPublicado } from "../../../../api/cargaFormularioPublicado";
import { apiEstudioGet, apiEstudioRemoveBase, apiEstudioRenameBase, apiEstudioReplaceBaseFiles, type EstudioBase, type EstudioPayload } from "../../../../api/estudio";
import { CabeceraPanel } from "../../../../components/CabeceraPanel";
import { NombreArchivo } from "../../../../components/entregables/NombreArchivo";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { ErrorBlock } from "../../../../components/States";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { ArrowLeftRight, Columns3, Download, FileUp, GitCompareArrows, ListChecks, Pencil, Plus, Trash2 } from "../../../../vendor/lucide-react";
import { ReplaceFilesForm } from "../../BasesPanel";
import { DescargaDeBaseEnFila, useDescargaDeBase } from "../../entregas/DescargaDeBase";
import { AbrirPanelFuentes } from "../../fuentes/AbrirPanelFuentes";
import { comparablesCon, searchConArmonizacionBase, searchConComparacion } from "../../fuentes/compararFuentesModel";
import { rotuloBaseDeclarada, vinculoFormularioDeBase } from "../../fuentes/formularioPublicadoModel";
import { IrAVariablesDeBase } from "../../fuentes/IrAVariablesDeBase";
import { NuevaVersionRespuestas } from "../../fuentes/NuevaVersionRespuestas";
import { importedAtLabel } from "../../surveymonkey/smBasesModel";
import { CAUSA_SIN_OTRA_FUENTE, etiquetaDeBase, type BaseDeLaColeccion, type FuenteDeBase, type HijaDeBase } from "./basesModel";
import { resumenDeIntegracion } from "./integracionModel";
import { ResumenDeIntegracionVista } from "./ResumenDeIntegracionVista";
import { ID_INSPECTOR_DE_BASE } from "./TarjetaDeBase";

export type InspectorDeBaseProps = {
  base: BaseDeLaColeccion;
  hija: HijaDeBase | null;
  /** Las demás bases del estudio, para "Comparar con". */
  basesDelEstudio: readonly EstudioBase[];
  /** El catálogo de formularios publicados que ya leyó la pestaña (vacío con una base). */
  formulariosPublicados: readonly FormularioPublicado[];
  ocupado: boolean;
  onCambio: (payload: EstudioPayload) => Promise<void>;
  onRenombrada: (nuevo: string) => void;
  onQuitada: () => void;
  onAgregarFuente: () => void;
  /** Con una base: abre el recorrido en el paso "Origen" para traer otra fuente. */
  onCambiarFuente: (() => void) | null;
  /** Con una base: el aviso del enlace con la revisión publicada. */
  avisoDelFormulario?: ReactNode;
  /** Con una base y el mapeo de códigos sin confirmar, la base preparada todavía no se descarga. */
  descargable: boolean;
};

/** C1: cada bloque del inspector es una sección independiente con su alto propio. */
function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section
      className="pulso-bases-bloque"
      aria-labelledby={id}
      data-qa-geometry-group={`carga/bases-inspector-${id.replace(`${ID_INSPECTOR_DE_BASE}-`, "")}`}
      data-qa-geometry-contract="intrinsic"
    >
      <h4 id={id} className="pulso-bases-bloque-titulo">{titulo}</h4>
      {children}
    </section>
  );
}

/**
 * Origen, vía, columnas del archivo recibido (solo con una fuente: son las de la
 * base) y última lectura, en una línea. Sin la cifra de respuestas: la dice la fila.
 */
export function detalleDeFuente(fuente: Pick<FuenteDeBase, "origen" | "canal" | "leidaEl">, columnas: number | null = null): string {
  const partes: string[] = [fuente.origen];
  if (fuente.canal) partes.push(fuente.canal);
  if (columnas !== null) partes.push(`${formatoConteoDe(columnas, "columna")} en el archivo recibido`);
  if (fuente.leidaEl) partes.push(`leída el ${importedAtLabel(fuente.leidaEl)}`);
  return partes.join(", ");
}

function Renombrar({ base, etiqueta, ocupado, onGuardar, onCancelar }: {
  base: string;
  etiqueta: string;
  ocupado: boolean;
  onGuardar: (nuevo: string) => void;
  onCancelar: () => void;
}) {
  const [borrador, setBorrador] = useState(base);
  return (
    <form
      className="pulso-bases-renombrar"
      onSubmit={(e) => {
        e.preventDefault();
        const nuevo = borrador.trim();
        if (nuevo && nuevo !== base) onGuardar(nuevo);
        else onCancelar();
      }}
    >
      <PulsoInput size="sm" value={borrador} onChange={(e) => setBorrador(e.target.value)} aria-label={`Nuevo nombre de la base ${etiqueta}`} autoFocus />
      <PulsoButton type="submit" variant="primary" size="sm" disabled={ocupado}>Guardar</PulsoButton>
      <PulsoButton type="button" variant="ghost" size="sm" onClick={onCancelar}>Cancelar</PulsoButton>
    </form>
  );
}

export function InspectorDeBase({
  base,
  hija,
  basesDelEstudio,
  formulariosPublicados,
  ocupado: ocupadoPagina,
  onCambio,
  onRenombrada,
  onQuitada,
  onAgregarFuente,
  onCambiarFuente,
  avisoDelFormulario,
  descargable,
}: InspectorDeBaseProps) {
  const nombre = hija?.nombre ?? base.nombre;
  const etiqueta = hija?.etiqueta ?? base.etiqueta;
  const descarga = useDescargaDeBase(base.enEstudio || hija ? nombre : "", etiqueta);
  const integracion = !hija && base.base ? resumenDeIntegracion(base.base) : null;
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // Lo hacía la fila de cada base en BasesPanel ("Actualizar archivos").
  const [reemplazando, setReemplazando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const ocupado = ocupadoPagina || trabajando;
  const vinculo = !hija && base.base ? vinculoFormularioDeBase(base.base, formulariosPublicados) : null;
  const comparables = !hija && base.enEstudio ? comparablesCon(base.nombre, basesDelEstudio) : [];
  const otra = comparables[0] ? basesDelEstudio.find((b) => b.nombre === comparables[0]) : undefined;
  const etiquetaDeOtra = otra ? etiquetaDeBase(otra) : comparables[0] ?? "";
  const idCausa = `${ID_INSPECTOR_DE_BASE}-causa-fuente`;
  const propia = !hija && base.enEstudio;

  const correr = async (accion: () => Promise<EstudioPayload>, despues: () => void) => {
    setTrabajando(true);
    setError("");
    try {
      await onCambio(await accion());
      despues();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setTrabajando(false);
    }
  };

  // Lo que cambia los datos de la fuente. Solo existe para una base de una
  // fuente: "Nueva versión" de las respuestas, "Reemplazar archivos" (formulario
  // y respuestas) o, con una base, "Cambiar la fuente".
  const accionesDeFuente = hija ? null : (
    <>
      {onCambiarFuente ? (
        <PulsoButton variant="secondary" size="sm" aria-haspopup="dialog" disabled={ocupado} onClick={onCambiarFuente}>
          <ArrowLeftRight size={13} aria-hidden="true" />Cambiar la fuente
        </PulsoButton>
      ) : null}
      {base.recibeNuevaVersion && base.enEstudio ? (
        <NuevaVersionRespuestas base={base.nombre} ocupado={ocupado} onCambio={onCambio} />
      ) : null}
      {base.enEstudio && base.reemplazaArchivos ? (
        <PulsoButton variant="secondary" size="sm" disabled={ocupado || reemplazando} onClick={() => setReemplazando(true)}>
          <FileUp size={13} aria-hidden="true" />Reemplazar archivos
        </PulsoButton>
      ) : null}
    </>
  );
  const hayAccionesDeFuente = !hija && (Boolean(onCambiarFuente) || (base.recibeNuevaVersion && base.enEstudio) || (base.enEstudio && base.reemplazaArchivos));
  const unaFuente = base.fuentes.length <= 1;

  return (
    <Panel noPadding className="pulso-bases-inspector" id={ID_INSPECTOR_DE_BASE} aria-label={`Detalle de ${etiqueta}`}>
      <CabeceraPanel
        como="header"
        nivel={3}
        titulo={editando ? "Renombrar la base" : etiqueta}
        subtitulo={hija ? `Grupo repetido de ${hija.madre}` : undefined}
      />
      {/* Cuerpo: dueño del scroll y del alto libre de la columna (C3, C4); el pie queda fijo. */}
      <div className="pulso-bases-inspector-cuerpo" role="region" aria-label={`Fuentes y formulario de ${etiqueta}`} tabIndex={0} data-qa-geometry-capacity="owned">
        {editando ? (
          <Renombrar
            base={base.nombre}
            etiqueta={etiqueta}
            ocupado={ocupado}
            onCancelar={() => setEditando(false)}
            onGuardar={(nuevo) => void correr(() => apiEstudioRenameBase(base.nombre, nuevo), () => { setEditando(false); onRenombrada(nuevo); })}
          />
        ) : null}
        {error ? <ErrorBlock label="No se pudo completar" detail={error} queda="La base sigue como estaba." /> : null}

        {hija ? (
          <Bloque id={`${ID_INSPECTOR_DE_BASE}-fuentes`} titulo="Grupo repetido">
            <p className="pulso-bases-dato">
              {hija.filas !== null ? `${formatoConteoDe(hija.filas, "fila")}, una por cada repetición del grupo, enlazadas a su respuesta en ${hija.madre}.` : `Una fila por cada repetición del grupo, enlazada a su respuesta en ${hija.madre}.`}
            </p>
          </Bloque>
        ) : (
          <Bloque id={`${ID_INSPECTOR_DE_BASE}-fuentes`} titulo="Fuentes de respuestas">
            {base.fuentes.length ? (
              <ul className="pulso-bases-fuentes">
                {base.fuentes.map((fuente) => (
                  <li key={fuente.clave} className="pulso-bases-fuente">
                    <div className="pulso-bases-fuente-texto">
                      {fuente.esArchivo ? <NombreArchivo nombre={fuente.titulo} /> : <strong className="pulso-bases-fuente-titulo">{fuente.titulo}</strong>}
                      <small className="pulso-bases-fuente-detalle">
                        {detalleDeFuente(fuente, unaFuente ? base.columnas : null)}
                        {fuente.llave ? <code>{fuente.llave}</code> : null}
                      </small>
                    </div>
                    {unaFuente && hayAccionesDeFuente ? <div className="pulso-bases-fuente-acciones">{accionesDeFuente}</div> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="pulso-bases-dato is-sin-dato">Sin fuente registrada</p>
                {hayAccionesDeFuente ? <div className="pulso-bases-acciones">{accionesDeFuente}</div> : null}
              </>
            )}
            {!unaFuente && base.columnas !== null ? (
              <p className="pulso-bases-dato">{formatoConteoDe(base.columnas, "columna")} en el archivo recibido</p>
            ) : null}
            {reemplazando ? (
              <ReplaceFilesForm
                baseNombre={base.nombre}
                onCancel={() => setReemplazando(false)}
                onSubmit={({ xlsformFileId, dataFileId }) => correr(
                  () => apiEstudioReplaceBaseFiles(base.nombre, {
                    xlsform_file_id: xlsformFileId || undefined,
                    data_file_id: dataFileId || undefined,
                  }),
                  () => setReemplazando(false),
                )}
              />
            ) : null}
            {propia ? (
              <>
                <PulsoButton
                  variant="secondary"
                  size="md"
                  className="pulso-bases-otra-fuente"
                  disabled={ocupado || !base.puedeAgregarFuente}
                  aria-describedby={base.puedeAgregarFuente ? undefined : idCausa}
                  onClick={onAgregarFuente}
                >
                  <Plus size={14} aria-hidden="true" />Agregar otra fuente
                </PulsoButton>
                {!base.puedeAgregarFuente ? <p id={idCausa} className="pulso-bases-causa">{CAUSA_SIN_OTRA_FUENTE}</p> : null}
              </>
            ) : null}
          </Bloque>
        )}

        {integracion ? (
          <Bloque id={`${ID_INSPECTOR_DE_BASE}-union`} titulo="Cómo se unieron">
            <ResumenDeIntegracionVista base={base.nombre} resumen={integracion} />
          </Bloque>
        ) : null}

        <Bloque id={`${ID_INSPECTOR_DE_BASE}-formulario`} titulo="Formulario">
          <dl className="pulso-bases-hechos">
            <div>
              <dt>Origen</dt>
              <dd>{hija ? `Formulario de ${hija.madre}` : base.formularioDe}</dd>
            </div>
            {base.formulario ? (
              <div>
                <dt>Archivo</dt>
                <dd><NombreArchivo nombre={base.formulario} /></dd>
              </div>
            ) : null}
            {vinculo ? (
              <div>
                <dt>Revisión</dt>
                <dd>
                  {vinculo.formulario}, {vinculo.revision}
                  {vinculo.logicaExterna ? <span className="pulso-bases-canal">{rotuloBaseDeclarada(vinculo)}</span> : null}
                </dd>
              </div>
            ) : null}
          </dl>
          {/* "Variables" va con las acciones del formulario: el prototipo titula el inspector solo con el nombre. */}
          <div className="pulso-bases-acciones">
            <IrAVariablesDeBase base={nombre} etiqueta={etiqueta}>
              <Columns3 size={13} aria-hidden="true" />Variables
            </IrAVariablesDeBase>
            {vinculo ? (
              <>
              <AbrirPanelFuentes
                variant="secondary"
                clave={`armonizacion:${base.nombre}`}
                destino={(search) => searchConArmonizacionBase(search, base.nombre)}
                etiqueta={`Ver armonización de ${base.etiqueta}`}
              >
                <ListChecks size={13} aria-hidden="true" />Ver armonización
              </AbrirPanelFuentes>
              {comparables.length ? (
                <AbrirPanelFuentes
                  variant="secondary"
                  clave={`comparar:${base.nombre}`}
                  destino={(search) => searchConComparacion(search, { a: base.nombre, b: comparables[0] })}
                  etiqueta={`Comparar ${base.etiqueta} con ${etiquetaDeOtra}`}
                >
                  <GitCompareArrows size={13} aria-hidden="true" />Comparar con {etiquetaDeOtra}
                </AbrirPanelFuentes>
              ) : null}
              </>
            ) : null}
          </div>
          {avisoDelFormulario}
        </Bloque>
      </div>
      <footer className="pulso-bases-inspector-pie">
        {confirmando ? (
          <div className="pulso-bases-confirmar" role="alert">
            <span>El formulario y las respuestas de {etiqueta} dejan de estar en el proyecto. Las láminas de Gráficos que usan sus variables se quedan sin datos.</span>
            <PulsoButton
              variant="danger"
              size="sm"
              disabled={ocupado}
              onClick={() => void correr(async () => { await apiEstudioRemoveBase(base.nombre); return apiEstudioGet(); }, () => { setConfirmando(false); onQuitada(); })}
            >
              Quitar base
            </PulsoButton>
            <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
          </div>
        ) : (
          <div className="pulso-bases-pie-acciones" role="group" aria-label={`Acciones de ${etiqueta}`}>
            {propia ? (
              <>
                <PulsoButton variant="secondary" size="md" disabled={ocupado || editando} onClick={() => setEditando(true)}>
                  <Pencil size={14} aria-hidden="true" />Renombrar
                </PulsoButton>
                <PulsoButton variant="secondary" size="md" disabled={ocupado} onClick={() => setConfirmando(true)}>
                  <Trash2 size={14} aria-hidden="true" />Quitar
                </PulsoButton>
              </>
            ) : null}
            <PulsoButton
              variant="secondary"
              size="md"
              disabled={ocupado || !descargable || descarga.estado.fase === "en_curso"}
              onClick={descarga.descargar}
              aria-label={`Descargar la base preparada de ${etiqueta}`}
            >
              <Download size={14} aria-hidden="true" />Descargar
            </PulsoButton>
          </div>
        )}
        <DescargaDeBaseEnFila gen={descarga} />
      </footer>
    </Panel>
  );
}
