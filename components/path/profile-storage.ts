import { Profile } from "@/lib/schemas";
import personas from "@/data/personas.json";

export const PROFILE_KEY = "manzil.profile.v1";
export const priya = Profile.parse(personas.priya);
let sessionProfile: Profile | null = null;

// Memory keeps client navigation working even when browser storage is unavailable.
export function readProfile(): Profile | null {
  if (sessionProfile) return structuredClone(sessionProfile);
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    const result = Profile.safeParse(raw ? JSON.parse(raw) : null);
    if (result.success) {
      sessionProfile = result.data;
      return structuredClone(result.data);
    }
  } catch { /* Private browsing, corrupt data or storage access denied. */ }
  return null;
}

export function saveProfile(value: Profile): boolean {
  const profile = Profile.parse(value);
  sessionProfile = structuredClone(profile);
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch { return false; }
}
