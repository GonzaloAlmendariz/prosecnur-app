// "Revisar emparejado" (`?panel=emparejado`; ADR 0135 §7, enmienda al ADR 0104 en Gráficos; maqueta graficos-sintesis,
// Grupos). Una fila por pregunta del contraste entre públicos con su par y cómo se emparejó. Lo que se confirma aquí se
// escribe en el payload de la lámina (`vars`/`titulos_grupo`, como EditorTemasEquivalentes) y la regla del contraste lo
// cuenta; "Guardar lo confirmado en la matriz" lo funde en la declaración (GET, unión, POST) sin quitar nada.
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
  const visibles = filtrarFilas(filas, ui.filtro);
  const ocupadas = preguntasOcupadas(filas);
  const confirmados = confirmadosDe(filas);
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
    <EstadoVacio icono={<Users size={16} aria-hidden="true" />} titulo="Elige las dos bases que se comparan" />
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
      vacio={VACIO_FILTRO[ui.filtro]}
      buscando={ui.buscando}
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
      stepper={lista && filas.length > 0 ? (
        <Segmentado
          etiqueta="Qué preguntas mostrar"
          opciones={FILTROS.map((clave) => ({ clave, rotulo: rotuloFiltro(clave, conteo) }))}
          valor={ui.filtro}
          onCambiar={ui.filtrar}
        />
      ) : undefined}
      footerStatus={estadoPie}
      footer={guardado.fase === "confirmar" ? (
        <>
          <PulsoButton variant="secondary" onClick={() => ui.ponerGuardado({ fase: "inactivo" })}>Volver</PulsoButton>
          <PulsoButton variant="primary" onClick={() => void guardar()} disabled={!hayCambiosEnUnion(guardado.union)}>Guardar en la matriz</PulsoButton>
        </>
      ) : (
        <PulsoButton variant="primary" onClick={() => void prepararGuardado()} disabled={!lista || confirmados.length === 0 || ocupado}>
          Guardar lo confirmado en la matriz
        </PulsoButton>
      )}
    >
      <div
        className="pulso-f6-emp-cuerpo"
        data-audit-ready={marca}
        data-qa-surface="graficos/emparejado"
        data-qa-geometry-group="graficos/emparejado"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-f6-emp-contenido" data-qa-geometry-member>{cuerpo}</div>
      </div>
    </Dialog>
  );
}
