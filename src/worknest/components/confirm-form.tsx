"use client";

export function ConfirmForm({
  message,
  action,
  children,
}: {
  message: string;
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action as (formData: FormData) => Promise<void>}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
