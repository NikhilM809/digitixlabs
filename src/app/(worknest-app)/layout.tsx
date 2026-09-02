import { Providers } from "@/components/providers";

export default function WorknestAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="worknest-theme min-h-screen">
      <Providers>{children}</Providers>
    </div>
  );
}
