// Una lectura del backend que depende de lo que cambia su resultado: la base
// activa, la fuente, el universo de análisis y, para la vista previa, la
// config guardada. Cuando la `clave` cambia, la lectura se repite y lo que
// había deja de presentarse como vigente. Con la clave en `null` no se pide
// nada: se espera (por ejemplo, a que la config termine de guardarse).
//
// Tres fases: leyendo, lista y error. Mientras se relee, `datos` conserva lo
// último que llegó para que la vista lo atenúe en vez de vaciarse. Una
// respuesta que llega tarde, de una clave que ya no es la vigente, se descarta.

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../api/core";
import { splitErrorDetail } from "../../../components/errorPresentation";

export type Lectura<T> = {
  fase: "leyendo" | "lista" | "error";
  /** Lo último leído. Con `fase: "leyendo"` puede ser de una lectura anterior. */
  datos: T | null;
  /** Por qué falló, tal como lo dijo el backend y sin su código. */
  causa: string;
  /** El código del error del backend (`E_*`); vacío si no lo hay. */
  codigo: string;
  reintentar: () => void;
};

type Estado<T> = {
  /** A qué pedido corresponde `fase`: la clave y el número de intento. */
  pedido: string;
  fase: "leyendo" | "lista" | "error";
  datos: T | null;
  causa: string;
  codigo: string;
};

function causaDe(e: unknown): { causa: string; codigo: string } {
  const mensaje = e instanceof Error ? e.message : String(e);
  if (e instanceof ApiError) return { causa: splitErrorDetail(mensaje).message, codigo: e.code };
  return { causa: mensaje, codigo: "" };
}

export function useLecturaPorBase<T>(pedir: () => Promise<T>, clave: string | null): Lectura<T> {
  const [intento, setIntento] = useState(0);
  const pedido = clave === null ? null : `${clave}#${intento}`;
  const [estado, setEstado] = useState<Estado<T>>({ pedido: pedido ?? "", fase: "leyendo", datos: null, causa: "", codigo: "" });
  // La función puede cambiar de identidad en cada pintado: solo cuenta la última.
  const pedirVigente = useRef(pedir);
  pedirVigente.current = pedir;

  useEffect(() => {
    if (pedido === null) return undefined;
    let vigente = true;
    setEstado((previo) => ({ pedido, fase: "leyendo", datos: previo.datos, causa: "", codigo: "" }));
    pedirVigente.current().then(
      (datos) => {
        if (vigente) setEstado({ pedido, fase: "lista", datos, causa: "", codigo: "" });
      },
      (e: unknown) => {
        if (vigente) setEstado({ pedido, fase: "error", datos: null, ...causaDe(e) });
      },
    );
    return () => {
      vigente = false;
    };
  }, [pedido]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  // En el pintado en que cambia la clave el estado todavía es del pedido
  // anterior: se presenta como lectura en curso, no como resultado vigente.
  const alDia = pedido !== null && estado.pedido === pedido;
  return {
    fase: alDia ? estado.fase : "leyendo",
    datos: estado.datos,
    causa: alDia ? estado.causa : "",
    codigo: alDia ? estado.codigo : "",
    reintentar,
  };
}
