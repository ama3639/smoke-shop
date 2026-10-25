import type { Metadata } from "next";
import OperationsPanel from "@/components/operations-panel";
export const metadata: Metadata = {
  title: "پنل عملیات",
  robots: { index: false, follow: false },
};
export default function ManagePage() {
  return <OperationsPanel />;
}
