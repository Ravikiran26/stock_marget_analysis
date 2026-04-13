"use client"

import { useState } from "react"
import { createPaymentOrder, verifyPayment } from "@/lib/api"
import { supabase } from "@/lib/supabase"

declare global {
  interface Window {
    Razorpay: any
  }
}

interface Props {
  plan?: "monthly" | "yearly"
  className?: string
  children?: React.ReactNode
  onSuccess?: () => void
}

export default function UpgradeButton({ plan = "monthly", className, children, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user) {
        alert("Please sign in first.")
        return
      }

      const order = await createPaymentOrder(plan)

      const options = {
        key:         order.key_id,
        amount:      order.amount,
        currency:    order.currency,
        name:        "EdgeJournal",
        description: plan === "yearly" ? "Pro Plan — Annual (₹2,499/yr)" : "Pro Plan — Monthly (₹299/mo)",
        order_id:    order.order_id,
        prefill: {
          name:  user.user_metadata?.full_name ?? "",
          email: user.email ?? "",
        },
        theme: { color: "#4f46e5" },
        handler: async (response: any) => {
          try {
            await verifyPayment({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan,
            })
            alert("🎉 You're now Pro! Unlimited AI coaching unlocked.")
            onSuccess?.()
          } catch {
            alert("Payment verification failed. Contact support.")
          }
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e) {
      alert("Could not initiate payment. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className={className ?? "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 transition-all disabled:opacity-60"}
    >
      {loading ? "Opening payment..." : (children ?? "Upgrade to Pro →")}
    </button>
  )
}
