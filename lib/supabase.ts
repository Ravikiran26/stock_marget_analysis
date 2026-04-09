import { createBrowserClient } from "@supabase/ssr"

const PLACEHOLDER_URL = "https://xyzcompanysupabase.co"
const PLACEHOLDER_KEY = "placeholder-anon-key"

function isRealUrl(url: string) {
  try { return new URL(url).protocol.startsWith("http") } catch { return false }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const supabase = createBrowserClient(
  isRealUrl(url) ? url : PLACEHOLDER_URL,
  key.length > 10 ? key : PLACEHOLDER_KEY
)

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
