import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyResetToken } from "@/lib/jwt";
import { resetPasswordSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const decoded = verifyResetToken(parsed.data.token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: parsed.data.token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.update({
      where: { email: decoded.email },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    await prisma.passwordResetToken.delete({ where: { token: parsed.data.token } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
