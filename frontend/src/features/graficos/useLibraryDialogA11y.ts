import { useCallback, useEffect, useRef, type RefObject } from "react";

type FocusTargetRef = RefObject<HTMLElement>;

type LibraryDialogA11yOptions = {
  searchRef: RefObject<HTMLInputElement>;
  returnFocusRef?: FocusTargetRef | null;
  fallbackFocusRef: FocusTargetRef;
};

const OPEN_MODAL_DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"][data-state="open"]';

export function resolveLibraryReturnFocus(
  previousFocus: HTMLElement | null,
  requestedFocus: HTMLElement | null,
  fallbackFocus: HTMLElement | null,
): HTMLElement | null {
  if (previousFocus?.isConnected) return previousFocus;
  if (requestedFocus?.isConnected) return requestedFocus;
  if (fallbackFocus?.isConnected) return fallbackFocus;
  return null;
}

export function useLibraryDialogA11y({
  searchRef,
  returnFocusRef,
  fallbackFocusRef,
}: LibraryDialogA11yOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const capturedReturnFocusRef = useRef<FocusTargetRef | null>(null);
  const autofocusFrameRef = useRef<number | null>(null);
  const returnFrameRef = useRef<number | null>(null);
  const openCycleRef = useRef(0);
  const returnedCycleRef = useRef(-1);

  const cancelAutofocus = useCallback(() => {
    if (autofocusFrameRef.current === null) return;
    cancelAnimationFrame(autofocusFrameRef.current);
    autofocusFrameRef.current = null;
  }, []);

  const cancelReturn = useCallback(() => {
    if (returnFrameRef.current === null) return;
    cancelAnimationFrame(returnFrameRef.current);
    returnFrameRef.current = null;
  }, []);

  useEffect(() => () => {
    cancelAutofocus();
    cancelReturn();
    previousFocusRef.current = null;
    capturedReturnFocusRef.current = null;
  }, [cancelAutofocus, cancelReturn]);

  const onOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    cancelAutofocus();
    cancelReturn();
    openCycleRef.current += 1;
    capturedReturnFocusRef.current = returnFocusRef ?? null;

    const activeElement = document.activeElement;
    previousFocusRef.current = activeElement instanceof HTMLElement
      && activeElement !== document.body
      && activeElement !== document.documentElement
      ? activeElement
      : null;

    autofocusFrameRef.current = requestAnimationFrame(() => {
      autofocusFrameRef.current = null;
      searchRef.current?.focus({ preventScroll: true });
    });
  }, [cancelAutofocus, cancelReturn, returnFocusRef, searchRef]);

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    cancelAutofocus();
    cancelReturn();
    const closingCycle = openCycleRef.current;

    returnFrameRef.current = requestAnimationFrame(() => {
      returnFrameRef.current = null;
      if (
        closingCycle !== openCycleRef.current
        || returnedCycleRef.current === closingCycle
      ) return;

      returnedCycleRef.current = closingCycle;
      if (document.querySelector(OPEN_MODAL_DIALOG_SELECTOR)) {
        previousFocusRef.current = null;
        capturedReturnFocusRef.current = null;
        return;
      }

      const returnTarget = resolveLibraryReturnFocus(
        previousFocusRef.current,
        capturedReturnFocusRef.current?.current ?? null,
        fallbackFocusRef.current,
      );
      previousFocusRef.current = null;
      capturedReturnFocusRef.current = null;
      returnTarget?.focus({ preventScroll: true });
    });
  }, [cancelAutofocus, cancelReturn, fallbackFocusRef]);

  return { onOpenAutoFocus, onCloseAutoFocus };
}
