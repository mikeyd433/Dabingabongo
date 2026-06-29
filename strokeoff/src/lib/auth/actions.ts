import { supabase } from '../supabase'

/**
 * Auth actions (spec §4). Thin wrappers over supabase-js so UI components share
 * one source of truth for sign-in/upgrade/sign-out/delete behavior.
 */

/** Anonymous quick-join: pick a display name and you're in. */
export async function signInAnonymously(displayName: string) {
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: displayName.trim() } },
  })
  if (error) throw error
}

/**
 * Magic-link sign-in for a signed-out visitor (creates an account if new).
 * `redirectTo` overrides where the link lands — e.g. back to a `?claim=…` URL so
 * the claim resumes after sign-in (spec §10). Defaults to the app root.
 */
export async function sendMagicLink(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo:
        redirectTo ?? window.location.origin + import.meta.env.BASE_URL,
    },
  })
  if (error) throw error
}

/**
 * Attach an email to the current user. Used both to upgrade an anonymous session
 * in place (spec §4 "save-later") and to change a signed-in user's email. Supabase
 * sends a confirmation link to complete it.
 */
export async function setEmail(email: string) {
  // Send the confirmation link back into the app (/strokeoff/), not the site
  // root — without an explicit redirect Supabase falls back to the Site URL,
  // which would drop the user on dabingabongo.com instead of the app.
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  )
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Full erasure: delete the auth user (cascades profile + personal group). */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_account')
  if (error) throw error
  await supabase.auth.signOut()
}
