type FormulaSectionHeadingProps = {
  title: string;
};

export default function FormulaSectionHeading({ title }: FormulaSectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base sm:text-xl font-semibold text-sharp leading-tight">{title}</h2>
      <span className="hidden sm:inline text-xs uppercase tracking-[0.14em] surface-muted-text shrink-0">
        Formules
      </span>
    </div>
  );
}
