import { notFound } from "next/navigation";
import OrderClient from "./order-client";
import { getCafeName } from "@/lib/auth";

type Props = {
  params: { tableNumber: string };
};

export default function OrderPage({ params }: Props) {
  const tableNumber = parseInt(params.tableNumber, 10);

  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 99) {
    notFound();
  }

  return <OrderClient tableNumber={tableNumber} cafeName={getCafeName()} />;
}
