export type ReceiptConfig = {
  /** Uppercase name printed on the bill header */
  cafeName: string;
  addressLines: string[];
  cashier: string;
};

const DEFAULT_ADDRESS = [
  "D9A SHOP NO.19, D BLOCK MARKET,",
  "SECTOR 27, NOIDA 201301, UTTAR",
  "PRADESH 7017641188",
];

export function getReceiptConfig(appName?: string): ReceiptConfig {
  const name =
    process.env.NEXT_PUBLIC_RECEIPT_CAFE_NAME ||
    (appName ? appName.replace(/\s+cafe$/i, "").trim() : "TEAKKUZ");

  const addressEnv = process.env.NEXT_PUBLIC_CAFE_ADDRESS;
  const addressLines = addressEnv
    ? addressEnv.split("|").map((line) => line.trim()).filter(Boolean)
    : DEFAULT_ADDRESS;

  return {
    cafeName: name.toUpperCase(),
    addressLines,
    cashier: process.env.NEXT_PUBLIC_RECEIPT_CASHIER || "biller",
  };
}
