// Host de fondo de "antes de cada envío" (Correo > Seguimiento > Quién respondió).
// Vive en el Layout para seguir latiendo en cualquier módulo mientras haya un
// proyecto abierto; no pinta nada. En modo público no existe.

import { useEffect } from "react";

import { useSession } from "../../../lib/SessionContext";
import { isPublicMode } from "../../../lib/runtime";
import { useOptionalProjectShell } from "../../project/ProjectShell";
import { useSeguimientoStore } from "./store";
import { useAntesDeCadaEnvio } from "./useAntesDeCadaEnvio";

export function AntesDeCadaEnvioHost() {
  const { sessionId } = useSession();
  const proyecto = useOptionalProjectShell();
  const habilitado = !isPublicMode() && proyecto !== null;

  useEffect(() => {
    const alCambiar = () => useSeguimientoStore.getState().reset();
    window.addEventListener("pulso:session-changed", alCambiar);
    return () => window.removeEventListener("pulso:session-changed", alCambiar);
  }, []);

  useAntesDeCadaEnvio({ habilitado, sesion: sessionId });
  return null;
}
