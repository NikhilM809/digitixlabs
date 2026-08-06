"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#0693e3", "#9b51e0", "#00d084", "#ff6900", "#fcb900", "#8ed1fc"];

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  delay?: number;
}

export function ChartCard({ title, children, delay = 0 }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card glass>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

interface AttendanceTrendChartProps {
  data: { month: string; present: number; absent: number; late: number }[];
}

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
  return (
    <ChartCard title="Attendance Trend">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0693e3" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0693e3" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
            }}
          />
          <Area type="monotone" dataKey="present" stroke="#0693e3" fill="url(#colorPresent)" strokeWidth={2} />
          <Area type="monotone" dataKey="late" stroke="#ff6900" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface LeaveTrendChartProps {
  data: { month: string; approved: number; rejected: number; pending: number }[];
}

export function LeaveTrendChart({ data }: LeaveTrendChartProps) {
  return (
    <ChartCard title="Leave Trend">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
            }}
          />
          <Bar dataKey="approved" fill="#00d084" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" fill="#fcb900" radius={[4, 4, 0, 0]} />
          <Bar dataKey="rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface DepartmentChartProps {
  data: { name: string; count: number }[];
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  return (
    <ChartCard title="Department Wise Employees">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="count"
            nameKey="name"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span>{item.name} ({item.count})</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

interface MonthlyLeaveChartProps {
  data: { type: string; days: number }[];
}

export function MonthlyLeaveChart({ data }: MonthlyLeaveChartProps) {
  return (
    <ChartCard title="Monthly Leave Summary">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" className="text-xs" />
          <YAxis dataKey="type" type="category" className="text-xs" width={100} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
            }}
          />
          <Bar dataKey="days" fill="#9b51e0" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
