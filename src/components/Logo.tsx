import Image from "next/image";

export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/logo-full.png"
      alt="Sell Insights — Built to Scale"
      width={1536}
      height={430}
      priority
      className={className}
    />
  );
}
