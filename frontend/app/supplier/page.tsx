import type { Metadata } from "next";
import SupplierPortal from "@/components/supplier-portal";
export const metadata: Metadata = {
  title: "حساب تأمین‌کننده",
  robots: { index: false, follow: false },
};
export default function SupplierPage() {
  return <SupplierPortal />;
}
