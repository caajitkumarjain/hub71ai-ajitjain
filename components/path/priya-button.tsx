"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { priya, saveProfile } from "./profile-storage";

export function PriyaButton() {
  const router = useRouter();
  return <Button size="lg" onClick={() => { saveProfile(priya); router.push("/path"); }}>See Priya&apos;s path<ArrowRight aria-hidden="true" /></Button>;
}
