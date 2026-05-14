// =============================================================================
// Biblioteca canónica de íconos del producto
// =============================================================================
// Cada ícono se exporta bajo un nombre SEMÁNTICO (qué representa), no visual.
// Esto da dos beneficios:
//
//   1. Un solo punto de cambio. Si decidimos que "AI/auto" debe verse como
//      Wand2 en lugar de Sparkles (o viceversa), se cambia acá una vez.
//
//   2. Disciplina semántica en el call site. `IconAI` deja claro qué
//      representa el icono — `Sparkles` no, y por eso terminó usándose en
//      lugares random (eyebrows, badges, modales, modos) sin coherencia.
//
// Regla simple: si necesitás un ícono nuevo y existe un alias acá, usalo. Si
// no existe pero el concepto se repite, agregalo. Si es un caso totalmente
// único, importá directo de `lucide-react`.
//
// Las clases visuales y sizes siguen siendo responsabilidad del call site —
// esto es solo el mapeo concepto → componente.

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Asterisk,
  BookOpen,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FilePen,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  Loader2,
  Map,
  Pencil,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPen,
  Wand2,
  Workflow,
  X,
} from "lucide-react";

// ── Acciones ────────────────────────────────────────────────────────────
export const IconNew = Plus;
export const IconEdit = Pencil;
export const IconDelete = Trash2;
export const IconClose = X;
export const IconConfirm = Check;
export const IconForward = ArrowRight;
export const IconNext = ChevronRight;
export const IconBack = ChevronLeft;
export const IconExpand = ChevronDown;
export const IconCollapse = ChevronUp;
export const IconSearch = Search;
export const IconOpen = FolderOpen;

// ── Estados ─────────────────────────────────────────────────────────────
export const IconSuccess = CheckCircle2;
export const IconError = AlertTriangle;     // reemplaza XCircle en badges de estado
export const IconLoading = Loader2;
export const IconRequired = Asterisk;        // reemplaza Star en campos requeridos

// ── Conceptos del producto ──────────────────────────────────────────────
export const IconAI = Wand2;                 // generar, sugerir, inferir automáticamente
export const IconHint = Lightbulb;           // sugerencia/idea informativa (no AI)
export const IconTemplate = LayoutTemplate;  // plantilla
export const IconDiagnostic = Activity;      // diagnóstico / health
export const IconBranching = GitBranch;      // lógica de saltos / branching
export const IconChecklist = CheckSquare;    // completar/llenar campos
export const IconCustom = UserPen;           // personalizado por el usuario
export const IconReference = BookOpen;       // instrumento / referencia base
export const IconModes = SlidersHorizontal;  // modos / overrides reusables
export const IconHero = Sparkles;            // solo hero/empty-states grandes

// ── Identidad de módulos ────────────────────────────────────────────────
export const IconEditor = FilePen;
export const IconProcessing = Workflow;
export const IconDashboard = LayoutDashboard;
export const IconRoutes = Map;
export const IconCollector = QrCode;
export const IconMonitor = Activity;
