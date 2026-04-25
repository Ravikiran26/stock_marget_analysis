"use client"

import { Geist } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase, signInWithGoogle, signOut } from "@/lib/supabase"
import { setUserId } from "@/lib/api"
import type { Session } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import WelcomeModal from "@/components/WelcomeModal"
import AuthModal from "@/components/AuthModal"
import { Analytics } from "@vercel/analytics/react"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard",    icon: "M3 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm10 0a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1V4zM3 14a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1v-6z" },
  { href: "/upload",    label: "Upload Trade", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  { href: "/positions", label: "Positions",    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { href: "/trades",    label: "My Trades",    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user?.id) setUserId(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (s?.user?.id) setUserId(s.user.id)
      if (event === "SIGNED_IN") {
        const welcomed = localStorage.getItem("tradfy_welcomed")
        if (!welcomed) setIsNewUser(true)
      }
      if (event === "SIGNED_OUT") router.push("/")
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  const user = session?.user
  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U"

  async function handleSignOut() {
    setAvatarOpen(false)
    await signOut()
  }

  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        <title>Traders Diary — AI Trade Journal for Indian Traders</title>
        <meta
          name="description"
          content="Analyse every NSE/BSE trade with live EMAs, VIX, fundamentals and AI coaching. The smartest trade journal for Indian retail traders."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Traders Diary — AI Trade Journal for Indian Traders" />
        <meta property="og:description" content="Upload your Zerodha, Upstox or Dhan trades. AI analyses every trade, flags overtrading and revenge trading patterns. Free to start." />
        <meta property="og:url" content="https://tradersdiary.in" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://tradersdiary.in/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Traders Diary — AI Trade Journal for Indian Traders" />
        <meta name="twitter:description" content="Upload your Zerodha, Upstox or Dhan trades. AI analyses every trade, flags overtrading and revenge trading patterns. Free to start." />
        <meta name="twitter:image" content="https://tradersdiary.in/og-image.png" />
        <meta name="theme-color" content="#060c18" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23060c18'/%3E%3Cpolyline points='4,22 10,14 16,18 22,8 28,12' fill='none' stroke='%236366f1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='28' cy='12' r='2' fill='%2322c55e'/%3E%3C/svg%3E" />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <Analytics />
      <body className="min-h-full flex flex-col bg-[#060c18] text-slate-200 antialiased">

        {/* ── Navbar ────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/[0.06] bg-[#060c18]/85 transition-colors duration-300">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-4">

              {/* Logo */}
              <Link
                href="/"
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="8" fill="#0d1528"/>
                  <polyline points="4,22 10,14 16,18 22,8 28,12" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="28" cy="12" r="2" fill="#22c55e"/>
                </svg>
                <span className="font-black text-lg text-white tracking-tight">Traders Diary</span>
              </Link>

              {/* Desktop nav links */}
              {user && (
                <div className="hidden sm:flex items-center gap-1 flex-1 justify-center">
                  {NAV_LINKS.map((link) => (
                    <NavLink key={link.href} href={link.href} active={pathname === link.href} icon={link.icon}>
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              )}

              {/* Right side */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {user ? (
                  <>
                    {/* Avatar dropdown */}
                    <div className="relative" ref={avatarRef}>
                      <button
                        onClick={() => setAvatarOpen(!avatarOpen)}
                        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#060c18] p-0.5"
                        aria-label="User menu"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-indigo-900 text-indigo-200 text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:block text-sm text-slate-300 max-w-[120px] truncate">
                          {user.user_metadata?.full_name ?? user.email}
                        </span>
                        <svg className="hidden sm:block w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {avatarOpen && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#1c2e4a] bg-[#0d1528] shadow-2xl shadow-black/50 py-1 z-50">
                          <div className="px-4 py-2.5 border-b border-[#1c2e4a]">
                            <p className="text-xs font-medium text-slate-200 truncate">
                              {user.user_metadata?.full_name ?? "Trader"}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                          {NAV_LINKS.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="block px-4 py-2 text-sm text-slate-300 hover:bg-[#162035] hover:text-white transition-colors"
                              onClick={() => setAvatarOpen(false)}
                            >
                              {link.label}
                            </Link>
                          ))}
                          <div className="border-t border-[#1c2e4a] mt-1 pt-1">
                            <button
                              onClick={handleSignOut}
                              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
                            >
                              Sign out
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hamburger (mobile only) */}
                    <button
                      onClick={() => setDrawerOpen(true)}
                      className="sm:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Open menu"
                    >
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => signInWithGoogle()}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all bg-white/10 hover:bg-white/15 text-white border border-white/20"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Sign in with Google
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* ── Mobile drawer ──────────────────────────────────────────────── */}
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Slide-in panel */}
            <div className="fixed top-0 right-0 z-50 h-full w-72 bg-[#0d1528] border-l border-[#1c2e4a] shadow-2xl shadow-black/60 flex flex-col sm:hidden animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between px-5 h-16 border-b border-[#1c2e4a]">
                <span className="font-black text-white text-lg flex items-center gap-2">
                  <svg width="22" height="22" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#111d33"/><polyline points="4,22 10,14 16,18 22,8 28,12" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="28" cy="12" r="2" fill="#22c55e"/></svg>
                  Traders Diary
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {user && (
                <div className="px-5 py-4 border-b border-[#1c2e4a] flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-indigo-900 text-indigo-200 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {user.user_metadata?.full_name ?? "Trader"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
              )}

              <nav className="flex-1 px-3 py-4 space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                      ${pathname === link.href
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === link.href ? 2.2 : 1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                    </svg>
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="px-3 pb-6">
                <button
                  onClick={handleSignOut}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-950/30 transition-colors text-left"
                >
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Page content ───────────────────────────────────────────────── */}
        <main className="flex-1">{children}</main>

        {/* ── Auth modal ─────────────────────────────────────────────────── */}
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

        {/* ── Welcome modal (new users only) ─────────────────────────────── */}
        {isNewUser && <WelcomeModal />}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="py-10 bg-[#020817] border-t border-white/[0.05]">
          <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-5">
            {/* Support — prominent */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span className="text-xs text-slate-400">Questions or issues?</span>
              <a href="mailto:support@tradersdiary.in" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                support@tradersdiary.in
              </a>
            </div>
            {/* Legal links */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
              <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
              <span>·</span>
              <a href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
              <span>·</span>
              <a href="/terms#6" className="hover:text-slate-400 transition-colors">Refund Policy</a>
            </div>
            <p className="text-xs text-slate-700 text-center">
              © {new Date().getFullYear()} TradersDiary.in · Not investment advice · For educational use only
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string
  active: boolean
  icon?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${active
          ? "text-indigo-300 bg-indigo-600/15 font-semibold"
          : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
        }`}
    >
      {icon && (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      {children}
      {active && (
        <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-indigo-500" />
      )}
    </Link>
  )
}
