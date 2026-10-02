"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
      if (!response.ok) { setError(response.status === 429 ? "Too many attempts. Please wait before trying again." : "We could not sign you in. Check the operator passcode."); return; }
      setPasscode(""); router.replace("/admin"); router.refresh();
    } catch { setError("Sign-in is unavailable. Please try again."); } finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-md py-16 md:py-24"><div className="rounded-2xl border border-line bg-surface p-7 sm:p-9"><LockKeyhole aria-hidden="true" className="mb-6 size-7 text-primary" /><p className="text-xs uppercase tracking-[.16em] text-ink-muted">Manzil for operators</p><h1 className="mt-3 font-display text-4xl">Operator access</h1><p className="mt-4 text-sm leading-7 text-ink-muted">Sign in to explore founder friction and the live activity from this deployment.</p>{configured ? <form className="mt-7 space-y-5" onSubmit={submit}><label className="block text-sm font-medium">Operator passcode<input type="password" autoComplete="current-password" required maxLength={200} value={passcode} onChange={(event) => setPasscode(event.target.value)} className="mt-2 block h-12 w-full rounded-lg border border-line bg-bg px-3 text-ink" /></label>{error && <p role="alert" className="text-sm text-coral">{error}</p>}<Button type="submit" disabled={busy || !passcode} className="w-full">{busy ? "Signing in…" : "Enter operator view"}<ArrowRight aria-hidden="true" /></Button></form> : <p role="status" className="mt-6 rounded-lg border border-line bg-bg p-4 text-sm leading-6 text-ink-muted">Operator access has not been configured for this deployment.</p>}</div></section>;
}
