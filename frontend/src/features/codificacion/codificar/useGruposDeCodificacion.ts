// El estado de una pregunta en Codificar: sus respuestas, sus códigos, el autoguardado y la pila de deshacer.
//
// La carga y el guardado son los de siempre (GET /respuestas, POST /grupos dos segundos después del
// último cambio); aquí solo se juntan en un lugar para que `RespuestasCodificador` componga la vista.

import { useCallback, useEffect, useRef, useState } from "react";
import { apiCodifGrupos, apiCodifRespuestas, type Grupo, type RespuestaUnica } from "../../../api/client";
import { cleanCodificacionLabel } from "../codificacionLabels";
import { podarCasosSugeridos } from "../sugerenciasModulo";
import { apilarPaso, deshacerPaso, pasoEntre, type PasoDeHistorial } from "./historialAsignaciones";

export type EstadoDeGuardado = "idle" | "dirty" | "saving" | "saved" | "error";

export type CargaDeRespuestas = {
  respuestas: RespuestaUnica[];
  tipo: string;
  /** La columna que se codifica: con ella se pide la propuesta de módulo y el diccionario de palabras. */
  colEfectiva: string;
  smOtros: { dummy_col: string; n_otros_marcados: number } | null;
};

type OpcionDelFormulario = { codigo: string; etiqueta: string };

/**
 * Los códigos de la pregunta: primero las opciones del formulario (con las respuestas que ya tuvieran
 * guardadas) y después los creados aquí.
 */
export function unirConOpciones(guardados: readonly Grupo[], opciones: readonly OpcionDelFormulario[]): Grupo[] {
  const porCodigo = new Map(guardados.map((g) => [g.codigo, g]));
  const lista: Grupo[] = [];
  for (const o of opciones) {
    const previo = porCodigo.get(o.codigo);
    const etiqueta = cleanCodificacionLabel(o.etiqueta || o.codigo);
    if (previo && previo.origen !== "nuevo") lista.push({ ...previo, origen: "existente", etiqueta });
    else lista.push({ id: `ex_${o.codigo}`, codigo: o.codigo, etiqueta, respuestas: previo?.respuestas ?? [], origen: "existente" });
    if (previo) porCodigo.delete(o.codigo);
  }
  for (const g of porCodigo.values()) lista.push({ ...g, origen: g.origen ?? "nuevo" });
  return lista;
}

export function useGruposDeCodificacion(parent: string, anunciar: (mensaje: string) => void) {
  const [carga, setCarga] = useState<CargaDeRespuestas | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [errorDeCarga, setErrorDeCarga] = useState("");
  const [guardado, setGuardado] = useState<EstadoDeGuardado>("idle");
  const [errorDeGuardado, setErrorDeGuardado] = useState("");
  const [ultimoPaso, setUltimoPaso] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  // Espejo de `grupos` para encadenar cambios sin esperar al siguiente pintado.
  const actuales = useRef<Grupo[]>([]);
  // La pila de deshacer vive en memoria y dura lo que la pregunta en pantalla.
  const pila = useRef<PasoDeHistorial[]>([]);
  const saltarGuardado = useRef(true);
  const reloj = useRef<number | null>(null);
  const decir = useRef(anunciar);
  decir.current = anunciar;

  useEffect(() => {
    let vivo = true;
    setErrorDeCarga("");
    (async () => {
      try {
        const r = await apiCodifRespuestas(parent);
        if (!vivo) return;
        saltarGuardado.current = true;
        const unidos = unirConOpciones(r.grupos ?? [], r.opciones_existentes ?? []);
        actuales.current = unidos;
        setGrupos(unidos);
        pila.current = [];
        setUltimoPaso(null);
        setCarga({ respuestas: r.respuestas, tipo: r.tipo, colEfectiva: r.col_efectiva || parent, smOtros: r.sm_otros ?? null });
        setGuardado("idle");
      } catch (e) {
        if (vivo) setErrorDeCarga((e as Error).message);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [parent, intento]);

  const guardar = useCallback(
    async (lista: Grupo[]) => {
      setGuardado("saving");
      try {
        // Un caso confirmado desde una sugerencia cuya respuesta ya salió del grupo deja de valer (sugerenciasModulo.ts).
        await apiCodifGrupos(parent, podarCasosSugeridos(lista));
        setGuardado("saved");
        setErrorDeGuardado("");
        decir.current("Cambios guardados.");
      } catch (e) {
        setGuardado("error");
        setErrorDeGuardado((e as Error).message);
        decir.current("No se pudo guardar la codificación.");
      }
    },
    [parent],
  );

  // Autoguardado: dos segundos después del último cambio.
  useEffect(() => {
    if (!carga) return undefined;
    if (saltarGuardado.current) {
      saltarGuardado.current = false;
      return undefined;
    }
    setGuardado("dirty");
    if (reloj.current) window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => void guardar(grupos), 2000);
    return () => {
      if (reloj.current) window.clearTimeout(reloj.current);
    };
  }, [grupos, carga, guardar]);

  /**
   * Aplica un cambio a los códigos. Si cambia qué respuestas lleva cada código, o crea o quita alguno,
   * queda en la pila para deshacerlo; un cambio de nombre o de orden no. Devuelve los códigos resultantes.
   */
  const cambiar = useCallback((cambio: (grupos: Grupo[]) => Grupo[], rotulo: string): Grupo[] => {
    const antes = actuales.current;
    const despues = cambio(antes);
    if (despues === antes) return antes;
    const paso = pasoEntre(antes, despues, rotulo);
    if (paso) {
      pila.current = apilarPaso(pila.current, paso);
      setUltimoPaso(paso.rotulo);
    }
    actuales.current = despues;
    setGrupos(despues);
    return despues;
  }, []);

  /** Deshace el último paso. Devuelve `false` si no había ninguno. */
  const deshacer = useCallback((): boolean => {
    const paso = pila.current[pila.current.length - 1];
    if (!paso) return false;
    pila.current = pila.current.slice(0, -1);
    const despues = deshacerPaso(actuales.current, paso);
    actuales.current = despues;
    setGrupos(despues);
    setUltimoPaso(pila.current.length ? pila.current[pila.current.length - 1].rotulo : null);
    decir.current(`Se deshizo: ${paso.rotulo}.`);
    return true;
  }, []);

  return {
    carga,
    grupos,
    errorDeCarga,
    guardado,
    errorDeGuardado,
    /** Lo último que se puede deshacer, para rotular el botón; `null` sin pasos. */
    ultimoPaso,
    cambiar,
    deshacer,
    reintentarCarga: () => setIntento((n) => n + 1),
    reintentarGuardado: () => void guardar(actuales.current),
  };
}
