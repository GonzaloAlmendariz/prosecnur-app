// =============================================================================
// shell/useActivePublicationRefresh.ts — la publicación del formulario abierto
// se refresca al aterrizar y tras guardar
// =============================================================================
// U10 (QA final): tras «Crear borrador» desde el import, la cabecera decía «Sin
// avisos» mientras la tarjeta del mismo formulario decía «Revisa la lógica». La
// `publication` sólo se recargaba al volver a la biblioteca, así que el editor
// leía un índice previo al formulario recién creado (o previo a la última
// edición, que cambia el hash del borrador).
//
// Mismo mecanismo que usa la biblioteca: `refreshBackendFormIndex`. Se dispara
// al cambiar de formulario activo (crear, importar, activar) y cada vez que el
// autosave sella (`lastSavedAt`), con una espera corta para que el sync al
// backend del autosave llegue antes que la lectura.
// =============================================================================

import { useEffect, useRef } from "react";

export const PUBLICATION_REFRESH_DELAY_MS = 1200;

export function useActivePublicationRefresh(
  activeFormId: string | null,
  lastSavedAt: number | null,
  refresh: () => Promise<unknown>,
): void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!activeFormId) return undefined;
    const timer = window.setTimeout(() => {
      void refreshRef.current().catch(() => undefined);
    }, PUBLICATION_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeFormId, lastSavedAt]);
}
