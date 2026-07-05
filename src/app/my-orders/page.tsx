import { getCafeName } from "@/lib/auth";
import MyOrdersClient from "./my-orders-client";

export default function MyOrdersPage() {
  return <MyOrdersClient cafeName={getCafeName()} />;
}
