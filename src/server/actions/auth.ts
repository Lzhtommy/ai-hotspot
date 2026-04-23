'use server';

/**
 * Auth server actions — Phase 5 Plan 05-04 (AUTH-02, AUTH-03, AUTH-04).
 *
 * Thin wrappers over @/lib/auth signIn/signOut so `<form action={...}>` in
 * the LoginPromptModal Client Component can invoke provider sign-in without
 * importing signIn from 'next-auth/react' (per RESEARCH §Anti-Patterns —
 * the next-auth/react entrypoint does not support App Router server-first
 * auth flows).
 *
 * The email magic-link flow returns a discriminated union {success} | {error}
 * so the modal can render the inline "检查邮箱" success state / error alert
 * per UI-SPEC §LoginPromptModal without navigating the whole page.
 *
 * Consumed by:
 *   - src/components/feed/login-prompt-modal.tsx
 */
import { signIn, signOut } from '@/lib/auth';

export async function signInGithubAction(): Promise<void> {
  await signIn('github', { redirectTo: '/' });
}

export async function signInGoogleAction(): Promise<void> {
  await signIn('google', { redirectTo: '/' });
}

export type SignInResendResult = { success: true } | { error: 'EMPTY_EMAIL' | 'SEND_FAILED' };

export async function signInResendAction(formData: FormData): Promise<SignInResendResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'EMPTY_EMAIL' };
  try {
    await signIn('resend', { email, redirect: false });
    return { success: true };
  } catch {
    return { error: 'SEND_FAILED' };
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
