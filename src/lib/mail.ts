import nodemailer from "nodemailer";

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || "587");
  const secure =
    process.env.SMTP_SECURE === "true" || (process.env.SMTP_SECURE !== "false" && port === 465);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function getFromAddress() {
  return (
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "noreply@digitixlabs.com"
  );
}

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  firstName?: string | null;
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Digitix HRMS";
  const greeting = params.firstName ? `Hi ${params.firstName},` : "Hi,";
  const subject = `${appName} — Reset your password`;

  const text = [
    greeting,
    "",
    "We received a request to reset your password.",
    "Use the link below to choose a new password (valid for 1 hour):",
    "",
    params.resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    `— ${appName}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 560px;">
      <p>${greeting}</p>
      <p>We received a request to reset your password for <strong>${appName}</strong>.</p>
      <p>
        <a href="${params.resetUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
          Reset password
        </a>
      </p>
      <p style="font-size: 14px; color: #6b7280;">
        Or copy this link into your browser:<br />
        <a href="${params.resetUrl}">${params.resetUrl}</a>
      </p>
      <p style="font-size: 14px; color: #6b7280;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
      <p style="font-size: 14px; color: #6b7280;">— ${appName}</p>
    </div>
  `.trim();

  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured");
    }
    console.log(`[mail] SMTP not configured. Password reset link for ${params.to}: ${params.resetUrl}`);
    return { sent: false, devFallback: true };
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to: params.to,
    subject,
    text,
    html,
  });

  return { sent: true, devFallback: false };
}

export function buildPasswordResetUrl(token: string) {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}
