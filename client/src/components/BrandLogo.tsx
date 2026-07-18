type BrandLogoProps = {
  /** Visual size of the mark */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Show wordmark next to the mark (hidden when size is used as icon-only) */
  withWordmark?: boolean
  className?: string
  imgClassName?: string
  /** Prefer full-bleed logo image that already includes text */
  variant?: 'mark' | 'full'
}

const sizeClass: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

const fullSizeClass: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
  xl: 'h-16',
}

/** Platform ClinicFlow brand mark from official logo artwork */
export function BrandLogo({
  size = 'md',
  withWordmark = false,
  className = '',
  imgClassName = '',
  variant = 'mark',
}: BrandLogoProps) {
  if (variant === 'full') {
    return (
      <img
        src="/clinicflow-logo.png"
        alt="ClinicFlow"
        className={`${fullSizeClass[size]} w-auto object-contain ${imgClassName} ${className}`}
        draggable={false}
      />
    )
  }

  return (
    <span className={`inline-flex items-center gap-sm ${className}`}>
      <img
        src="/clinicflow-logo.png"
        alt=""
        className={`${sizeClass[size]} shrink-0 rounded-xl object-contain ${imgClassName}`}
        draggable={false}
      />
      {withWordmark ? (
        <span className="font-headline-md text-headline-md font-bold text-primary">ClinicFlow</span>
      ) : null}
    </span>
  )
}
