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
        <title>EdgeJournal — AI Trade Journal for Indian Traders</title>
        <meta
          name="description"
          content="Analyse every NSE/BSE trade with live EMAs, VIX, fundamentals and AI coaching. The smartest trade journal for Indian retail traders."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="EdgeJournal — AI Trade Journal for Indian Traders" />
        <meta
          property="og:description"
          content="Analyse every NSE/BSE trade with live EMAs, VIX, fundamentals and AI coaching. Built for F&O and equity swing traders."
        />
        <meta name="theme-color" content="#2563EB" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>" />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">

        {/* ── Navbar ────────────────────────────────────────────────────── */}
        <nav className={`sticky top-0 z-40 backdrop-blur-xl transition-colors duration-300 ${
          pathname === "/" && !user
            ? "border-b border-white/[0.07] bg-[#07080f]/75"
            : "border-b border-gray-100 bg-white/90"
        }`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-4">

              {/* Logo */}
              <Link
                href="/"
                className="flex items-center gap-2 font-black text-xl hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <span className="text-2xl">📈</span>
                {pathname === "/" && !user ? (
                  <span className="text-white">EdgeJournal</span>
                ) : (
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">EdgeJournal</span>
                )}
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
                        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-0.5"
                        aria-label="User menu"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:block text-sm text-gray-700 max-w-[120px] truncate">
                          {user.user_metadata?.full_name ?? user.email}
                        </span>
                        <svg className="hidden sm:block w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {avatarOpen && (
                        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-50">
                          <div className="px-4 py-2.5 border-b border-gray-50">
                            <p className="text-xs font-medium text-gray-700 truncate">
                              {user.user_metadata?.full_name ?? "Trader"}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                          </div>
                          {NAV_LINKS.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setAvatarOpen(false)}
                            >
                              {link.label}
                            </Link>
                          ))}
                          <div className="border-t border-gray-50 mt-1 pt-1">
                            <button
                              onClick={handleSignOut}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
                      className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label="Open menu"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                      pathname === "/"
                        ? "bg-white/10 hover:bg-white/15 text-white border border-white/20"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
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
            <div className="fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-2xl flex flex-col sm:hidden animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
                <span className="font-bold text-blue-600 text-lg flex items-center gap-1.5">
                  <span>📈</span> EdgeJournal
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {user && (
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.user_metadata?.full_name ?? "Trader"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
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
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
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
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
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
        <footer className={`py-6 text-center text-xs transition-colors ${
          pathname === "/" && !user
            ? "bg-[#020817] border-t border-white/5 text-slate-600"
            : "border-t border-gray-100 text-gray-400"
        }`}>
          © {new Date().getFullYear()} EdgeJournal.in · Not investment advice · For educational use only
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
          ? "text-blue-700 bg-blue-50/80 font-semibold"
          : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/80"
        }`}
    >
      {icon && (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      {children}
      {active && (
        <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />
      )}
    </Link>
  )
}
