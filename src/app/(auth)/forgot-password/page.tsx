"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Image
            src="/digitix-logo.png"
            alt="Digitix Labs"
            width={160}
            height={29}
            className="mx-auto mb-6"
          />
        </div>

        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center">
            <UserCog className="h-8 w-8 text-brand-600" />
          </div>
          <h2 className="text-2xl font-bold">Forgot password?</h2>
          <p className="text-muted-foreground">
            Password resets are handled by your organization. Please contact your{" "}
            <strong>Manager</strong> or <strong>Admin</strong> to reset your password.
          </p>
          <p className="text-sm text-muted-foreground">
            After reset, you may receive a temporary password and will be asked to set a new one
            when you sign in.
          </p>
          <Link href="/login">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
