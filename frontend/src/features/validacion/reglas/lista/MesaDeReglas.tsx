/**
 * La mesa de Reglas (plan de fidelidad, rebanada V1; prototipo
 * `validacion-reglas`, `vistas.js:607-662`): la cabecera con sus cifras y
 * acciones, la franja "De las reglas a los hallazgos" y tres columnas,
 * Familias, la lista de la familia elegida y la ficha de la regla.
 *
 * La familia y la regla elegidas viven en la dirección (`familia=` y `foco=`).
 * El enlace viejo al detalle de una regla del formulario
 * (`pestana=instrumento&panel=regla&foco=<id>`) abre aquí su ficha; si el
 * foco es una regla propia, abre su panel, como desde la rebanada V2.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Play, Plus } from "../../../../vendor/lucide-react";
import { ContenedorEntregable } from "../../../../components/entregables/ContenedorEntregable";
import { FranjaDeTrabajo } from "../../../../components/procesamiento/FranjaDeTrabajo";
import { FranjaRecorrido } from "../../../../components/procesamiento/FranjaRecorrido";
import { MesaDePestana } from "../../../../components/procesamiento/MesaDePestana";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Dialog } from "../../../../components/Dialog";
import { ErrorBlock } from "../../../../components/States";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { useDireccion } from "../../../../lib/navegacion/useDireccion";
import type { Instrumento } from "../../instrumento/useInstrumento";
import { PANEL_OPERATIVO_VALIDACION, PANEL_ROLES_VALIDACION } from "../../panelesValidacion";
import { esAliasDelDetalleDeRegla } from "../../pestanaValidacion";
import { useSeleccionDeValidacion, type PestanaDireccionable } from "../../pestanaDireccionable";
import CabeceraDeTransicion from "../../pestanas/CabeceraDeTransicion";
import { cabeceraDeReglas } from "../../pestanas/cabeceraDeValidacion";
import type { PanelReglaDireccion } from "../panel/usePanelRegla";
import { searchConPanelRegla } from "../panel/usePanelRegla";
import { ColumnaDeFamilias } from "./ColumnaDeFamilias";
import { DialogoConMotivo } from "./DialogoConMotivo";
import { EsqueletoDeReglas, FichaVacia } from "./EsqueletoDeReglas";
import { FichaDePreguntaExcluible } from "./FichaDePreguntaExcluible";
import { FichaDeRegla } from "./FichaDeRegla";
import { ListaDeLaFamilia } from "./ListaDeLaFamilia";
import { preguntasExcluibles } from "./ListaFueraDeAuditoria";
import { MenuDelPlan } from "./MenuDelPlan";
import {
  FAMILIA_FUERA_DE_AUDITORIA,
  avisosDeLaFranja,
  avisosDeLaRegla,
  cifrasDeReglas,
  columnaDeFamilias,
  destinoDeLaFranja,
  entradaDeFamilia,
  familiaAbierta,
  gruposDeLaFranja,
  hayAuditoria,
  parejaDe,
  reglaElegida,
  reglasConAviso,
  reglasDeLaFamilia,
  type ReglaDelCatalogo,
} from "./modeloCatalogo";
import { indiceDePreguntas } from "./modeloRecomendador";
import { copiaParaDuplicar } from "../duplicarRegla";
import type { MesaDeReglas as Mesa } from "./useMesaDeReglas";
import type { ReglaSemilla } from "../../types";

type DialogoAbierto =
  | { tipo: "desactivar"; regla: ReglaDelCatalogo }
  | { tipo: "excluir"; variable: string }
  | null;

export function MesaDeReglas({
  mesa,
  inst,
  panel,
  irAPestana,
  onAnadirSugerida,
}: {
  mesa: Mesa;
  /** "Añadir" una sugerida: abre el panel de regla armado con ella. */
  onAnadirSugerida: (semilla: ReglaSemilla) => void;
  inst: Instrumento;
  panel: PanelReglaDireccion;
  irAPestana: PestanaDireccionable["irAPestana"];
}) {
  const seleccion = useSeleccionDeValidacion();
  const operativo = usePanelDireccionable(PANEL_OPERATIVO_VALIDACION);
  const roles = usePanelDireccionable(PANEL_ROLES_VALIDACION);
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null);
  const { lectura, complementos } = mesa;
  const lista = lectura.fase === "lista" ? lectura : null;
  const excluidas = complementos.excluidas ?? null;
  const propias = complementos.propias ?? null;

  // El enlace viejo al detalle de una regla propia abre su panel, con la dirección limpia (rebanada V2).
  const focoDelAlias = esAliasDelDetalleDeRegla(direccion?.pestana, direccion?.panel) ? direccion?.foco ?? null : null;
  useEffect(() => {
    if (!focoDelAlias || !propias?.some((r) => r.id === focoDelAlias)) return;
    navigate({ pathname: location.pathname, search: searchConPanelRegla(location.search, focoDelAlias) }, { replace: true });
  }, [focoDelAlias, propias, location.pathname, location.search, navigate]);

  const vista = useMemo(() => {
    if (!lista) return null;
    const { catalogo } = lista;
    const grupos = columnaDeFamilias(catalogo, excluidas ? excluidas.variables.length : null);
    const abierta = familiaAbierta(catalogo, grupos, seleccion.familia, seleccion.foco);
    const entrada = entradaDeFamilia(grupos, abierta) ?? grupos[0].entradas[0];
    const reglas = reglasDeLaFamilia(catalogo, abierta);
    const preguntas = abierta === FAMILIA_FUERA_DE_AUDITORIA ? preguntasExcluibles(excluidas) : [];
    const pregunta = preguntas.find((p) => p.variable === seleccion.foco) ?? preguntas[0] ?? null;
    const regla = reglaElegida(reglas, seleccion.foco);
    return { grupos, abierta, entrada, reglas, preguntas, pregunta, regla, conAviso: reglasConAviso(catalogo) };
  }, [lista, excluidas, seleccion.familia, seleccion.foco]);

  const indice = useMemo(() => indiceDePreguntas(complementos.inventario), [complementos.inventario]);

  const ocupada = !!mesa.ocupado || !!inst.busy || !!mesa.trabajo;
  const controlesSinAplicar = inst.operationalDirty;
  const catalogo = lista?.catalogo ?? null;
  const sinActivas = catalogo ? (catalogo.n_activas ?? 0) === 0 : true;
  const causaAuditar = controlesSinAplicar
    ? "Los controles del operativo tienen cambios sin aplicar."
    : sinActivas
      ? "No hay reglas activas que auditar."
      : undefined;

  // El rótulo de espera dura hasta tener el catálogo nuevo (ítem 26).
  const releer = () => mesa.leerFormulario(inst.onBuildPlan);
  const importar = async (archivo: File) => {
    await inst.onImport(archivo);
    await mesa.recargar();
  };
  const activar = (regla: ReglaDelCatalogo, activa: boolean) => {
    if (!activa && regla.origen !== "propia") setDialogo({ tipo: "desactivar", regla });
    else void mesa.alternarActiva(regla, activa);
  };
  // Duplicar abre el panel con una regla nueva llena con lo de la propia elegida.
  const duplicar = (regla: ReglaDelCatalogo) => {
    const original = propias?.find((r) => r.id === regla.id);
    if (original) onAnadirSugerida(copiaParaDuplicar(original));
  };
  const excluir = (variable: string, siguiente: boolean) => {
    if (siguiente) setDialogo({ tipo: "excluir", variable });
    else void mesa.excluirPregunta(variable, false);
  };
  const verEnHallazgos = (regla: ReglaDelCatalogo) => {
    const conCasos = (regla.ultima_auditoria?.n_casos ?? 0) > 0 && regla.id_motor;
    irAPestana("hallazgos", undefined, conCasos ? { foco: regla.id_motor } : {});
  };

  const cabeceraBase = cabeceraDeReglas();
  const cabecera = (
    <CabeceraDeTransicion
      pestana="reglas"
      cifras={catalogo ? cifrasDeReglas(catalogo) : []}
      pendientes={catalogo ? undefined : cabeceraBase.pendientes}
      acciones={(
        <>
          <PulsoButton variant="primary" disabled={!lista || ocupada} onClick={() => panel.abrirNueva()}>
            <Plus size={14} aria-hidden="true" />
            Nueva regla
          </PulsoButton>
          <PulsoButton
            variant="secondary"
            disabled={!lista || ocupada || !!causaAuditar}
            title={causaAuditar}
            onClick={() => void mesa.auditar("cabecera")}
          >
            <Play size={14} aria-hidden="true" />
            Auditar
          </PulsoButton>
          <MenuDelPlan
            planConstruido={!!catalogo?.plan_construido}
            hayAuditoria={!!catalogo && hayAuditoria(catalogo)}
            controlesSinAplicar={controlesSinAplicar}
            controlesValidos={inst.operationalValid}
            ocupado={!lista || ocupada}
            onReleer={() => void releer()}
            onExportar={inst.onExport}
            onImportar={(archivo) => void importar(archivo)}
          />
        </>
      )}
    />
  );

  const error = mesa.error || inst.error;
  const avisos = (
    <>
      {error ? <ErrorBlock label="No se pudo completar la acción" detail={error} /> : null}
      <ContenedorEntregable estado={inst.entregaPlan.estado} forma="bloque" onCerrar={inst.cerrarPlan} />
    </>
  );

  const trabajoEnCurso = mesa.trabajo || mesa.ocupado || inst.busy;
  const franja = !catalogo || !vista ? undefined : trabajoEnCurso ? (
    <FranjaDeTrabajo
      titulo={mesa.trabajo ? "Auditando la base" : mesa.ocupado || inst.busy}
      onCancelar={mesa.trabajo ? () => void mesa.cancelarAuditoria() : undefined}
    />
  ) : (
    <FranjaRecorrido
      etiqueta="De las reglas a los hallazgos"
      grupoDeGeometria="validacion/reglas-franja"
      grupos={gruposDeLaFranja(catalogo, {
        nCasosAuditados: mesa.nCasosAuditados,
        cola: complementos.limpieza?.decision_queue ?? null,
      })}
      destino={destinoDeLaFranja(catalogo, {
        nCasosAuditados: mesa.nCasosAuditados,
        cola: complementos.limpieza?.decision_queue ?? null,
      }, () => irAPestana("hallazgos"))}
      avisos={[
        ...(controlesSinAplicar
          ? [{ id: "controles", texto: "Los controles del operativo tienen cambios sin aplicar: no se puede auditar hasta aplicarlos.", tono: "aviso" as const }]
          : []),
        ...avisosDeLaFranja(catalogo),
      ]}
      accionDeAvisos={controlesSinAplicar ? (
        <PulsoButton variant="link" size="sm" onClick={operativo.abrir}>Revisar los controles</PulsoButton>
      ) : undefined}
    />
  );

  if (lectura.fase === "error") {
    return (
      <MesaDePestana grupo="validacion/reglas" columnas={3} cabecera={cabecera}>
        <div className="pulso-rl-error">
          <ErrorBlock label="No se pudo leer el catálogo de reglas" detail={lectura.mensaje} />
          <PulsoButton variant="secondary" onClick={() => void mesa.recargar()}>Reintentar</PulsoButton>
        </div>
      </MesaDePestana>
    );
  }

  if (!lista || !vista || !catalogo) {
    return (
      <MesaDePestana grupo="validacion/reglas" columnas={3} cabecera={cabecera}>
        <EsqueletoDeReglas />
      </MesaDePestana>
    );
  }

  const { grupos, abierta, entrada, reglas, preguntas, pregunta, regla, conAviso } = vista;
  const elegirFamilia = (clave: string) => seleccion.elegir({ familia: clave, foco: null });
  const elegir = (id: string) => seleccion.elegir({ familia: abierta, foco: id });

  let ficha = null;
  if (abierta === FAMILIA_FUERA_DE_AUDITORIA) {
    ficha = pregunta ? (
      <FichaDePreguntaExcluible
        pregunta={pregunta}
        motivo={excluidas?.motivos?.[pregunta.variable] ?? null}
        ocupada={ocupada}
        onExcluir={(siguiente) => excluir(pregunta.variable, siguiente)}
      />
    ) : null;
  } else if (regla) {
    ficha = (
      <FichaDeRegla
        regla={regla}
        pareja={parejaDe(catalogo, regla)}
        avisos={avisosDeLaRegla(catalogo, regla)}
        auditadaEn={catalogo.auditada_en}
        ocupada={ocupada}
        onElegir={elegir}
        onActivar={(activa) => activar(regla, activa)}
        onEditar={() => panel.abrirRegla(regla.id)}
        onDuplicar={propias?.some((r) => r.id === regla.id) ? () => duplicar(regla) : undefined}
        onConvertir={() => panel.abrirNueva({ pregunta: regla.variable_revisada })}
        onConfigurar={operativo.abrir}
        onVerEnHallazgos={() => verEnHallazgos(regla)}
        onIrAFueraDeAuditoria={(variable) => seleccion.elegir({ familia: FAMILIA_FUERA_DE_AUDITORIA, foco: variable })}
      />
    );
  }

  return (
    <>
      <MesaDePestana grupo="validacion/reglas" columnas={3} cabecera={cabecera} avisos={avisos} franja={franja}>
        <ColumnaDeFamilias
          grupos={grupos}
          abierta={abierta}
          onElegir={elegirFamilia}
          onControlesDelOperativo={operativo.abrir}
          onRoles={roles.abrir}
        />
        <ListaDeLaFamilia
          familia={entrada}
          reglas={reglas}
          elegida={abierta === FAMILIA_FUERA_DE_AUDITORIA ? pregunta?.variable ?? null : regla?.id ?? null}
          conAviso={conAviso}
          ocupada={ocupada}
          semillas={complementos.semillas}
          indice={indice}
          preguntasExcluibles={preguntas}
          onElegir={elegir}
          onActivar={activar}
          onDuplicar={propias ? duplicar : undefined}
          onAnadirSugerida={onAnadirSugerida}
          onNuevaRegla={() => panel.abrirNueva()}
          onLeerFormulario={() => void releer()}
          leerFormularioDeshabilitado={ocupada || !inst.operationalValid}
          leyendoPlan={mesa.leyendoPlan}
          onExcluir={excluir}
        />
        {ficha ?? <FichaVacia />}
      </MesaDePestana>

      <DialogoConMotivo
        abierto={dialogo?.tipo === "desactivar"}
        titulo="Motivo para desactivar la regla"
        etiqueta="Motivo para desactivar la regla"
        detalle={dialogo?.tipo === "desactivar" ? `"${dialogo.regla.nombre}" deja de entrar en la auditoría.` : ""}
        confirmar="Desactivar"
        onCerrar={() => setDialogo(null)}
        onConfirmar={(motivo) => {
          if (dialogo?.tipo === "desactivar") void mesa.alternarActiva(dialogo.regla, false, motivo);
          setDialogo(null);
        }}
      />
      <DialogoConMotivo
        abierto={dialogo?.tipo === "excluir"}
        titulo="Dejar la pregunta fuera de la auditoría"
        etiqueta={dialogo?.tipo === "excluir" ? `Motivo para excluir ${dialogo.variable}` : "Motivo para excluir"}
        detalle="Todas las reglas de la pregunta dejan de auditarse."
        confirmar="Excluir"
        onCerrar={() => setDialogo(null)}
        onConfirmar={(motivo) => {
          if (dialogo?.tipo === "excluir") void mesa.excluirPregunta(dialogo.variable, true, motivo);
          setDialogo(null);
        }}
      />
    </>
  );
}
