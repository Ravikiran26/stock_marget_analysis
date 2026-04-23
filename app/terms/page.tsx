import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service | Traders Diary",
  description: "Terms of Service, Refund Policy, and usage guidelines for Traders Diary.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#060c18] py-16 px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">← Back to home</Link>
          <h1 className="text-3xl font-black text-slate-100 mt-4 mb-2">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: April 24, 2026</p>
        </div>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">

          <Section title="1. Acceptance of Terms">
            By accessing or using Traders Diary ("Platform") at tradersdiary.in, you agree to be bound by
            these Terms of Service. If you do not agree, do not use the Platform.
          </Section>

          <Section title="2. Not Investment Advice">
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-5 py-4 text-amber-300/80 mt-2">
              Traders Diary is a <strong>journaling and educational tool only</strong>. Nothing on this platform
              constitutes investment advice, stock tips, or trading recommendations. We are not SEBI-registered
              investment advisors. All AI-generated insights are for self-reflection and learning purposes.
              Trading in financial markets involves substantial risk of loss. Past performance displayed in your
              journal does not guarantee future results.
            </div>
          </Section>

          <Section title="3. Eligibility">
            You must be at least 18 years old and legally permitted to trade in Indian financial markets to use
            this Platform. By signing up, you confirm you meet these requirements.
          </Section>

          <Section title="4. Your Account">
            <ul className="space-y-2 mt-2">
              <Li>You are responsible for maintaining the security of your Google account used to sign in.</Li>
              <Li>You are responsible for all activity that occurs under your account.</Li>
              <Li>You must not share your account with others or use the Platform on behalf of third parties.</Li>
              <Li>We reserve the right to suspend or terminate accounts that violate these terms.</Li>
            </ul>
          </Section>

          <Section title="5. Subscription & Pricing">
            <ul className="space-y-2 mt-2">
              <Li>The Free plan includes limited AI analyses (10 per account).</Li>
              <Li>The Pro plan (₹499/month) provides unlimited AI analyses and advanced features.</Li>
              <Li>The Elite plan (₹999/month) provides all Pro features plus priority support and advanced analytics.</Li>
              <Li>Subscriptions are billed monthly. Prices are in Indian Rupees (INR) inclusive of applicable taxes.</Li>
              <Li>We reserve the right to change pricing with 30 days' notice to existing subscribers.</Li>
            </ul>
          </Section>

          <Section title="6. Refund & Cancellation Policy">
            <div className="bg-[#0d1528] border border-[#1c2e4a] rounded-xl px-5 py-4 space-y-3 mt-2">
              <p><strong className="text-slate-300">Cancellation:</strong> You may cancel your subscription at any
              time from your account settings. Cancellation takes effect at the end of your current billing period.
              You retain access to Pro/Elite features until the period ends.</p>

              <p><strong className="text-slate-300">Refunds:</strong> We offer a <strong className="text-slate-300">7-day
              money-back guarantee</strong> for first-time subscribers. If you are unsatisfied within 7 days of
              your first payment, contact us at <span className="text-indigo-400">support@tradersdiary.in</span> for
              a full refund.</p>

              <p><strong className="text-slate-300">No refunds</strong> are issued for partial months after the
              7-day window, or for accounts found to be in violation of these Terms.</p>

              <p><strong className="text-slate-300">Refund processing:</strong> Approved refunds are processed
              within 5–7 business days to the original payment method via Razorpay.</p>
            </div>
          </Section>

          <Section title="7. Acceptable Use">
            You agree not to:
            <ul className="space-y-2 mt-2">
              <Li>Use the Platform for any unlawful purpose or in violation of SEBI regulations.</Li>
              <Li>Attempt to reverse-engineer, scrape, or extract data from the Platform.</Li>
              <Li>Upload false, fabricated, or misleading trade data.</Li>
              <Li>Share AI-generated insights publicly as investment advice.</Li>
              <Li>Attempt to gain unauthorized access to other users' accounts or data.</Li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            All Platform content, design, code, and AI analysis outputs are owned by Traders Diary. Your trade
            data remains yours — we claim no ownership over data you upload. You grant us a limited licence to
            process your data solely to provide the service.
          </Section>

          <Section title="9. Data & Privacy">
            Our collection and use of your personal data is described in our{" "}
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300">Privacy Policy</Link>,
            which is incorporated into these Terms by reference.
          </Section>

          <Section title="10. Limitation of Liability">
            To the maximum extent permitted by law, Traders Diary shall not be liable for any trading losses,
            financial decisions, or damages arising from your use of the Platform or reliance on AI-generated
            insights. Our total liability to you shall not exceed the amount you paid us in the 3 months
            preceding the claim.
          </Section>

          <Section title="11. Governing Law">
            These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive
            jurisdiction of courts in Hyderabad, Telangana.
          </Section>

          <Section title="12. Changes to Terms">
            We may update these Terms. Continued use of the Platform after changes constitutes acceptance.
            We will notify you of material changes via email.
          </Section>

          <Section title="13. Contact">
            For any questions about these Terms, contact us at{" "}
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
