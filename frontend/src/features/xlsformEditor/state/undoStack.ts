// =============================================================================
// state/undoStack.ts — pila de historia para undo/redo
// =============================================================================
// Estructura inmutable que mantiene una secuencia de snapshots `T` con un
// índice "current". Cada `push` corta el redo (todo lo que estaba después del
// índice actual se descarta) y empuja el nuevo snapshot al final.
//
// Diseño:
//   - Inmutable: cada operación devuelve un nuevo `UndoStack`.
//   - Capacidad fija (default 50): los snapshots más antiguos se descartan
//     cuando se supera. Importante: el índice `current` se decrementa para
//     compensar.
//   - No copia los snapshots: los maneja por referencia. El caller es
//     responsable de pasar instancias inmutables (los mutadores del editor
//     usan `cloneWorkbook` antes de mutar, así que cada workbook ya es nuevo).
//
// Ejemplo:
//   let stack = createUndoStack<Workbook>(initial);
//   stack = pushUndoStack(stack, edited1);
//   stack = pushUndoStack(stack, edited2);
//   stack = undoUndoStack(stack);  // current → edited1
//   stack = redoUndoStack(stack);  // current → edited2
// =============================================================================

export type UndoStack<T> = {
  /** Snapshots ordenados cronológicamente (entries[0] es el más antiguo). */
  entries: T[];
  /** Índice del snapshot actual dentro de `entries`. -1 si está vacío. */
  current: number;
  /** Capacidad máxima (default 50). */
  capacity: number;
};

const DEFAULT_CAPACITY = 50;

/** Crea un stack inicial con un snapshot. */
export function createUndoStack<T>(initial: T, capacity = DEFAULT_CAPACITY): UndoStack<T> {
  return { entries: [initial], current: 0, capacity: Math.max(1, capacity) };
}

/** Crea un stack vacío. `current` queda en -1 hasta el primer push. */
export function emptyUndoStack<T>(capacity = DEFAULT_CAPACITY): UndoStack<T> {
  return { entries: [], current: -1, capacity: Math.max(1, capacity) };
}

/**
 * Empuja un snapshot. Trunca cualquier redo pendiente (los índices >
 * `current` se descartan) y respeta la capacidad.
 */
export function pushUndoStack<T>(stack: UndoStack<T>, snapshot: T): UndoStack<T> {
  const truncated = stack.entries.slice(0, stack.current + 1);
  truncated.push(snapshot);
  let trimmed = truncated;
  let nextCurrent = truncated.length - 1;
  if (truncated.length > stack.capacity) {
    const overflow = truncated.length - stack.capacity;
    trimmed = truncated.slice(overflow);
    nextCurrent = trimmed.length - 1;
  }
  return { entries: trimmed, current: nextCurrent, capacity: stack.capacity };
}

/**
 * Reemplaza el snapshot actual sin crear historial nuevo. Útil para
 * "load" inicial donde queremos resetear todo.
 */
export function replaceUndoStack<T>(stack: UndoStack<T>, snapshot: T): UndoStack<T> {
  if (stack.current < 0) return createUndoStack(snapshot, stack.capacity);
  const next = stack.entries.slice();
  next[stack.current] = snapshot;
  return { ...stack, entries: next };
}

/** Descarta toda la historia y reinicia con un snapshot. */
export function resetUndoStack<T>(snapshot: T, capacity?: number): UndoStack<T> {
  return createUndoStack(snapshot, capacity ?? DEFAULT_CAPACITY);
}

/** ¿Hay un paso anterior al actual? */
export function canUndoUndoStack<T>(stack: UndoStack<T>): boolean {
  return stack.current > 0;
}

/** ¿Hay un paso posterior (redo) al actual? */
export function canRedoUndoStack<T>(stack: UndoStack<T>): boolean {
  return stack.current >= 0 && stack.current < stack.entries.length - 1;
}

/** Mueve el índice un paso atrás. Si no se puede, devuelve el stack tal cual. */
export function undoUndoStack<T>(stack: UndoStack<T>): UndoStack<T> {
  if (!canUndoUndoStack(stack)) return stack;
  return { ...stack, current: stack.current - 1 };
}

/** Mueve el índice un paso adelante. */
export function redoUndoStack<T>(stack: UndoStack<T>): UndoStack<T> {
  if (!canRedoUndoStack(stack)) return stack;
  return { ...stack, current: stack.current + 1 };
}

/** Snapshot actual (o null si está vacío). */
export function currentUndoStack<T>(stack: UndoStack<T>): T | null {
  if (stack.current < 0) return null;
  return stack.entries[stack.current] ?? null;
}
