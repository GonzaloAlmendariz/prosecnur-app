// La estructura del formulario que muestra la pestaña Formulario (ADR 0142),
// fuera de CargaPage. Dos piezas porque la página necesita el estado antes de
// saber si el estudio es de varias bases (el modelo de la página lo usa para
// decidir si hay formulario), y las lecturas después.

import { useEffect, useState } from "react";
import { apiInstrumentoEstructura, type EstudioPayload, type Pregunta, type Seccion } from "../../../api/client";
import { defaultEsquemaBase } from "../esquemaBaseModel";

export type EstructuraDeFormulario = { secciones: Seccion[]; preguntas: Pregunta[] };

export function useEstructuraDeBase() {
  const [estructura, setEstructura] = useState<EstructuraDeFormulario | null>(null);
  // Base cuyo esquema se muestra con varias bases (madre o hija). Con una base
  // queda vacío y la estructura viene del formulario único.
  const [esquemaBase, setEsquemaBase] = useState<string>("");
  return { estructura, setEstructura, esquemaBase, setEsquemaBase };
}

export type EstadoEstructuraDeBase = ReturnType<typeof useEstructuraDeBase>;

/**
 * Lee la estructura: con una base, la del formulario único en cuanto se
 * parsea; con varias, la de la base elegida, que por omisión es la que mejor
 * muestra el grupo repetido (la madre de una base hija).
 */
export function useLecturaDeEstructura(
  { estructura, setEstructura, esquemaBase, setEsquemaBase }: EstadoEstructuraDeBase,
  {
    esVarias,
    instrumentoParseado,
    estudio,
    firmaDeBases,
    onError,
  }: {
    esVarias: boolean;
    instrumentoParseado: boolean;
    estudio: EstudioPayload | null;
    firmaDeBases: string;
    onError: (mensaje: string) => void;
  },
) {
  useEffect(() => {
    if (esVarias) return;
    if (instrumentoParseado && !estructura) {
      apiInstrumentoEstructura().then(setEstructura).catch((e) => onError((e as Error).message));
    }
  }, [esVarias, instrumentoParseado, estructura]);

  useEffect(() => {
    if (!esVarias || !estudio) return;
    const nombres = new Set(Object.keys(estudio.bases));
    setEsquemaBase((actual) => (actual && nombres.has(actual) ? actual : defaultEsquemaBase(estudio.bases, estudio.active_base)));
  }, [esVarias, firmaDeBases, estudio?.active_base]);

  // Vuelve a leer cuando se alterna madre e hija en el selector.
  useEffect(() => {
    if (!esVarias || !esquemaBase) return;
    let cancelada = false;
    apiInstrumentoEstructura(esquemaBase)
      .then((r) => { if (!cancelada) setEstructura(r); })
      .catch((e) => { if (!cancelada) onError((e as Error).message); });
    return () => { cancelada = true; };
  }, [esVarias, esquemaBase]);
}
