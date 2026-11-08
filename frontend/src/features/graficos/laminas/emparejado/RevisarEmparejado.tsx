// "Revisar emparejado" (`?panel=emparejado`; ADR 0135 §7, enmienda al ADR 0104 en Gráficos; maqueta graficos-sintesis,
// Grupos). Una fila por pregunta del contraste entre públicos con su par y cómo se emparejó. Lo que se confirma aquí se
// escribe en el payload de la lámina (`vars`/`titulos_grupo`, como EditorTemasEquivalentes) y la regla del contraste lo
// cuenta; «Confirmar los idénticos (N)» confirma de una vez sólo las sugerencias de texto idéntico, y cada par se deshace
// solo (X6); "Guardar lo confirmado en la matriz" lo funde en la declaración (GET, unión, POST) sin quitar nada.
// La lógica vive en modeloEmparejado.ts.

import type { RefObject } from "react";
import { Link2, ListChecks, Users } from "../../../../vendor/lucide-react";
import { ApiError } from "../../../../api/core";
import { getEquivalencias, guardarEquivalencias } from "../../../../api/equivalencias";
import type { PreguntaDeBase } from "../../../../api/graficosEmparejado";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { Dialog } from "../../../../components/Dialog";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";
import { ErrorBlock } from "../../../../components/States";
import { toast } from "../../../../components/toasterStore";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { nombrePublico, type TemaPublicos } from "../../multiapiladas/temasPublicos";
import { Segmentado } from "../../subpestanas/Segmentado";
import {
  COINCIDENCIAS, coincidenciasDe, contarCoincidencias, filtrarPorCoincidencia, ROTULO_COINCIDENCIA, rotuloFiltroCoincidencia,
  type FiltroCoincidencia,
} from "./coincidencia";
import { EvidenciaPar } from "./EvidenciaPar";
import { confirmarIdenticos, identicosPorConfirmar } from "./loteIdenticos";
import { useEmparejadoUi } from "./emparejadoStore";
import {
  avisoUnion, confirmadosDe, confirmarPar, filtrarFilas, hayCambiosEnUnion, opcionesDeBase, preguntasOcupadas, quitarPar,
  rotuloFiltro, tomadasEnBase, unirConMatriz, variableDe, type ConteoEmparejado, type FilaEmparejado, type FiltroEmparejado,
  type FuenteVariables,
} from "./modeloEmparejado";
import { PANEL_EMPAREJADO } from "./panelEmparejado";
import { TablaEmparejado } from "./TablaEmparejado";
import type { EstadoEmparejadoRemoto } from "./useEmparejado";
import "./emparejado.css";

type Props = {
  bases: readonly string[];
  basesEstudio: number;
  remoto: EstadoEmparejadoRemoto;
  recargar: () => void;
  filas: readonly FilaEmparejado[];
  conteo: ConteoEmparejado;
  temas: readonly TemaPublicos[];
  fuentes: readonly FuenteVariables[];
  /** Escribe los temas en el payload del contraste. */
  onTemas: (temas: TemaPublicos[]) => void;
  retorno: RefObject<HTMLElement>;
};

const FILTROS: readonly FiltroEmparejado[] = ["todas", "por_confirmar", "sin_par"];
const FILTROS_COINCIDENCIA: readonly FiltroCoincidencia[] = ["todas", ...COINCIDENCIAS];

const VACIO_FILTRO: Record<FiltroEmparejado, string> = {
  todas: "Sin preguntas de escala.",
  por_confirmar: "Ninguna sugerencia por confirmar.",
  sin_par: "Ninguna pregunta sin par.",
};

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(new RegExp(` ${String.fromCharCode(0xb7)} [A-Z0-9_]+$`), "");
  return e instanceof Error ? e.message : "No se pudo guardar en la matriz.";
}

/** Tras una acción la fila puede cambiar de botones o salir del filtro: el foco va a su primera acción o a la siguiente. */
function enfocarAcciones(claves: readonly string[]) {
  requestAnimationFrame(() => {
    for (const c of claves) {
      const boton = document.querySelector<HTMLButtonElement>(`[data-emp-acciones="${CSS.escape(c)}"] button`);
      if (boton) { boton.focus(); return; }
    }
  });
}

export function RevisarEmparejado({ bases, basesEstudio, remoto, recargar, filas, conteo, temas, fuentes, onTemas, retorno }: Props) {
  const ui = useEmparejadoUi();
  const coincidencias = coincidenciasDe(filas);
  const porEstado = filtrarFilas(filas, ui.filtro);
  const conteoCoincidencia = contarCoincidencias(porEstado, coincidencias);
  const visibles = filtrarPorCoincidencia(porEstado, coincidencias, ui.coincidencia);
  // La fila activa sólo cuenta mientras se ve: un filtro que la esconde también esconde su evidencia.
  const activa = visibles.find((f) => f.clave === ui.activa) ?? null;
  const ocupadas = preguntasOcupadas(filas);
  const confirmados = confirmadosDe(filas);
  // El lote mira todas las filas, no sólo las del filtro: el conteo del botón no cambia al filtrar.
  const lote = identicosPorConfirmar(filas, coincidencias);
  const lista = remoto.fase === "lista";
  const guardado = ui.guardado;
  const ocupado = guardado.fase === "leyendo" || guardado.fase === "guardando";

  const tras = (fila: FilaEmparejado, accion: () => void) => {
    const i = visibles.findIndex((f) => f.clave === fila.clave);
    accion();
    if (guardado.fase === "confirmar" || guardado.fase === "error") ui.ponerGuardado({ fase: "inactivo" });
    enfocarAcciones([fila.clave, ...visibles.slice(i + 1).map((f) => f.clave), ...visibles.slice(0, Math.max(0, i)).map((f) => f.clave).reverse()]);
  };

  const confirmar = (fila: FilaEmparejado, par: PreguntaDeBase) => tras(fila, () => {
    onTemas(confirmarPar(temas, bases, fila.pregunta, par, fila.pregunta.tema));
    ui.buscar(null);
  });
  const quitar = (fila: FilaEmparejado) => tras(fila, () => { onTemas(quitarPar(temas, fila.clave)); ui.buscar(null); });
  const confirmarLote = () => {
    if (!lote.length) return;
    onTemas(confirmarIdenticos(temas, bases, lote));
    ui.buscar(null);
    if (guardado.fase === "confirmar" || guardado.fase === "error") ui.ponerGuardado({ fase: "inactivo" });
  };
  const descartar = (fila: FilaEmparejado) => tras(fila, () => ui.descartar(fila.clave));
  const elegir = (fila: FilaEmparejado, variable: string) => {
    if (!variable) {
      if (fila.estado === "confirmado") quitar(fila);
      else if (fila.estado === "sugerido") descartar(fila);
      else ui.buscar(null);
      return;
    }
    const etiqueta = variableDe(fuentes, fila.otraBase, variable)?.label || variable;
    confirmar(fila, { base: fila.otraBase, var: variable, etiqueta });
  };
  const firmaDe = (fila: FilaEmparejado) => variableDe(fuentes, fila.pregunta.base, fila.pregunta.var)?.scale_signature;

  const leerUnion = async () => {
    const eq = await getEquivalencias();
    if (!eq.disponible) throw new Error("El estudio no tiene bases separadas: no hay matriz de equivalencias que guardar.");
    return unirConMatriz(eq.filas ?? [], confirmados);
  };
  const prepararGuardado = async () => {
    ui.ponerGuardado({ fase: "leyendo" });
    try {
      ui.ponerGuardado({ fase: "confirmar", union: await leerUnion() });
    } catch (e) {
      ui.ponerGuardado({ fase: "error", mensaje: mensajeDe(e) });
    }
  };
  const guardar = async () => {
    ui.ponerGuardado({ fase: "guardando" });
    try {
      // Se vuelve a leer la matriz justo antes de escribir: la unión siempre es con la declaración vigente.
      const union = await leerUnion();
      if (hayCambiosEnUnion(union)) await guardarEquivalencias(union.filas);
      ui.ponerGuardado({ fase: "inactivo" });
      toast.exito("Matriz de equivalencias actualizada", { detalle: avisoUnion(union) });
      recargar();
    } catch (e) {
      ui.ponerGuardado({ fase: "error", mensaje: mensajeDe(e) });
    }
  };

  const marca = basesEstudio < 2 ? "vacio:un-publico" : bases.length !== 2 ? "vacio:sin-bases" : remoto.fase === "error" ? "vacio:error"
    : !lista ? "false" : filas.length === 0 ? "vacio:sin-escala" : "graficos-emparejado";

  const cuerpo = basesEstudio < 2 ? (
    <EstadoVacio icono={<Users size={16} aria-hidden="true" />} titulo="El estudio tiene un solo público" />
  ) : bases.length !== 2 ? (
    <EstadoVacio icono={<Users size={16} aria-hidden="true" />} titulo="Elige los dos públicos que se comparan" />
  ) : remoto.fase === "error" ? (
    <ErrorBlock label="No se pudo leer el emparejado" detail={remoto.mensaje} />
  ) : !lista ? (
    <CargaDeBloque label="Leyendo el emparejado" />
  ) : filas.length === 0 ? (
    <EstadoVacio icono={<ListChecks size={16} aria-hidden="true" />} titulo="Sin preguntas de escala" />
  ) : (
    <TablaEmparejado
      filas={visibles}
      bases={bases}
      vacio={ui.coincidencia === "todas" ? VACIO_FILTRO[ui.filtro] : `Ningún par ${ROTULO_COINCIDENCIA[ui.coincidencia].toLowerCase()}.`}
      coincidencias={coincidencias}
      buscando={ui.buscando}
      activa={activa?.clave ?? null}
      onActivar={ui.activar}
      opcionesDe={(f) => opcionesDeBase(fuentes, f.otraBase, firmaDe(f), ocupadas.matriz)}
      tomadasDe={(f) => tomadasEnBase(ocupadas.lamina, f)}
      onConfirmar={confirmar}
      onElegir={elegir}
      onBuscar={(f) => ui.buscar(f ? f.clave : null)}
      onDescartar={descartar}
      onQuitar={quitar}
    />
  );

  const estadoPie = guardado.fase === "confirmar" ? avisoUnion(guardado.union)
    : guardado.fase === "error" ? <span role="alert">{guardado.mensaje}</span>
      : guardado.fase === "leyendo" ? "Leyendo la matriz"
        : guardado.fase === "guardando" ? "Guardando en la matriz"
          : conteo.confirmado ? `${formatoConteo(conteo.confirmado)} ${conteo.confirmado === 1 ? "par confirmado" : "pares confirmados"} en esta lámina`
            : "Nada confirmado en esta lámina";

  return (
    <Dialog
      panel={PANEL_EMPAREJADO}
      size="lg"
      alto="fijo"
      title="Revisar emparejado"
      subtitle={bases.length === 2 ? `${nombrePublico(bases[0])} y ${nombrePublico(bases[1])}` : "Contraste entre públicos"}
      icon={<Link2 size={16} aria-hidden="true" />}
      returnFocusTo={retorno}
      dismissible={!ocupado}
      className="pulso-f6-emp"
      flush
      stepper={lista && filas.length > 0 ? (
        <div className="pulso-f6-emp-filtros">
          <Segmentado
            etiqueta="Qué preguntas mostrar"
            opciones={FILTROS.map((clave) => ({ clave, rotulo: rotuloFiltro(clave, conteo) }))}
            valor={ui.filtro}
            onCambiar={ui.filtrar}
          />
          <Segmentado
            etiqueta="Coincidencia del par"
            opciones={FILTROS_COINCIDENCIA.map((clave) => ({ clave, rotulo: rotuloFiltroCoincidencia(clave, conteoCoincidencia) }))}
            valor={ui.coincidencia}
            onCambiar={ui.filtrarCoincidencia}
          />
        </div>
      ) : undefined}
      footerStatus={estadoPie}
      footer={guardado.fase === "confirmar" ? (
        <>
          <PulsoButton variant="secondary" onClick={() => ui.ponerGuardado({ fase: "inactivo" })}>Volver</PulsoButton>
          <PulsoButton variant="primary" onClick={() => void guardar()} disabled={!hayCambiosEnUnion(guardado.union)}>Guardar en la matriz</PulsoButton>
        </>
      ) : (
        <>
          <PulsoButton variant="secondary" onClick={confirmarLote} disabled={!lista || lote.length === 0 || ocupado}>
            {`Confirmar los idénticos (${formatoConteo(lote.length)})`}
          </PulsoButton>
          <PulsoButton variant="primary" onClick={() => void prepararGuardado()} disabled={!lista || confirmados.length === 0 || ocupado}>
            Guardar lo confirmado en la matriz
          </PulsoButton>
        </>
      )}
    >
      {/* Cuerpo flush (patrón maestro-detalle del kit): la región de la tabla es la única que desplaza y posee el vacío
          (C3, C4); la evidencia del par activo queda fija debajo y nunca tapa una fila. */}
      <div
        className="pulso-f6-emp-cuerpo"
        data-audit-ready={marca}
        data-qa-surface="graficos/emparejado"
        data-qa-geometry-group="graficos/emparejado"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-f6-emp-contenido" data-qa-geometry-member data-qa-geometry-capacity="owned">{cuerpo}</div>
        {lista && activa ? (
          <div className="pulso-f6-emp-pie-evidencia" data-qa-geometry-member>
            <EvidenciaPar fila={activa} bases={bases} coincidencia={coincidencias.get(activa.clave) ?? null} />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
