"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient: "blue" | "purple" | "green" | "orange";
  delay?: number;
}

const gradients = {
  blue: "gradient-card-blue",
  purple: "gradient-card-purple",
  green: "gradient-card-green",
  orange: "gradient-card-orange",
};

export function StatCard({ title, value, subtitle, icon: Icon, gradient, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 text-white shadow-lg",
        gradients[gradient]
      )}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-white/70">{subtitle}</p>}
        </div>
        <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}
