import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  href = "/",
  width = 150,
  height = 84
}: {
  className?: string;
  href?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center justify-center transition-all duration-300 group', className)}
      aria-label="LEBAREF Home"
    >
      <div className="relative flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="LEBAREF Logo"
          width={width}
          height={height}
          className="object-contain transition-all duration-300 dark:brightness-0 dark:invert dark:opacity-95 drop-shadow-xs dark:drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)] group-hover:scale-102"
          priority
        />
      </div>
    </Link>
  );
}
