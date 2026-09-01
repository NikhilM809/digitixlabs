import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResetToken } from "@/lib/jwt";
import { forgotPasswordSchema } from "@/lib/validations";
import { normalizeEmail } from "@/lib/email-utils";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, firstName: true, status: true },
    });

    // Always return success to prevent email enumeration
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ success: true });
    }

    const token = generateResetToken(user.email);
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({ where: { email: user.email } });
    await prisma.passwordResetToken.create({
      data: { email: user.email, token, expires },
    });

    const resetUrl = buildPasswordResetUrl(token);
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      firstName: user.firstName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }
}
