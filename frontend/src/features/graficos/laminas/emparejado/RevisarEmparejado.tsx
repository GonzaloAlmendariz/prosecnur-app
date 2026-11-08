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
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import {
  COINCIDENCIAS, coincidenciasDe, contarCoincidencias, filtrarPorCoincidencia, rotuloFiltroCoincidencia, vacioDeFiltros,
  type FiltroCoincidencia,
} from "./coincidencia";
import { EvidenciaPar } from "./EvidenciaPar";
import { avisoSugerenciasPerdidas, confirmarIdenticos, identicosPorConfirmar, sugerenciasQuePierdeElLote } from "./loteIdenticos";
import { useEmparejadoUi } from "./emparejadoStore";
import {
  avisoUnion, confirmadosDe, confirmarPar, filtrarFilas, hayCambiosEnUnion, opcionesDeBase, preguntasOcupadas, quitarPar,
  rotuloFiltro, tomadasEnBase, unirConMatriz, variableDe, type ConteoEmparejado, type FilaEmparejado, type FiltroEmparejado,
  type FuenteVariables,
} from "./modeloEmparejado";
import { PANEL_EMPAREJADO } from "./panelEmparejado";
import { ATAJO, filaVecina, type AccionTecla } from "./teclado";
import { TablaEmparejado } from "./TablaEmparejado";
import type { EstadoEmparejadoRemoto } from "./useEmparejado";
import { useTecladoEmparejado } from "./useTecladoEmparejado";
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

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(new RegExp(` ${String.fromCharCode(0xb7)} [A-Z0-9_]+$`), "");
  return e instanceof Error ? e.message : "No se pudo guardar en la matriz.";
}

type Destino = "acciones" | "ancla";

/**
 * Tras una acción la fila puede cambiar de botones o salir del filtro: el foco va a la misma fila o a la siguiente. Con el
 * ratón, a su primera acción; con el teclado (X6), a su ancla, que la deja activa para seguir con J, K, Enter y X.
 */
function enfocarFila(claves: readonly string[], destino: Destino, activar: (clave: string) => void) {
  requestAnimationFrame(() => {
    for (const c of claves) {
      const sel = destino === "ancla" ? `[data-emp-fila="${CSS.escape(c)}"]` : `[data-emp-acciones="${CSS.escape(c)}"] button`;
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      if (destino === "ancla") {
        activar(c);
        el.focus();
        el.scrollIntoView?.({ block: "nearest" });
      } else el.focus();
      return;
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

  const tras = (fila: FilaEmparejado, accion: () => void, destino: Destino = "acciones") => {
    const i = visibles.findIndex((f) => f.clave === fila.clave);
    accion();
    if (guardado.fase === "confirmar" || guardado.fase === "error") ui.ponerGuardado({ fase: "inactivo" });
    if (ui.avisoLote) ui.ponerAvisoLote(null);
    const orden = [fila.clave, ...visibles.slice(i + 1).map((f) => f.clave), ...visibles.slice(0, Math.max(0, i)).map((f) => f.clave).reverse()];
    enfocarFila(orden, destino, ui.activar);
  };

  const confirmar = (fila: FilaEmparejado, par: PreguntaDeBase, destino?: Destino) => tras(fila, () => {
    onTemas(confirmarPar(temas, bases, fila.pregunta, par, fila.pregunta.tema));
    ui.buscar(null);
  }, destino);
  const quitar = (fila: FilaEmparejado, destino?: Destino) => tras(fila, () => { onTemas(quitarPar(temas, fila.clave)); ui.buscar(null); }, destino);
  const confirmarLote = () => {
    if (!lote.length) return;
    // E6: antes de escribir, cuántas filas se quedan sin su sugerencia porque el lote confirma su par con otra.
    ui.ponerAvisoLote(avisoSugerenciasPerdidas(sugerenciasQuePierdeElLote(filas, lote)));
    onTemas(confirmarIdenticos(temas, bases, lote));
    ui.buscar(null);
    if (guardado.fase === "confirmar" || guardado.fase === "error") ui.ponerGuardado({ fase: "inactivo" });
  };
  const descartar = (fila: FilaEmparejado, destino?: Destino) => tras(fila, () => ui.descartar(fila.clave), destino);

  // J y K recorren las filas visibles; Enter confirma y X descarta o quita el par de la fila activa (teclado.ts).
  const alTeclado = (accion: AccionTecla) => {
    if (accion === "siguiente" || accion === "anterior") {
      const c = filaVecina(visibles.map((f) => f.clave), activa?.clave ?? null, accion === "siguiente" ? 1 : -1);
      if (c) enfocarFila([c], "ancla", ui.activar);
      return;
    }
    if (!activa || ui.buscando) return;
    if (accion === "confirmar" && activa.estado === "sugerido" && activa.par) confirmar(activa, activa.par, "ancla");
    else if (accion === "quitar" && activa.estado === "confirmado") quitar(activa, "ancla");
    else if (accion === "quitar" && activa.estado === "sugerido") descartar(activa, "ancla");
  };
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
  useTecladoEmparejado(lista && filas.length > 0 && !ocupado, alTeclado);
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
      vacio={vacioDeFiltros(ui.filtro, ui.coincidencia)}
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
          // Una línea con elipsis y el texto entero en `title`: a dos líneas el pie crecía y la evidencia bajaba de alto.
          : ui.avisoLote ? <span role="status" className="pulso-f6-emp-aviso-lote" title={ui.avisoLote}>{ui.avisoLote}</span>
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
          <RadioSegmentado
            etiqueta="Qué preguntas mostrar"
            opciones={FILTROS.map((clave) => ({ clave, rotulo: rotuloFiltro(clave, conteo) }))}
            valor={ui.filtro}
            onCambiar={ui.filtrar}
          />
          <RadioSegmentado
            etiqueta="Coincidencia del par"
            opciones={FILTROS_COINCIDENCIA.map((clave) => ({ clave, rotulo: rotuloFiltroCoincidencia(clave, conteoCoincidencia) }))}
            valor={ui.coincidencia}
            onCambiar={ui.filtrarCoincidencia}
          />
        </div>
      ) : undefined}
      footerHint={lista && filas.length > 0 ? (
        <>
          <kbd className="pulso-dialog__kbd">{ATAJO.siguiente}</kbd>
          <kbd className="pulso-dialog__kbd">{ATAJO.anterior}</kbd>
          <span>cambian de fila</span>
          {ocupado ? null : (
            <>
              <kbd className="pulso-dialog__kbd">Esc</kbd>
              <span>cierra</span>
            </>
          )}
        </>
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
