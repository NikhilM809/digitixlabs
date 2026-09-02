import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/digitix-logo.png"
      alt="Digitix Labs"
      className={cn("rounded-xl bg-white object-cover", className)}
    />
  );
}
