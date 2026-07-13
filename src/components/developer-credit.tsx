export default function DeveloperCredit({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-center text-[11px] tracking-wide text-brand-subtle ${className}`.trim()}
    >
      Developed by Inaam Zia
    </p>
  );
}
