// Inspector de una base (Carga › Bases, R2): 400 px a la derecha de la
// colección, abierto por `foco=<base>`. Dos bloques compactos, "Cómo se
// unieron" y "Formulario", y las acciones de la base. La cifra de respuestas ya
// la dice la tarjeta: aquí no se repite.

import { useState, type ReactNode } from "react";
import { apiEstudioGet, apiEstudioRemoveBase, apiEstudioRenameBase, apiEstudioReplaceBaseFiles, type EstudioBase, type EstudioPayload } from "../../../../api/estudio";
import { CabeceraPanel } from "../../../../components/CabeceraPanel";
import { NombreArchivo } from "../../../../components/entregables/NombreArchivo";
import { Panel } from "../../../../components/Panel";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { ErrorBlock } from "../../../../components/States";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { Columns3, Download, FileCheck2, GitCompareArrows, GitMerge, ListChecks, Pencil, RefreshCw, Repeat, Trash2, Upload } from "../../../../vendor/lucide-react";
import { ReplaceFilesForm } from "../../BasesPanel";
import { DescargaDeBaseEnFila, useDescargaDeBase } from "../../entregas/DescargaDeBase";
import { AbrirPanelFuentes } from "../../fuentes/AbrirPanelFuentes";
import { comparablesCon, searchConArmonizacionBase, searchConComparacion } from "../../fuentes/compararFuentesModel";
import { rotuloBaseDeclarada, vinculoFormularioDeBase } from "../../fuentes/formularioPublicadoModel";
import { IrAVariablesDeBase } from "../../fuentes/IrAVariablesDeBase";
import { NuevaVersionRespuestas } from "../../fuentes/NuevaVersionRespuestas";
import { useFormulariosPublicados } from "../../fuentes/useFormulariosPublicados";
import { CAUSA_SIN_OTRA_FUENTE, type BaseDeLaColeccion, type HijaDeBase } from "./basesModel";
import { resumenDeIntegracion } from "./integracionModel";
import { ResumenDeIntegracionVista } from "./ResumenDeIntegracionVista";
import { IconoDeOrigen, ID_INSPECTOR_DE_BASE } from "./TarjetaDeBase";

export type InspectorDeBaseProps = {
  base: BaseDeLaColeccion;
  hija: HijaDeBase | null;
  /** Las demás bases del estudio, para "Comparar con". */
  basesDelEstudio: readonly EstudioBase[];
  ocupado: boolean;
  onCerrar: () => void;
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

function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section className="pulso-bases-bloque" aria-labelledby={id}>
      <h4 id={id} className="pulso-bases-bloque-titulo">{titulo}</h4>
      {children}
    </section>
  );
}

function Renombrar({ base, ocupado, onGuardar, onCancelar }: {
  base: string;
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
      <PulsoInput size="sm" value={borrador} onChange={(e) => setBorrador(e.target.value)} aria-label={`Nuevo nombre de la base ${base}`} autoFocus />
      <PulsoButton type="submit" variant="primary" size="sm" disabled={ocupado}>Guardar</PulsoButton>
      <PulsoButton type="button" variant="ghost" size="sm" onClick={onCancelar}>Cancelar</PulsoButton>
    </form>
  );
}

export function InspectorDeBase({
  base,
  hija,
  basesDelEstudio,
  ocupado: ocupadoPagina,
  onCerrar,
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
  // Solo una base del estudio puede venir de un formulario publicado: con una base no se pide el catálogo.
  const publicados = useFormulariosPublicados(base.enEstudio);
  const integracion = !hija && base.base ? resumenDeIntegracion(base.base) : null;
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // Lo hacía la fila de cada base en BasesPanel ("Actualizar archivos").
  const [reemplazando, setReemplazando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const ocupado = ocupadoPagina || trabajando;
  const vinculo = !hija && base.base ? vinculoFormularioDeBase(base.base, publicados.formularios) : null;
  const comparables = !hija && base.enEstudio ? comparablesCon(base.nombre, basesDelEstudio) : [];
  const idCausa = `${ID_INSPECTOR_DE_BASE}-causa-fuente`;

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

  return (
    <Panel noPadding className="pulso-bases-inspector" id={ID_INSPECTOR_DE_BASE} aria-label={`Detalle de ${etiqueta}`}>
      <CabeceraPanel
        como="header"
        nivel={3}
        icono={hija ? <Repeat size={16} aria-hidden="true" /> : <IconoDeOrigen origen={base.origen} />}
        titulo={editando ? "Renombrar la base" : etiqueta}
        subtitulo={hija ? `Grupo repetido de ${hija.madre}` : base.origen}
        onCerrar={onCerrar}
        etiquetaCerrar="Cerrar el detalle de la base"
      />
      {/* Cuerpo: dueño del scroll y del alto libre de la columna (C3, C4); el pie queda fijo. */}
      <div className="pulso-bases-inspector-cuerpo" role="region" aria-label={`Fuentes, formulario y acciones de ${etiqueta}`} tabIndex={0} data-qa-geometry-capacity="owned">
        {editando ? (
          <Renombrar
            base={base.nombre}
            ocupado={ocupado}
            onCancelar={() => setEditando(false)}
            onGuardar={(nuevo) => void correr(() => apiEstudioRenameBase(base.nombre, nuevo), () => { setEditando(false); onRenombrada(nuevo); })}
          />
        ) : null}
        {error ? <ErrorBlock label="No se pudo completar" detail={error} queda="La base sigue como estaba." /> : null}

        <Bloque id={`${ID_INSPECTOR_DE_BASE}-fuentes`} titulo="Cómo se unieron">
          {integracion ? (
            <ResumenDeIntegracionVista resumen={integracion} />
          ) : (
            <>
            {hija ? (
              <p className="pulso-bases-dato">Una fila por cada repetición del grupo, enlazada a su respuesta en {hija.madre}.</p>
            ) : base.fuentes.length ? (
              <ul className="pulso-bases-fuentes">
                {base.fuentes.map((fuente) => (
                  <li key={fuente.clave}>
                    {fuente.esArchivo ? <NombreArchivo nombre={fuente.titulo} /> : <span className="pulso-bases-fuente-titulo">{fuente.titulo}</span>}
                    {fuente.canal ? <span className="pulso-bases-canal">{fuente.canal}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pulso-bases-dato is-sin-dato">Sin fuente registrada</p>
            )}
            {!hija && base.unidasPor ? (
              <p className="pulso-bases-dato">Unidas por la columna <code>{base.unidasPor}</code></p>
            ) : null}
            </>
          )}
          {!hija && base.columnas !== null ? (
            <p className="pulso-bases-dato">{formatoConteoDe(base.columnas, "columna")} en el archivo recibido</p>
          ) : null}
        </Bloque>

        <Bloque id={`${ID_INSPECTOR_DE_BASE}-formulario`} titulo="Formulario">
          {base.formulario ? <NombreArchivo nombre={base.formulario} /> : (
            <p className="pulso-bases-dato is-sin-dato">{base.falta === "formulario" ? "Falta el formulario" : "Sin archivo de formulario registrado"}</p>
          )}
          {vinculo ? (
            <div className="pulso-bases-vinculo">
              <p className="pulso-bases-dato">
                <FileCheck2 size={13} aria-hidden="true" />
                <span>Formulario publicado: <strong>{vinculo.formulario}</strong>, {vinculo.revision}</span>
                {vinculo.logicaExterna ? <span className="pulso-bases-canal">{rotuloBaseDeclarada(vinculo)}</span> : null}
              </p>
              <div className="pulso-bases-acciones">
                <AbrirPanelFuentes
                  variant="secondary"
                  clave={`armonizacion:${base.nombre}`}
                  destino={(search) => searchConArmonizacionBase(search, base.nombre)}
                  etiqueta={`Ver armonización de ${base.nombre}`}
                >
                  <ListChecks size={13} aria-hidden="true" />Ver armonización
                </AbrirPanelFuentes>
                {comparables.length ? (
                  <AbrirPanelFuentes
                    variant="secondary"
                    clave={`comparar:${base.nombre}`}
                    destino={(search) => searchConComparacion(search, { a: base.nombre, b: comparables[0] })}
                    etiqueta={`Comparar ${base.nombre} con ${comparables[0]}`}
                  >
                    <GitCompareArrows size={13} aria-hidden="true" />Comparar con {comparables[0]}
                  </AbrirPanelFuentes>
                ) : null}
              </div>
            </div>
          ) : null}
          {avisoDelFormulario}
        </Bloque>

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
          <div className="pulso-bases-acciones" role="group" aria-label={`Acciones de ${etiqueta}`}>
            {onCambiarFuente ? (
              <PulsoButton variant="secondary" size="sm" aria-haspopup="dialog" disabled={ocupado} onClick={onCambiarFuente}>
                <Upload size={13} aria-hidden="true" />Cambiar la fuente
              </PulsoButton>
            ) : null}
            <IrAVariablesDeBase base={nombre} etiqueta={etiqueta}>
              <Columns3 size={13} aria-hidden="true" />Variables
            </IrAVariablesDeBase>
            {!hija && base.recibeNuevaVersion && base.enEstudio ? (
              <NuevaVersionRespuestas base={base.nombre} ocupado={ocupado} onCambio={onCambio} />
            ) : null}
            {!hija && base.enEstudio && base.reemplazaArchivos ? (
              <PulsoButton variant="secondary" size="sm" disabled={ocupado || reemplazando} onClick={() => setReemplazando(true)}>
                <RefreshCw size={13} aria-hidden="true" />Reemplazar archivos
              </PulsoButton>
            ) : null}
            {!hija && base.enEstudio ? (
              <>
                <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => setEditando(true)}>
                  <Pencil size={13} aria-hidden="true" />Renombrar
                </PulsoButton>
                <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => setConfirmando(true)}>
                  <Trash2 size={13} aria-hidden="true" />Quitar base
                </PulsoButton>
              </>
            ) : null}
            {!hija && base.enEstudio ? (
              <PulsoButton
                variant="secondary"
                size="sm"
                disabled={ocupado || !base.puedeAgregarFuente}
                aria-describedby={base.puedeAgregarFuente ? undefined : idCausa}
                onClick={onAgregarFuente}
              >
                <GitMerge size={13} aria-hidden="true" />Agregar una fuente
              </PulsoButton>
            ) : null}
          </div>
        )}
        {reemplazando && !hija ? (
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
        {!hija && base.enEstudio && !base.puedeAgregarFuente ? (
          <p id={idCausa} className="pulso-bases-causa">{CAUSA_SIN_OTRA_FUENTE}</p>
        ) : null}
      </div>
      <footer className="pulso-bases-inspector-pie">
        <PulsoButton
          variant="primary"
          size="md"
          className="pulso-bases-pie-principal"
          disabled={ocupado || !descargable || descarga.estado.fase === "en_curso"}
          onClick={descarga.descargar}
          aria-label={`Descargar la base preparada de ${etiqueta}`}
        >
          <Download size={14} aria-hidden="true" />Descargar base
        </PulsoButton>
        <DescargaDeBaseEnFila gen={descarga} />
      </footer>
    </Panel>
  );
}
