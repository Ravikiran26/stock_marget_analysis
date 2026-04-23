import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | Traders Diary",
  description: "How Traders Diary collects, uses, and protects your trading data.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#060c18] py-16 px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">← Back to home</Link>
          <h1 className="text-3xl font-black text-slate-100 mt-4 mb-2">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: April 24, 2026</p>
        </div>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">

          <Section title="1. Who We Are">
            Traders Diary ("we", "us", "our") is an AI-powered trade journaling platform operated at{" "}
            <span className="text-slate-300">tradersdiary.in</span>. We are not a SEBI-registered investment advisor.
            All analysis provided is for educational and journaling purposes only.
          </Section>

          <Section title="2. Information We Collect">
            <ul className="space-y-2 mt-2">
              <Li><strong className="text-slate-300">Account data</strong> — Name, email address, and profile picture obtained via Google OAuth when you sign in.</Li>
              <Li><strong className="text-slate-300">Trade data</strong> — Screenshots you upload, trade details you enter (symbol, entry/exit price, P&amp;L, notes), and CSV imports.</Li>
              <Li><strong className="text-slate-300">Usage data</strong> — Pages visited, features used, timestamps. Used to improve the product.</Li>
              <Li><strong className="text-slate-300">Payment data</strong> — Razorpay handles all payment processing. We store only your subscription status — never card or UPI details.</Li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Data">
            <ul className="space-y-2 mt-2">
              <Li>To provide AI trade analysis powered by Anthropic Claude.</Li>
              <Li>To display your trading statistics, P&amp;L charts, and performance insights.</Li>
              <Li>To manage your subscription and process payments via Razorpay.</Li>
              <Li>To send product updates and important account notifications (you can opt out).</Li>
              <Li>We do <strong className="text-slate-300">not</strong> sell, rent, or share your personal or trade data with third parties for marketing.</Li>
            </ul>
          </Section>

          <Section title="4. Data Storage & Security">
            Your data is stored securely on Supabase (hosted on AWS infrastructure). Trade screenshots are stored
            in encrypted object storage. We use HTTPS for all data transmission. Access to your data is restricted
            to your account only.
          </Section>

          <Section title="5. AI Processing">
            Trade screenshots and data you submit for AI analysis are sent to Anthropic's Claude API for processing.
            Anthropic's data handling is governed by their{" "}
            <span className="text-slate-300">privacy policy</span>. We do not use your trade data to train AI models.
          </Section>

          <Section title="6. Google OAuth">
            We use Google Sign-In for authentication. When you sign in with Google, we receive your name, email,
            and profile picture as permitted by Google's OAuth scope. We do not access your Google Drive, Gmail,
            or any other Google services. Google's use of your data is governed by Google's Privacy Policy.
          </Section>

          <Section title="7. Data Retention">
            We retain your account and trade data for as long as your account is active. You may request deletion
            of your account and all associated data at any time by emailing{" "}
            <span className="text-indigo-400">support@tradersdiary.in</span>. We will process deletion within 30 days.
          </Section>

          <Section title="8. Your Rights">
            Under applicable Indian data protection laws, you have the right to:
            <ul className="space-y-2 mt-2">
              <Li>Access the personal data we hold about you.</Li>
              <Li>Correct inaccurate data.</Li>
              <Li>Request deletion of your data.</Li>
              <Li>Export your trade data in CSV format.</Li>
            </ul>
            To exercise any of these rights, contact us at{" "}
            <span className="text-indigo-400">support@tradersdiary.in</span>.
          </Section>

          <Section title="9. Cookies">
            We use session cookies for authentication only. We do not use tracking or advertising cookies.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this Privacy Policy. We will notify you of significant changes via email or an in-app
            notice. Continued use of the platform after changes constitutes acceptance.
          </Section>

          <Section title="11. Contact">
            For any privacy-related questions or concerns, contact us at{" "}
            <span className="text-indigo-400">support@tradersdiary.in</span>.
          </Section>

        </div>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-bold text-slate-200 mb-3">{title}</h2>
      <div>{children}</div>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-indigo-500 mt-0.5 flex-shrink-0">·</span>
      <span>{children}</span>
    </li>
  )
}
