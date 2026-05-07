"use client"

import { supabase } from "@/lib/supabase"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return `Bearer ${token}`
}

export async function startProCheckout(plan: "monthly" | "yearly"): Promise<"success" | "cancelled" | "error"> {
  const loaded = await loadRazorpayScript()
  if (!loaded) throw new Error("Failed to load Razorpay SDK")

  const authHeader = await getAuthHeader()

  // Create order on backend
  const orderRes = await fetch(`${API_URL}/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ plan }),
  })
  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}))
    throw new Error(err.detail ?? "Failed to create order")
  }
  const { order_id, amount, currency, key_id } = await orderRes.json()

  // Get user info for prefill
  const { data: { user } } = await supabase.auth.getUser()

  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key: key_id,
      amount,
      currency,
      order_id,
      name: "Traders Diary",
      description: `Pro Plan – ${plan === "monthly" ? "₹499/month" : "₹4,499/year"}`,
      image: "https://www.tradersdiary.in/favicon.ico",
      prefill: {
        name: user?.user_metadata?.full_name ?? "",
        email: user?.email ?? "",
      },
      theme: { color: "#6366f1" },
      modal: {
        ondismiss: () => resolve("cancelled"),
      },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const verifyRes = await fetch(`${API_URL}/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan,
            }),
          })
          if (verifyRes.ok) resolve("success")
          else resolve("error")
        } catch {
          resolve("error")
        }
      },
    })
    rzp.open()
  })
}
