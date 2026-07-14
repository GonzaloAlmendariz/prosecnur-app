import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  apiPlanTrabajoTaskCreate,
  apiPlanTrabajoTaskDelete,
  apiPlanTrabajoTaskUpdate,
  type PlanTrabajoState,
  type PlanTrabajoTask,
  type PlanTrabajoTaskKind,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { GlidingTabList } from "../../components/GlidingTabList";
import {
  DAY_MS,
  formatMinutes,
  kindLabel,
  parseLocalDate,
  parseTimeMinutes,
  toISODate,
} from "./dateUtils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const KIND_OPTIONS: PlanTrabajoTaskKind[] = ["activity", "milestone", "deliverable", "fieldwork_window"];
const CAT_CLASS: Record<PlanTrabajoTaskKind, string> = {
  activity: "activity",
  milestone: "milestone",
  deliverable: "deliverable",
  fieldwork_window: "fieldwork",
};

// Rango horario visible en la vista Semana.
const DAY_START = 6;
const DAY_END = 22;
const HOUR_PX = 46;
const SNAP_MIN = 15;
const DEFAULT_DURATION_MIN = 60;

type CalEvent = {
  task: PlanTrabajoTask;
  start: Date;
  end: Date;
  allDay: boolean;
  startMin?: number;
  endMin?: number;
};

type ModalState =
  | { mode: "create"; date: string; time?: string; kind?: PlanTrabajoTaskKind }
  | { mode: "edit"; task: PlanTrabajoTask }
  | null;

type DragState = {
  task: PlanTrabajoTask;
  durationDays: number;
  durationMin: number | null;
  x: number;
  y: number;
  moved: boolean;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}
function sameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}
function weekStartOf(date: Date): Date {
  return addDays(startOfDay(date), -mondayIndex(date));
}

function buildEvents(tasks: PlanTrabajoTask[]): { events: CalEvent[]; undated: PlanTrabajoTask[] } {
  const events: CalEvent[] = [];
  const undated: PlanTrabajoTask[] = [];
  for (const task of tasks) {
    const start = parseLocalDate(task.start_date);
    if (!start) {
      undated.push(task);
      continue;
    }
    const rawEnd = parseLocalDate(task.end_date) ?? start;
    const end = startOfDay(rawEnd < start ? start : rawEnd);
    const sameDay = dayDiff(end, start) === 0;
    const startMin = parseTimeMinutes(task.start_time);
    if (sameDay && startMin != null) {
      const rawEndMin = parseTimeMinutes(task.end_time);
      const endMin = rawEndMin != null && rawEndMin > startMin ? rawEndMin : startMin + DEFAULT_DURATION_MIN;
      events.push({ task, start: startOfDay(start), end, allDay: false, startMin, endMin });
    } else {
      events.push({ task, start: startOfDay(start), end, allDay: true });
    }
  }
  return { events, undated };
}

export function Calendar({
  state,
  onChange,
}: {
  state: PlanTrabajoState;
  onChange: (next: PlanTrabajoState) => void;
}) {
  const tasks = state.plan.tasks ?? [];
  const { events, undated } = useMemo(() => buildEvents(tasks), [tasks]);

  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(() => {
    if (events.length) {
      const earliest = events.reduce((min, ev) => (ev.start < min ? ev.start : min), events[0].start);
      return startOfDay(earliest);
    }
    return startOfDay(new Date());
  });
  const [modal, setModal] = useState<ModalState>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const timeGridRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  const stateRef = useRef(state);
  viewRef.current = view;
  stateRef.current = state;

  const todayIso = toISODate(new Date());
  const title = view === "month"
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : weekRangeLabel(weekStartOf(cursor));

  function shift(delta: number) {
    setCursor((prev) => (view === "month"
      ? new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      : addDays(prev, delta * 7)));
  }
  function goToday() {
    setCursor(startOfDay(new Date()));
  }

  async function persist(fn: () => Promise<PlanTrabajoState>) {
    setError(null);
    try {
      onChange(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el cronograma.");
    }
  }

  async function seedSample() {
    setSeeding(true);
    setError(null);
    const base = startOfDay(new Date());
    const d = (offset: number) => toISODate(addDays(base, offset));
    const samples = [
      { activity: "Reunión de kickoff", kind: "milestone" as const, start_date: d(0), end_date: d(0), start_time: "09:00", end_time: "10:00" },
      { activity: "Deep work: diseño del tablero", kind: "activity" as const, start_date: d(1), end_date: d(1), start_time: "15:00", end_time: "18:00" },
      { activity: "Codificación de abiertas", kind: "activity" as const, start_date: d(2), end_date: d(2), start_time: "10:00", end_time: "13:00" },
      { activity: "Trabajo de campo piloto", kind: "fieldwork_window" as const, start_date: d(2), end_date: d(4) },
      { activity: "Entrega informe preliminar", kind: "deliverable" as const, start_date: d(3), end_date: d(3), start_time: "12:00", end_time: "13:00" },
      { activity: "Análisis de datos", kind: "activity" as const, start_date: d(4), end_date: d(4), start_time: "09:30", end_time: "12:30" },
    ];
    try {
      let next = stateRef.current;
      for (const sample of samples) {
        next = await apiPlanTrabajoTaskCreate(sample);
      }
      onChange(next);
      setCursor(base);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el ejemplo.");
    } finally {
      setSeeding(false);
    }
  }

  // --- Drag para reprogramar --------------------------------------------
  function beginDrag(task: PlanTrabajoTask, event: ReactPointerEvent) {
    if (event.button !== 0) return;
    const start = parseLocalDate(task.start_date);
    const end = parseLocalDate(task.end_date) ?? start;
    const durationDays = start && end ? Math.max(0, dayDiff(end, start)) : 0;
    const sMin = parseTimeMinutes(task.start_time);
    const eMin = parseTimeMinutes(task.end_time);
    const durationMin = sMin != null ? (eMin != null && eMin > sMin ? eMin - sMin : DEFAULT_DURATION_MIN) : null;
    setDrag({ task, durationDays, durationMin, x: event.clientX, y: event.clientY, moved: false });
  }

  const dragResolveRef = useRef<DragState | null>(null);
  dragResolveRef.current = drag;

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      setDrag((prev) => {
        if (!prev) return prev;
        const moved = prev.moved || Math.abs(e.clientX - prev.x) > 5 || Math.abs(e.clientY - prev.y) > 5;
        return { ...prev, x: e.clientX, y: e.clientY, moved };
      });
    }
    function onUp(e: PointerEvent) {
      const current = dragResolveRef.current;
      setDrag(null);
      if (!current) return;
      if (!current.moved) {
        setModal({ mode: "edit", task: current.task });
        return;
      }
      resolveDrop(current, e.clientX, e.clientY);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  function resolveDrop(current: DragState, x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const timedCol = el.closest<HTMLElement>("[data-daycol]");
    if (viewRef.current === "week" && timedCol && current.durationMin != null) {
      const iso = timedCol.getAttribute("data-daycol") ?? "";
      const grid = timeGridRef.current;
      if (iso && grid) {
        const rect = grid.getBoundingClientRect();
        let minutes = DAY_START * 60 + ((y - rect.top) / HOUR_PX) * 60;
        minutes = Math.round(minutes / SNAP_MIN) * SNAP_MIN;
        minutes = Math.max(DAY_START * 60, Math.min(DAY_END * 60 - SNAP_MIN, minutes));
        void persist(() => apiPlanTrabajoTaskUpdate(current.task.id, {
          start_date: iso,
          end_date: iso,
          start_time: formatMinutes(minutes),
          end_time: formatMinutes(minutes + (current.durationMin ?? DEFAULT_DURATION_MIN)),
        }));
      }
      return;
    }
    const dayCell = el.closest<HTMLElement>("[data-day], [data-allday]");
    if (dayCell) {
      const iso = dayCell.getAttribute("data-day") ?? dayCell.getAttribute("data-allday") ?? "";
      const target = parseLocalDate(iso);
      if (target) {
        void persist(() => apiPlanTrabajoTaskUpdate(current.task.id, {
          start_date: iso,
          end_date: toISODate(addDays(target, current.durationDays)),
        }));
      }
    }
  }

  const dragging = drag?.moved ? drag : null;

  if (tasks.length === 0) {
    return (
      <div className="bcal">
        <CalendarToolbar
          view={view}
          onView={setView}
          title={title}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          onToday={goToday}
          onCreate={() => setModal({ mode: "create", date: todayIso })}
        />
        <div className="bcal-empty">
          <span className="bcal-empty-icon" aria-hidden="true"><CalendarDays size={26} /></span>
          <strong>Tu calendario está vacío</strong>
          <p>Crea actividades, hitos y entregables, o carga un cronograma de ejemplo para ver el calendario en acción.</p>
          <div className="bcal-empty-actions">
            <button type="button" className="plan-button plan-button--primary" onClick={() => setModal({ mode: "create", date: todayIso })}>
              <Plus size={15} /> <span>Nueva actividad</span>
            </button>
            <button type="button" className="plan-button" onClick={seedSample} disabled={seeding}>
              {seeding ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              <span>Cargar ejemplo</span>
            </button>
          </div>
        </div>
        {modal && (
          <EventModal modal={modal} onClose={() => setModal(null)} onChange={(next) => { onChange(next); setModal(null); }} />
        )}
      </div>
    );
  }

  return (
    <div className="bcal">
      <CalendarToolbar
        view={view}
        onView={setView}
        title={title}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={goToday}
        onCreate={() => setModal({ mode: "create", date: todayIso })}
      />

      <div className="bcal-legend" aria-hidden="true">
        {KIND_OPTIONS.map((kind) => (
          <span className="bcal-legend-item" key={kind}>
            <span className={`bcal-swatch is-${CAT_CLASS[kind]}`} />
            {kindLabel(kind)}
          </span>
        ))}
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {view === "month" ? (
        <MonthView
          cursor={cursor}
          events={events}
          todayIso={todayIso}
          draggingId={dragging?.task.id ?? null}
          onCreate={(iso) => setModal({ mode: "create", date: iso })}
          onEventPointerDown={beginDrag}
        />
      ) : (
        <WeekView
          cursor={cursor}
          events={events}
          todayIso={todayIso}
          draggingId={dragging?.task.id ?? null}
          timeGridRef={timeGridRef}
          onCreateAt={(iso, time) => setModal({ mode: "create", date: iso, time })}
          onEventPointerDown={beginDrag}
        />
      )}

      {undated.length > 0 && (
        <div className="bcal-tray">
          <div className="bcal-tray-head"><strong>Sin fecha</strong><span>{undated.length}</span></div>
          <div className="bcal-tray-list">
            {undated.map((task) => (
              <button
                key={task.id}
                type="button"
                className={`bcal-tray-item is-${task.status}`}
                onClick={() => setModal({ mode: "edit", task })}
                title="Asignar fecha"
              >
                <span>{kindLabel(task.kind)}</span>
                <strong>{task.activity}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {dragging && (
        <div className="bcal-drag-ghost" style={{ left: dragging.x + 12, top: dragging.y + 12 } as CSSProperties}>
          <span className={`bcal-dot is-${CAT_CLASS[dragging.task.kind]}`} />
          {dragging.task.activity}
        </div>
      )}

      {modal && (
        <EventModal modal={modal} onClose={() => setModal(null)} onChange={(next) => { onChange(next); setModal(null); }} />
      )}
    </div>
  );
}

function CalendarToolbar({
  view, onView, title, onPrev, onNext, onToday, onCreate,
}: {
  view: "month" | "week";
  onView: (v: "month" | "week") => void;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="bcal-toolbar">
      <div className="bcal-nav">
        <button type="button" className="plan-icon-button" onClick={onPrev} aria-label="Anterior"><ChevronLeft size={16} /></button>
        <button type="button" className="plan-icon-button" onClick={onNext} aria-label="Siguiente"><ChevronRight size={16} /></button>
        <button type="button" className="plan-button" onClick={onToday}>Hoy</button>
        <strong className="bcal-title">{title}</strong>
      </div>
      <div className="bcal-toolbar-right">
        <GlidingTabList activeKey={view} className="bcal-segmented" role="tablist" aria-label="Vista del calendario">
          <button type="button" role="tab" data-gliding-key="month" aria-selected={view === "month"} className={view === "month" ? "is-active" : ""} onClick={() => onView("month")}>Mes</button>
          <button type="button" role="tab" data-gliding-key="week" aria-selected={view === "week"} className={view === "week" ? "is-active" : ""} onClick={() => onView("week")}>Semana</button>
        </GlidingTabList>
        <button type="button" className="plan-button plan-button--primary" onClick={onCreate}>
          <Plus size={15} /> <span>Nueva actividad</span>
        </button>
      </div>
    </div>
  );
}

// --- Vista Mes --------------------------------------------------------------
type PlacedMonth = CalEvent & { startCol: number; span: number; lane: number };

function packWeek(events: CalEvent[], weekStart: Date): PlacedMonth[] {
  const weekEnd = addDays(weekStart, 6);
  const overlapping = events
    .filter((ev) => ev.end >= weekStart && ev.start <= weekEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const lanes: number[] = [];
  const placed: PlacedMonth[] = [];
  for (const ev of overlapping) {
    const startCol = Math.max(0, dayDiff(ev.start, weekStart));
    const endCol = Math.min(6, dayDiff(ev.end, weekStart));
    const span = Math.max(1, endCol - startCol + 1);
    let lane = lanes.findIndex((last) => startCol > last);
    if (lane === -1) { lane = lanes.length; lanes.push(endCol); } else { lanes[lane] = endCol; }
    placed.push({ ...ev, startCol, span, lane });
  }
  return placed;
}

const MONTH_MAX_LANES = 3;

function MonthView({
  cursor, events, todayIso, draggingId, onCreate, onEventPointerDown,
}: {
  cursor: Date;
  events: CalEvent[];
  todayIso: string;
  draggingId: string | null;
  onCreate: (iso: string) => void;
  onEventPointerDown: (task: PlanTrabajoTask, e: ReactPointerEvent) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(first, -mondayIndex(first));
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const days: Date[] = [];
    for (let d = 0; d < 7; d += 1) days.push(addDays(gridStart, w * 7 + d));
    weeks.push(days);
  }

  return (
    <div className="bcal-grid">
      <div className="bcal-weekhead">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
      {weeks.map((week, wi) => {
        const placed = packWeek(events, startOfDay(week[0]));
        const shown = placed.filter((p) => p.lane < MONTH_MAX_LANES);
        const laneCount = Math.min(MONTH_MAX_LANES, placed.reduce((m, p) => Math.max(m, p.lane + 1), 0));
        return (
          <div className="bcal-week" key={wi} style={{ minHeight: 34 + laneCount * 24 + 20 }}>
            <div className="bcal-daygrid">
              {week.map((day) => {
                const iso = toISODate(day);
                const overflow = placed.filter((p) => p.lane >= MONTH_MAX_LANES && dayDiff(day, p.start) >= 0 && dayDiff(p.end, day) >= 0).length;
                return (
                  <button
                    type="button"
                    key={iso}
                    data-day={iso}
                    className={`bcal-day${sameMonth(day, cursor.getFullYear(), cursor.getMonth()) ? "" : " is-out"}${iso === todayIso ? " is-today" : ""}`}
                    onClick={() => onCreate(iso)}
                    aria-label={`Crear el ${iso}`}
                  >
                    <span className="bcal-daynum">{day.getDate()}</span>
                    {overflow > 0 && <span className="bcal-more">+{overflow}</span>}
                  </button>
                );
              })}
            </div>
            <div className="bcal-events">
              {shown.map((p) => (
                <EventChip
                  key={`${p.task.id}-${wi}`}
                  event={p}
                  dragging={draggingId === p.task.id}
                  style={{
                    left: `calc(${(p.startCol / 7) * 100}% + 3px)`,
                    width: `calc(${(p.span / 7) * 100}% - 6px)`,
                    top: 30 + p.lane * 24,
                  }}
                  onPointerDown={(e) => onEventPointerDown(p.task, e)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventChip({
  event, style, dragging, onPointerDown,
}: {
  event: CalEvent;
  style: CSSProperties;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const { task } = event;
  const timeLabel = event.startMin != null ? formatMinutes(event.startMin) : "";
  return (
    <button
      type="button"
      className={`bcal-event is-${CAT_CLASS[task.kind]} status-${task.status}${dragging ? " is-dragging" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      title={`${task.activity} · ${kindLabel(task.kind)}`}
    >
      {task.kind === "milestone" && <span className="bcal-event-diamond" aria-hidden="true" />}
      {timeLabel && <span className="bcal-event-time">{timeLabel}</span>}
      <span className="bcal-event-label">{task.activity}</span>
    </button>
  );
}

// --- Vista Semana -----------------------------------------------------------
function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameM = weekStart.getMonth() === end.getMonth();
  if (sameM) return `${weekStart.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

type PlacedTimed = { ev: CalEvent; startMin: number; endMin: number; colIndex: number; colCount: number };

function packDayColumns(evs: CalEvent[]): PlacedTimed[] {
  const items = evs
    .filter((e) => e.startMin != null && e.endMin != null)
    .map((e) => ({ ev: e, startMin: e.startMin as number, endMin: e.endMin as number, colIndex: 0, colCount: 1 }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const result: PlacedTimed[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols: number[] = [];
    for (const it of cluster) {
      let placed = false;
      for (let c = 0; c < cols.length; c += 1) {
        if (cols[c] <= it.startMin) { cols[c] = it.endMin; it.colIndex = c; placed = true; break; }
      }
      if (!placed) { it.colIndex = cols.length; cols.push(it.endMin); }
    }
    const colCount = Math.max(1, cols.length);
    for (const it of cluster) result.push({ ...it, colCount });
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return result;
}

function WeekView({
  cursor, events, todayIso, draggingId, timeGridRef, onCreateAt, onEventPointerDown,
}: {
  cursor: Date;
  events: CalEvent[];
  todayIso: string;
  draggingId: string | null;
  timeGridRef: MutableRefObject<HTMLDivElement | null>;
  onCreateAt: (iso: string, time?: string) => void;
  onEventPointerDown: (task: PlanTrabajoTask, e: ReactPointerEvent) => void;
}) {
  const weekStart = weekStartOf(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const weekEnd = addDays(weekStart, 6);
  const allDay = events.filter((e) => e.allDay && e.end >= weekStart && e.start <= weekEnd);

  function slotTime(clientY: number): string {
    const grid = timeGridRef.current;
    if (!grid) return `${String(DAY_START).padStart(2, "0")}:00`;
    const rect = grid.getBoundingClientRect();
    let minutes = DAY_START * 60 + ((clientY - rect.top) / HOUR_PX) * 60;
    minutes = Math.round(minutes / SNAP_MIN) * SNAP_MIN;
    minutes = Math.max(DAY_START * 60, Math.min(DAY_END * 60 - SNAP_MIN, minutes));
    return formatMinutes(minutes);
  }

  return (
    <div className="bcal-week-view">
      <div className="bcal-week-head">
        <span className="bcal-week-gutter" />
        {days.map((day) => {
          const iso = toISODate(day);
          return (
            <div key={iso} className={`bcal-week-day${iso === todayIso ? " is-today" : ""}`}>
              <span className="bcal-week-dow">{WEEKDAYS[mondayIndex(day)]}</span>
              <span className="bcal-week-date">{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="bcal-allday-row">
        {/* El gutter mide 58px: "Todo el día" no cabe sin desbordar sobre
            la primera hora del time-grid. */}
        <span className="bcal-week-gutter bcal-allday-label" title="Todo el día">Día</span>
        {days.map((day) => {
          const iso = toISODate(day);
          const here = allDay.filter((e) => dayDiff(day, e.start) >= 0 && dayDiff(e.end, day) >= 0);
          return (
            <div key={iso} className="bcal-allday-cell" data-allday={iso}>
              {here.slice(0, 3).map((e) => (
                <button
                  key={e.task.id}
                  type="button"
                  className={`bcal-allday-chip is-${CAT_CLASS[e.task.kind]} status-${e.task.status}${draggingId === e.task.id ? " is-dragging" : ""}`}
                  onPointerDown={(ev) => onEventPointerDown(e.task, ev)}
                  title={e.task.activity}
                >
                  {e.task.activity}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="bcal-timegrid" ref={timeGridRef}>
        <div className="bcal-hours">
          {hours.map((h) => (
            <div className="bcal-hour" key={h} style={{ height: HOUR_PX }}>
              <span>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        {days.map((day) => {
          const iso = toISODate(day);
          const dayEvents = events.filter((e) => !e.allDay && dayDiff(day, e.start) === 0);
          const placed = packDayColumns(dayEvents);
          return (
            <div
              key={iso}
              className={`bcal-daycol${iso === todayIso ? " is-today" : ""}`}
              data-daycol={iso}
              style={{ height: hours.length * HOUR_PX }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest(".bcal-timed")) return;
                onCreateAt(iso, slotTime(e.clientY));
              }}
            >
              {hours.map((h) => <div className="bcal-slot" key={h} style={{ height: HOUR_PX }} />)}
              {placed.map((p) => {
                const top = ((p.startMin - DAY_START * 60) / 60) * HOUR_PX;
                const height = Math.max(20, ((p.endMin - p.startMin) / 60) * HOUR_PX - 2);
                const width = 100 / p.colCount;
                return (
                  <button
                    key={p.ev.task.id}
                    type="button"
                    className={`bcal-timed is-${CAT_CLASS[p.ev.task.kind]} status-${p.ev.task.status}${draggingId === p.ev.task.id ? " is-dragging" : ""}`}
                    style={{ top, height, left: `${p.colIndex * width}%`, width: `calc(${width}% - 3px)` }}
                    onPointerDown={(ev) => onEventPointerDown(p.ev.task, ev)}
                    title={`${p.ev.task.activity} · ${formatMinutes(p.startMin)}–${formatMinutes(p.endMin)}`}
                  >
                    <span className="bcal-timed-time">{formatMinutes(p.startMin)}</span>
                    <span className="bcal-timed-label">{p.ev.task.activity}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Modal crear/editar -----------------------------------------------------
function EventModal({
  modal, onClose, onChange,
}: {
  modal: NonNullable<ModalState>;
  onClose: () => void;
  onChange: (next: PlanTrabajoState) => void;
}) {
  const isEdit = modal.mode === "edit";
  const task = isEdit ? modal.task : null;
  const [activity, setActivity] = useState(task?.activity ?? "");
  const [startDate, setStartDate] = useState(isEdit ? task?.start_date ?? "" : modal.date);
  const [endDate, setEndDate] = useState(isEdit ? task?.end_date ?? "" : modal.date);
  const [startTime, setStartTime] = useState(isEdit ? task?.start_time ?? "" : modal.time ?? "");
  const [endTime, setEndTime] = useState(isEdit ? task?.end_time ?? "" : "");
  const [kind, setKind] = useState<PlanTrabajoTaskKind>(
    isEdit ? task?.kind ?? "activity" : modal.kind ?? "activity",
  );
  const [status, setStatus] = useState(task?.status ?? "planned");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!activity.trim()) { setError("La actividad necesita un nombre."); return; }
    setBusy(true);
    setError(null);
    const start = startDate || endDate;
    const end = endDate || startDate;
    try {
      const next = isEdit && task
        ? await apiPlanTrabajoTaskUpdate(task.id, {
            activity: activity.trim(), start_date: start, end_date: end,
            start_time: startTime, end_time: endTime, status,
          })
        : await apiPlanTrabajoTaskCreate({
            activity: activity.trim(), start_date: start, end_date: end,
            start_time: startTime, end_time: endTime, kind,
          });
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la actividad.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await apiPlanTrabajoTaskDelete(task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la actividad.");
      setBusy(false);
    }
  }

  return (
    <div className="bcal-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bcal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bcal-modal-head"><strong>{isEdit ? "Editar actividad" : "Nueva actividad"}</strong></div>
        <label><span>Actividad</span>
          <input value={activity} onChange={(e) => setActivity(e.target.value)} autoFocus />
        </label>
        <div className="plan-form-grid">
          <label><span>Inicio</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label><span>Fin</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <div className="plan-form-grid">
          <label><span>Hora inicio</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label><span>Hora fin</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        {isEdit ? (
          <label><span>Estado</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="planned">Planificado</option>
              <option value="active">En curso</option>
              <option value="done">Cumplido</option>
              <option value="risk">Riesgo</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </label>
        ) : (
          <label><span>Categoría</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as PlanTrabajoTaskKind)}>
              {KIND_OPTIONS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </label>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="bcal-modal-actions">
          {isEdit && (
            <button type="button" className="plan-icon-button" onClick={remove} disabled={busy} title="Eliminar" aria-label="Eliminar">
              <Trash2 size={15} />
            </button>
          )}
          <span className="bcal-modal-spacer" />
          <button type="button" className="plan-button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="plan-button plan-button--primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Clock3 size={15} />}
            <span>{isEdit ? "Guardar" : "Crear"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
