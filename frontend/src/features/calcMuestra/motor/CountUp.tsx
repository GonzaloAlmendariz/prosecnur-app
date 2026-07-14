/**
 * Contador ascendente (Anexo A.1): anima un número desde su valor previo hasta
 * el objetivo en ~1.4 s con ease-out cúbico, para que el usuario perciba que la
 * cifra es RESULTADO de su acción (construir marco, calcular) y no un dato
 * preexistente. Formatea con separadores de miles y `tabular-nums`. Respeta
 * `prefers-reduced-motion`. `null` → "—" sin animar.
 */
import { useEffect, useRef, useState } from "react";
import { fmtInt } from "../sharedCore";

const DURATION_MS = 1400;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({ value }: { value: number | null }) {
  const [display, setDisplay] = useState<number>(value ?? 0);
  const fromRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) {
      fromRef.current = 0;
      return;
    }
    const target = value;
    const from = fromRef.current;
    if (from === target) {
      setDisplay(target);
      return;
    }
    if (prefersReducedMotion()) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs == null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        rafRef.current = null;
      }
    };
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  if (value == null) return <>—</>;
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtInt(display)}</span>;
}
