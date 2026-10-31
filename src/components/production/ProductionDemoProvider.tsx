"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createProductionOrder,
  getInitialDemoOrders,
  getNextProductionStatus,
  isProductionOrder,
  PRODUCTION_DEMO_STORAGE_KEY,
  type ProductionOrder,
  type ProductionOrderInput,
  type ProductionStatus,
} from "@/lib/production-demo";

type ProductionDemoState = {
  orders: ProductionOrder[];
  ready: boolean;
  error: string;
};

type ProductionDemoContextValue = {
  orders: ProductionOrder[];
  ready: boolean;
  error: string;
  addOrder: (input: ProductionOrderInput) => ProductionOrder;
  updateStatus: (id: string, status: ProductionStatus) => void;
};

const ProductionDemoContext =
  createContext<ProductionDemoContextValue | null>(null);

const serverState: ProductionDemoState = {
  orders: getInitialDemoOrders(),
  ready: true,
  error: "",
};
let state = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function loadState() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;

  try {
    const saved = window.localStorage.getItem(PRODUCTION_DEMO_STORAGE_KEY);
    if (saved === null) {
      saveOrders(serverState.orders);
      state = serverState;
      return;
    }

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isProductionOrder)) {
      state = {
        orders: [],
        ready: true,
        error: "تعذّر قراءة بيانات العرض المحفوظة. لم يتم تغييرها.",
      };
      return;
    }
    state = { orders: parsed, ready: true, error: "" };
  } catch {
    state = {
      orders: [],
      ready: true,
      error: "تعذّر الوصول إلى التخزين المحلي لهذا المتصفح.",
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
    if (event.key !== PRODUCTION_DEMO_STORAGE_KEY || event.newValue === null) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (!Array.isArray(parsed) || !parsed.every(isProductionOrder)) {
        state = {
          ...state,
          error: "بيانات العرض التي حُدثت في تبويب آخر غير صالحة.",
        };
      } else {
        state = { orders: parsed, ready: true, error: "" };
      }
    } catch {
      state = {
        ...state,
        error: "تعذّرت مزامنة بيانات العرض من تبويب آخر.",
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

function saveOrders(orders: ProductionOrder[]) {
  try {
    window.localStorage.setItem(
      PRODUCTION_DEMO_STORAGE_KEY,
      JSON.stringify(orders),
    );
  } catch {
    throw new Error("تعذّر حفظ بيانات العرض في هذا المتصفح.");
  }
}

function addOrder(input: ProductionOrderInput) {
  const current = getSnapshot();
  if (current.error) throw new Error(current.error);
  const order = createProductionOrder(input, current.orders);
  const updatedOrders = [order, ...current.orders];
  saveOrders(updatedOrders);
  state = { orders: updatedOrders, ready: true, error: "" };
  notify();
  return order;
}

function updateStatus(id: string, status: ProductionStatus) {
  const current = getSnapshot();
  if (current.error) throw new Error(current.error);
  if (!current.orders.some((order) => order.id === id)) {
    throw new Error("أمر الإنتاج غير موجود في بيانات العرض.");
  }
  const currentOrder = current.orders.find((order) => order.id === id);
  if (!currentOrder || getNextProductionStatus(currentOrder.status) !== status) {
    throw new Error("لا يمكن الانتقال إلى حالة العرض المطلوبة.");
  }
  const updatedOrders = current.orders.map((order) =>
    order.id === id ? { ...order, status } : order,
  );
  saveOrders(updatedOrders);
  state = { orders: updatedOrders, ready: true, error: "" };
  notify();
}

export function ProductionDemoProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const value = useMemo(
    () => ({
      ...snapshot,
      addOrder,
      updateStatus,
    }),
    [snapshot],
  );

  return (
    <ProductionDemoContext.Provider value={value}>
      {children}
    </ProductionDemoContext.Provider>
  );
}

export function useProductionDemo() {
  const context = useContext(ProductionDemoContext);
  if (!context) {
    throw new Error(
      "useProductionDemo must be used within ProductionDemoProvider.",
    );
  }
  return context;
}
