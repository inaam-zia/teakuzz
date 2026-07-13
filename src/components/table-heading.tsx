type Size = "sm" | "md" | "lg";

const nameClass: Record<Size, string> = {
  sm: "text-sm font-bold text-brand-heading",
  md: "text-lg font-bold text-brand-heading",
  lg: "text-xl font-bold text-brand-heading sm:text-2xl",
};

const numberClass: Record<Size, string> = {
  sm: "text-xs font-medium text-brand-muted",
  md: "text-sm font-medium text-brand-muted",
  lg: "text-base font-semibold text-brand-muted",
};

/**
 * Shows table name highlighted, with table number beside it.
 * Example: Patio · Table 5
 */
export default function TableHeading({
  tableNumber,
  tableName,
  size = "md",
  className = "",
}: {
  tableNumber: number;
  tableName?: string | null;
  size?: Size;
  className?: string;
}) {
  const name = tableName?.trim();
  const showSeparateNumber =
    !name || name.toLowerCase() !== `table ${tableNumber}`.toLowerCase();

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`.trim()}
    >
      <span className={nameClass[size]}>{name || `Table ${tableNumber}`}</span>
      {showSeparateNumber && (
        <span className={numberClass[size]}>· Table {tableNumber}</span>
      )}
    </span>
  );
}
