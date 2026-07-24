import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProsecnurModuleSlug } from "./modules";

export type ModuleNavigationRuntimeItemState = {
  done?: boolean;
  badge?: string;
  lockedReason?: string;
};

export type ModuleNavigationRuntimeRegistration = {
  moduleSlug: ProsecnurModuleSlug;
  activeSectionId: string;
  activeTabId?: string;
  preferredRailMode?: "expanded" | "collapsed";
  sectionStates: Readonly<
    Record<string, ModuleNavigationRuntimeItemState>
  >;
  tabStates?: Readonly<Record<string, ModuleNavigationRuntimeItemState>>;
};

type RuntimeOwner = symbol;

type OwnedRuntimeRegistration = {
  owner: RuntimeOwner;
  registration: ModuleNavigationRuntimeRegistration;
};

type ModuleNavigationRuntimeContextValue = {
  publish: (
    registration: ModuleNavigationRuntimeRegistration,
    owner: RuntimeOwner,
  ) => void;
  remove: (moduleSlug: ProsecnurModuleSlug, owner: RuntimeOwner) => void;
};

type ModuleNavigationRuntimeRegistrations = Readonly<
  Partial<Record<ProsecnurModuleSlug, OwnedRuntimeRegistration>>
>;

const EMPTY_REGISTRATIONS: ModuleNavigationRuntimeRegistrations = {};

const NO_RUNTIME_CONTEXT: ModuleNavigationRuntimeContextValue = {
  publish: () => undefined,
  remove: () => undefined,
};

const ModuleNavigationRuntimeActionsContext =
  createContext<ModuleNavigationRuntimeContextValue>(NO_RUNTIME_CONTEXT);
const ModuleNavigationRuntimeRegistrationsContext =
  createContext<ModuleNavigationRuntimeRegistrations>(EMPTY_REGISTRATIONS);

function sameItemState(
  left: ModuleNavigationRuntimeItemState | undefined,
  right: ModuleNavigationRuntimeItemState | undefined,
): boolean {
  return (
    left?.done === right?.done &&
    left?.badge === right?.badge &&
    left?.lockedReason === right?.lockedReason
  );
}

function sameStateRecord(
  left: Readonly<Record<string, ModuleNavigationRuntimeItemState>> | undefined,
  right: Readonly<Record<string, ModuleNavigationRuntimeItemState>> | undefined,
): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left ?? {});
  const rightKeys = Object.keys(right ?? {});
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right ?? {}, key) &&
      sameItemState(left?.[key], right?.[key]),
  );
}

function sameRegistration(
  left: ModuleNavigationRuntimeRegistration,
  right: ModuleNavigationRuntimeRegistration,
): boolean {
  return (
    left.moduleSlug === right.moduleSlug &&
    left.activeSectionId === right.activeSectionId &&
    left.activeTabId === right.activeTabId &&
    left.preferredRailMode === right.preferredRailMode &&
    sameStateRecord(left.sectionStates, right.sectionStates) &&
    sameStateRecord(left.tabStates, right.tabStates)
  );
}

export function ModuleNavigationRuntimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [registrations, setRegistrations] = useState<
    ModuleNavigationRuntimeRegistrations
  >(EMPTY_REGISTRATIONS);

  const publish = useCallback(
    (
      registration: ModuleNavigationRuntimeRegistration,
      owner: RuntimeOwner,
    ) => {
      setRegistrations((current) => {
        const previous = current[registration.moduleSlug];
        if (
          previous?.owner === owner &&
          sameRegistration(previous.registration, registration)
        ) {
          return current;
        }
        return {
          ...current,
          [registration.moduleSlug]: { owner, registration },
        };
      });
    },
    [],
  );

  const remove = useCallback(
    (moduleSlug: ProsecnurModuleSlug, owner: RuntimeOwner) => {
      setRegistrations((current) => {
        if (current[moduleSlug]?.owner !== owner) return current;
        const next = { ...current };
        delete next[moduleSlug];
        return next;
      });
    },
    [],
  );

  const actions = useMemo(() => ({ publish, remove }), [publish, remove]);

  return (
    <ModuleNavigationRuntimeActionsContext.Provider value={actions}>
      <ModuleNavigationRuntimeRegistrationsContext.Provider
        value={registrations}
      >
        {children}
      </ModuleNavigationRuntimeRegistrationsContext.Provider>
    </ModuleNavigationRuntimeActionsContext.Provider>
  );
}

export function useRegisterModuleNavigationRuntime(
  registration: ModuleNavigationRuntimeRegistration | null,
): void {
  const { publish, remove } = useContext(
    ModuleNavigationRuntimeActionsContext,
  );
  const ownerRef = useRef<RuntimeOwner | null>(null);
  if (!ownerRef.current) ownerRef.current = Symbol("module-navigation-runtime");
  const owner = ownerRef.current;
  const moduleSlug = registration?.moduleSlug;

  useEffect(() => {
    if (registration) publish(registration, owner);
  });

  useEffect(
    () => () => {
      if (moduleSlug) remove(moduleSlug, owner);
    },
    [moduleSlug, owner, remove],
  );
}

export function useModuleNavigationRuntime(
  moduleSlug?: ProsecnurModuleSlug,
): ModuleNavigationRuntimeRegistration | null {
  const registrations = useContext(
    ModuleNavigationRuntimeRegistrationsContext,
  );
  if (moduleSlug) return registrations[moduleSlug]?.registration ?? null;
  for (const registration of Object.values(registrations)) {
    if (registration) return registration.registration;
  }
  return null;
}
