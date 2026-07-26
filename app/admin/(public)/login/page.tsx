"use client";

import { useActionState } from "react";
import Image from "next/image";
import { loginAction } from "@/app/actions/auth";
import MagneticButton from "@/components/ui/MagneticButton";
import { getAssetUrl } from "@/lib/assets";

const LOGO_WHITE = getAssetUrl("logo-white");

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await loginAction(formData);
      return result;
    },
    null
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030504] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,61,46,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(200,169,106,0.08),transparent_50%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <Image
            src={LOGO_WHITE}
            alt="NAVIURE"
            width={160}
            height={50}
            className="mx-auto mb-4"
            unoptimized
          />
          <p className="text-[10px] uppercase tracking-[0.36em] text-gold/70">
            Photography CMS
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl space-y-6"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-soft-white/40"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-soft-white outline-none transition placeholder:text-soft-white/25 focus:border-gold/35"
              placeholder="admin@naviure.in"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-soft-white/40"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-soft-white outline-none transition focus:border-gold/35"
            />
          </div>

          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

          <MagneticButton
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign In"}
          </MagneticButton>
        </form>
      </div>
    </div>
  );
}
