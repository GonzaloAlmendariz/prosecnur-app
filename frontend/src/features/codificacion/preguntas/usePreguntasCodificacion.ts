// Codificación, Preguntas: los datos de la pestaña y lo que se puede hacer con ellos.
//
// Carga las preguntas de la base activa y expone unir, desunir, cambiar el modo, elegir la opción "Otros",
// incluir o no en codificación y registrar que una pregunta no se categoriza. Las reglas son las de siempre
// (el motor decide; aquí solo se le pide): este archivo las sacó de `PreguntasLanding.tsx` sin cambiarlas.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiCodifDesemparejar,
  apiCodifMarcar,
  apiCodifNoCategorizar,
  apiCodifPareja,
  apiCodifPreguntasAbiertas,
  guessDummyColFromOpciones,
  type PreguntaAbierta,
} from "../../../api/codificacion";
import type { GruposPendientes } from "../GruposTrasDesemparejar";
import type { PairingResult } from "../PairingDialog";
import type { RelationResult } from "../RelationDialog";
import {
  admiteEmparejar,
  armarUnidades,
  columnaEmparejada,
  columnaOtros,
  defaultModoSoForQuickAdopt,
  destinoDeArrastre,
  type ModoSo,
  type Unidad,
} from "./modeloUnidades";
import { useVistaPreguntas } from "./vistaPreguntasStore";

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function usePreguntasCodificacion() {
  const seleccionar = useVistaPreguntas((s) => s.seleccionar);
  const [preguntas, setPreguntas] = useState<PreguntaAbierta[] | null>(null);
  const [errorDeCarga, setErrorDeCarga] = useState("");
  const [errorDeAccion, setErrorDeAccion] = useState("");
  const [gruposPendientes, setGruposPendientes] = useState<GruposPendientes | null>(null);
  /** El `id` de la unidad con un cambio en curso. */
  const [ocupada, setOcupada] = useState("");
  /** La pareja recién formada: su lazo se asienta una vez. */
  const [recienUnida, setRecienUnida] = useState("");
  const [anuncio, setAnuncio] = useState("");
  const [emparejando, setEmparejando] = useState<PreguntaAbierta | null>(null);
  const [relacion, setRelacion] = useState<{ source: PreguntaAbierta; target: PreguntaAbierta } | null>(null);
  const [buscandoPareja, setBuscandoPareja] = useState<PreguntaAbierta | null>(null);

  const recargar = useCallback(async () => {
    const r = await apiCodifPreguntasAbiertas();
    setPreguntas(r.preguntas);
  }, []);

  useEffect(() => {
    recargar().catch((e: unknown) => setErrorDeCarga(mensaje(e)));
  }, [recargar]);

  const unidades = useMemo(() => (preguntas ? armarUnidades(preguntas) : []), [preguntas]);

  /** Con quién se puede emparejar la pregunta que busca pareja: las demás sueltas. */
  const candidatos = useMemo(
    () => (buscandoPareja ? unidades.filter((u) => u.id !== buscandoPareja.parent && admiteEmparejar(u)).map((u) => u.principal) : []),
    [buscandoPareja, unidades],
  );

  function anunciar(texto: string) {
    setAnuncio(texto);
    window.setTimeout(() => setAnuncio(""), 800);
  }

  function marcarUnion(parent: string) {
    seleccionar(parent);
    setRecienUnida(parent);
    window.setTimeout(() => setRecienUnida((actual) => (actual === parent ? "" : actual)), 1000);
  }

  /** Un cambio sobre una unidad: la marca ocupada, corre y deja el error a la vista sin tapar la lista. */
  async function conUnidad(id: string, cambio: () => Promise<void>) {
    setOcupada(id);
    setErrorDeAccion("");
    try {
      await cambio();
    } catch (e) {
      setErrorDeAccion(mensaje(e));
    } finally {
      setOcupada("");
    }
  }

  /** Un texto soltado sobre una cerrada sin pareja: se une de inmediato, con el modo por defecto. */
  function unirDirecto(padre: PreguntaAbierta, columnaTexto: string) {
    return conUnidad(padre.parent, async () => {
      const modo = defaultModoSoForQuickAdopt(padre.tipo);
      const otros =
        padre.tipo === "select_multiple" ? columnaOtros(padre) || guessDummyColFromOpciones(padre.opciones_sm) : undefined;
      await apiCodifPareja(padre.parent, columnaTexto, modo, otros);
      await recargar();
      marcarUnion(padre.parent);
      if (padre.tipo === "select_multiple" && !otros) {
        anunciar(`${columnaTexto} emparejada con ${padre.parent}. Falta indicar cuál opción es "Otros".`);
      } else {
        anunciar(
          `${columnaTexto} conectada con ${padre.parent}${modo === "padre" ? " para codificar la pregunta original" : ""}.`,
        );
      }
    });
  }

  /**
   * Emparejar `origen` con `destino`, por arrastre o desde el selector: las dos vías pasan por aquí y dan
   * lo mismo. El modelo dice si se une de inmediato o si hay que decidir cuál recibe los códigos.
   */
  function soltar(origenId: string, destinoId: string) {
    const origen = unidades.find((u) => u.id === origenId);
    const destino = unidades.find((u) => u.id === destinoId);
    if (!origen || !destino) return;
    const resultado = destinoDeArrastre(origen, destino);
    if (resultado === "directo") {
      void unirDirecto(destino.principal, origen.principal.col_efectiva || origen.principal.parent);
    } else if (resultado === "con-dialogo") {
      setRelacion({ source: origen.principal, target: destino.principal });
    }
  }

  function confirmarEmparejamiento(resultado: PairingResult) {
    const pregunta = emparejando;
    if (!pregunta) return;
    void conUnidad(pregunta.parent, async () => {
      await apiCodifPareja(pregunta.parent, resultado.child_col, resultado.modo_so, resultado.dummy_col);
      setEmparejando(null);
      await recargar();
      marcarUnion(pregunta.parent);
    });
  }

  function confirmarRelacion(r: RelationResult) {
    if (!relacion) return;
    void conUnidad(r.parent, async () => {
      await apiCodifPareja(r.parent, r.child_col, r.modo_so, r.dummy_col);
      setRelacion(null);
      await recargar();
      marcarUnion(r.parent);
      anunciar(`${r.child_col} relacionada con ${r.parent}.`);
    });
  }

  function desemparejar(u: Unidad) {
    // Lo agrupado mientras estuvo emparejada queda sin texto: se pregunta qué hacer con esos grupos.
    const agrupadas = u.principal.n_codificadas ?? 0;
    void conUnidad(u.id, async () => {
      await apiCodifDesemparejar(u.id);
      if (agrupadas > 0) setGruposPendientes({ parent: u.id, n: agrupadas });
      await recargar();
    });
  }

  /** Elegir la opción que ya está elegida la quita. */
  function elegirOpcionOtros(padre: PreguntaAbierta, columna: string) {
    const texto = columnaEmparejada(padre);
    if (!texto) return;
    void conUnidad(padre.parent, async () => {
      const actual = columnaOtros(padre);
      if (actual && actual === columna) {
        await apiCodifPareja(padre.parent, texto, undefined, "", { clear_dummy: true });
        anunciar(`Selección de "Otros" quitada en ${padre.parent}.`);
      } else {
        await apiCodifPareja(padre.parent, texto, undefined, columna);
        anunciar(`Columna "Otros" configurada en ${padre.parent}.`);
      }
      await recargar();
    });
  }

  function elegirModo(padre: PreguntaAbierta, modo: ModoSo) {
    const texto = columnaEmparejada(padre);
    if (padre.tipo !== "select_one" || !texto || padre.modo_so === modo) return;
    void conUnidad(padre.parent, async () => {
      await apiCodifPareja(padre.parent, texto, modo, undefined);
      await recargar();
      anunciar(
        modo === "padre"
          ? `${padre.parent} se codifica como pregunta original en ${padre.parent}_recod.`
          : `${texto} se codifica como texto aparte en ${texto}_recod.`,
      );
    });
  }

  function incluir(parent: string, marcada: boolean) {
    void conUnidad(parent, async () => {
      await apiCodifMarcar(parent, marcada);
      await recargar();
    });
  }

  // ADR 0078: registrar la decisión la cierra sin borrar la intención.
  function noCategorizar(parent: string, motivo: string, revertir?: boolean) {
    void conUnidad(parent, async () => {
      await apiCodifNoCategorizar(parent, motivo, { revertir });
      await recargar();
    });
  }

  function resolverGrupos() {
    setGruposPendientes(null);
    recargar().catch((e: unknown) => setErrorDeAccion(mensaje(e)));
  }

  return {
    preguntas,
    unidades,
    errorDeCarga,
    errorDeAccion,
    descartarError: () => setErrorDeAccion(""),
    gruposPendientes,
    resolverGrupos,
    ocupada,
    recienUnida,
    anuncio,
    soltar,
    desemparejar,
    elegirOpcionOtros,
    elegirModo,
    incluir,
    noCategorizar,
    // Diálogos: una cerrada elige su columna de texto; una abierta, la otra pregunta; y solo cuando la
    // combinación es ambigua se pregunta cuál de las dos recibe los códigos.
    emparejando,
    abrirEmparejar: setEmparejando,
    confirmarEmparejamiento,
    buscandoPareja,
    candidatos,
    abrirBuscarPareja: setBuscandoPareja,
    elegirPareja: (target: PreguntaAbierta) => {
      const origen = buscandoPareja;
      setBuscandoPareja(null);
      if (origen) soltar(origen.parent, target.parent);
    },
    relacion,
    cerrarRelacion: () => setRelacion(null),
    confirmarRelacion,
  };
}
