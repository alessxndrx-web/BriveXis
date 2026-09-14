interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}

export function SectionHeader({ title, subtitle, align = 'left', dark = false }: SectionHeaderProps) {
  const alignmentClass = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-3xl mb-16 lg:mb-20 ${alignmentClass}`}>
      <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 tracking-tight leading-tight ${dark ? 'text-white' : 'text-charcoal'}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-lg sm:text-xl leading-relaxed ${dark ? 'text-muted-dark' : 'text-muted'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
