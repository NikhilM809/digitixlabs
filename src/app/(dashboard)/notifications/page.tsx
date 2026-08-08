"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Calendar,
  FileText,
  Megaphone,
  Gift,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/activity-feed";
import { fetchApi } from "@/lib/api-client";
import { formatDateTime, cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsData {
  notifications: Notification[];
  unreadCount: number;
}

const typeIcons: Record<string, typeof Bell> = {
  LEAVE_APPROVED: CheckCheck,
  LEAVE_REJECTED: BellOff,
  LEAVE_PENDING: Calendar,
  LEAVE_CANCELLED: Calendar,
  PAYSLIP_UPLOADED: FileText,
  HOLIDAY_ANNOUNCEMENT: Calendar,
  BIRTHDAY: Gift,
  WORK_ANNIVERSARY: Gift,
  COMPANY_ANNOUNCEMENT: Megaphone,
  GENERAL: Bell,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchApi<NotificationsData>("/api/notifications?limit=50"),
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) =>
      fetchApi("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      fetchApi("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAll: true }),
      }),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate([id]);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {data?.unreadCount
              ? `You have ${data.unreadCount} unread notification${data.unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
        {data && data.unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            {markAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark all as read
          </Button>
        )}
      </motion.div>

      <Card glass>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-600" />
            All Notifications
          </CardTitle>
          <CardDescription>Stay updated on leave, payslips, and company news</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : data?.notifications && data.notifications.length > 0 ? (
            <div className="space-y-2">
              {data.notifications.map((notification, index) => {
                const Icon = typeIcons[notification.type] ?? Bell;
                const content = (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      "flex items-start gap-4 rounded-xl p-4 transition-colors",
                      notification.isRead
                        ? "bg-muted/20 hover:bg-muted/30"
                        : "bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200/30 hover:bg-brand-50/80"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-xl p-2.5 shrink-0",
                        notification.isRead ? "bg-muted" : "bg-brand-500/10"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          notification.isRead ? "text-muted-foreground" : "text-brand-600"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "font-medium",
                            !notification.isRead && "text-brand-900 dark:text-brand-100"
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <Badge variant="info" className="shrink-0">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMarkRead(notification.id);
                        }}
                        disabled={markReadMutation.isPending}
                      >
                        Mark read
                      </Button>
                    )}
                  </motion.div>
                );

                return notification.link ? (
                  <Link
                    key={notification.id}
                    href={notification.link}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="cursor-pointer"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={BellOff}
              title="No notifications"
              description="When you receive notifications, they'll appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
