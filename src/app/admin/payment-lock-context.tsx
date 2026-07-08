"use client";

import { createContext, useContext, useState } from "react";

type PaymentLockContextValue = {
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
};

const PaymentLockContext = createContext<PaymentLockContextValue | null>(null);

export function PaymentLockProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <PaymentLockContext.Provider value={{ unlocked, setUnlocked }}>
      {children}
    </PaymentLockContext.Provider>
  );
}

export function usePaymentLock(): PaymentLockContextValue {
  const ctx = useContext(PaymentLockContext);
  if (!ctx) {
    throw new Error("usePaymentLock must be used within PaymentLockProvider");
  }
  return ctx;
}
