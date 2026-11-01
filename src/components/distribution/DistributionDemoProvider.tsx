"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSalesDemo } from "@/components/sales/SalesDemoProvider";
import {
  canTransitionDeliveryStatus,
  createDelivery,
  getInitialDemoDeliveries,
  isDeliveryRecord,
  DELIVERY_DEMO_STORAGE_KEY,
  type DeliveryInput,
  type DeliveryRecord,
  type DeliveryStatus,
} from "@/lib/delivery-demo";

type DistributionState = {
  deliveries: DeliveryRecord[];
  ready: boolean;
  error: string;
};

type DistributionContextValue = DistributionState & {
  addDelivery: (input: DeliveryInput) => DeliveryRecord;
  updateStatus: (id: string, status: DeliveryStatus) => void;
};

const DistributionContext =
  createContext<DistributionContextValue | null>(null);
const serverState: DistributionState = {
  deliveries: getInitialDemoDeliveries(),
  ready: true,
  error: "",
};
let state = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function saveDeliveries(deliveries: DeliveryRecord[]) {
  try {
    window.localStorage.setItem(
      DELIVERY_DEMO_STORAGE_KEY,
      JSON.stringify(deliveries),
    );
  } catch {
    throw new Error("تعذّر حفظ بيانات التوصيل في هذا المتصفح.");
  }
}

function loadState() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(DELIVERY_DEMO_STORAGE_KEY);
    if (saved === null) {
      saveDeliveries(serverState.deliveries);
      state = serverState;
      return;
    }

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isDeliveryRecord)) {
      state = {
        deliveries: [],
        ready: true,
        error: "تعذّرت قراءة بيانات التوصيل المحفوظة. لم يتم تغييرها.",
      };
      return;
    }
    state = { deliveries: parsed, ready: true, error: "" };
  } catch {
    state = {
      deliveries: [],
      ready: true,
      error: "تعذّر الوصول إلى تخزين بيانات التوصيل في هذا المتصفح.",
    };
  }
}

function getSnapshot() {
  loadState();
  return state;
}

function getServerSnapshot() {
  return serverState;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function syncFromOtherTab(event: StorageEvent) {
    if (event.key !== DELIVERY_DEMO_STORAGE_KEY || event.newValue === null) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (!Array.isArray(parsed) || !parsed.every(isDeliveryRecord)) {
        state = {
          ...state,
          error: "بيانات التوصيل المحدثة في تبويب آخر غير صالحة.",
        };
      } else {
        state = { deliveries: parsed, ready: true, error: "" };
      }
    } catch {
      state = {
        ...state,
        error: "تعذّرت مزامنة بيانات التوصيل من تبويب آخر.",
      };
    }
    notify();
  }

  window.addEventListener("storage", syncFromOtherTab);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", syncFromOtherTab);
  };
}

export function DistributionDemoProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { orders } = useSalesDemo();
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const addDelivery = useCallback((input: DeliveryInput) => {
    const current = getSnapshot();
    if (current.error) throw new Error(current.error);
    const delivery = createDelivery(input, orders, current.deliveries);
    const updatedDeliveries = [delivery, ...current.deliveries];
    saveDeliveries(updatedDeliveries);
    state = { deliveries: updatedDeliveries, ready: true, error: "" };
    notify();
    return delivery;
  }, [orders]);

  const updateStatus = useCallback((id: string, status: DeliveryStatus) => {
    const current = getSnapshot();
    if (current.error) throw new Error(current.error);
    const delivery = current.deliveries.find((item) => item.id === id);
    if (!delivery) throw new Error("سجل التوصيل غير موجود في بيانات العرض.");
    if (!canTransitionDeliveryStatus(delivery.status, status)) {
      throw new Error("لا يمكن الانتقال إلى حالة التوصيل المطلوبة.");
    }
    const updatedDeliveries = current.deliveries.map((item) =>
      item.id === id ? { ...item, status } : item,
    );
    saveDeliveries(updatedDeliveries);
    state = { deliveries: updatedDeliveries, ready: true, error: "" };
    notify();
  }, []);

  const value = useMemo(
    () => ({ ...snapshot, addDelivery, updateStatus }),
    [snapshot, addDelivery, updateStatus],
  );

  return (
    <DistributionContext.Provider value={value}>
      {children}
    </DistributionContext.Provider>
  );
}

export function useDistributionDemo() {
  const context = useContext(DistributionContext);
  if (!context) {
    throw new Error(
      "useDistributionDemo must be used within DistributionDemoProvider.",
    );
  }
  return context;
}
