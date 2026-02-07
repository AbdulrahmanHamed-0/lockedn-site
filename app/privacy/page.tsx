import Link from "next/link";

export default function PrivacyPolicyPage() {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-4xl h-[86vh]
                     bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
                     rounded-2xl border border-cyan/75
                     shadow-[0_0_18px_rgba(255,255,255,0.18)]
                     flex flex-col overflow-hidden"
        >
          {/* HEADER */}
          <div
            className="flex-shrink-0 bg-gradient-to-r from-cyan-700/25 to-cyan-500/15
                       backdrop-blur-md border-b border-white/15
                       px-6 md:px-8 py-6 md:py-7
                       flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-cyan-300">
                Privacy Policy
              </h1>
              <p className="mt-2 text-[0.65rem] md:text-xs text-slate-300/80">
                Last updated :{" "}
                <span className="font-semibold text-white">
                 February 3, 2026
                </span>
              </p>
            </div>
  
            {/* Static close icon just for looks; remove this <div> if you don't want it */}
            <Link
  href="/"
  className="p-2 rounded-full border border-white/40 text-white/75
             bg-white/10 backdrop-blur-sm
             hover:bg-white/25 hover:text-white
             hover:shadow-[0_0_10px_rgba(34,211,238,0.6)]
             hover:scale-110
             transition-all duration-200"
  aria-label="Back to Locked'n home"
>
  <svg
    className="w-4 h-4 text-white/80"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
</Link>

          </div>
  
          {/* BODY */}
          <div
            className="flex-1 overflow-y-auto px-6 md:px-8 py-6 md:py-8"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#e5e7eb rgba(15,23,42,0.75)",
            }}
          >
            <div className="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
              {/* Intro */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <p>
                  At Locked&apos;n, we are committed to protecting your privacy
                  and being transparent about how we collect, use, and protect
                  your personal information. This Privacy Policy explains our data
                  practices when you use our app and website.
                </p>
              </section>
  
              {/* 1. Info we collect */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  1. Information We Collect
                </h2>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2 mt-2">
                  1.1 Information You Provide
                </h3>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>
                    <strong>Account information:</strong> Name, email address,
                    age, and basic profile details you provide when creating your
                    account.
                  </li>
                  <li>
                    <strong>Profile data:</strong> Fitness level, goals, height,
                    weight, and other optional fitness details that help us
                    personalize your experience.
                  </li>
                  <li>
                    <strong>Payment information:</strong> Subscription and billing
                    details processed securely by third‑party payment providers
                    (we do not store full card numbers).
                  </li>
                  <li>
                    <strong>Support &amp; feedback:</strong> Information you share
                    when you contact us for help, give feedback, or respond to
                    surveys.
                  </li>
                </ul>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2 mt-4">
                  1.2 Information Collected Automatically
                </h3>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>
                    <strong>Workout data:</strong> Exercise type, reps, sets,
                    duration, and performance statistics generated while you use
                    the app.
                  </li>
                  <li>
                    <strong>Device information:</strong> Device model, operating
                    system, app version, language, and unique device identifiers.
                  </li>
                  <li>
                    <strong>Usage information:</strong> Features you use, screens
                    you view, and general interaction patterns that help us
                    improve the app.
                  </li>
                  <li>
                    <strong>Diagnostics:</strong> Crash logs and performance data
                    to detect and fix technical issues.
                  </li>
                </ul>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2 mt-4">
                  1.3 Camera and Video Data
                </h3>
                <div className="bg-cyan-900/20 p-4 rounded-lg border border-cyan-500/30 my-3">
                  <p className="font-semibold text-cyan-400 mb-1">
                    🔒 Real‑time only, processed on your device
                  </p>
                  <p>
                    Locked&apos;n uses your device&apos;s camera to analyze your
                    exercise form with AI. Video data is processed locally on your
                    device in real‑time and is not stored or uploaded to our
                    servers unless you explicitly choose to save or share
                    recordings through optional features.
                  </p>
                </div>
              </section>
  
              {/* 2. How we use info */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  2. How We Use Your Information
                </h2>
                <p className="mb-3">
                  We use the information we collect for the following purposes:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>
                    <strong>Provide and improve the service:</strong> Deliver
                    AI‑powered form analysis, rep counting, workout tracking, and
                    personalized recommendations.
                  </li>
                  <li>
                    <strong>Account management:</strong> Create and manage your
                    account, process subscriptions, and handle billing.
                  </li>
                  <li>
                    <strong>Personalization:</strong> Tailor workouts, goals, and
                    content to your preferences and performance over time.
                  </li>
                  <li>
                    <strong>Analytics and performance:</strong> Understand how the
                    app is used so we can improve features and stability.
                  </li>
                  <li>
                    <strong>Communication:</strong> Send important notices,
                    updates, and information related to your account or
                    subscription. You can opt out of marketing emails at any time.
                  </li>
                  <li>
                    <strong>Security and fraud prevention:</strong> Detect,
                    investigate, and prevent misuse, fraud, or security issues.
                  </li>
                  <li>
                    <strong>Legal compliance:</strong> Comply with legal
                    obligations and enforce our Terms of Service.
                  </li>
                </ul>
              </section>
  
              {/* 3. Data storage & security */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  3. Data Storage and Security
                </h2>
                <p className="mb-3">
                  We take appropriate technical and organizational measures to
                  protect your personal information:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                  <li>
                    <strong>Encryption in transit:</strong> Data sent between your
                    device and our servers is encrypted using modern TLS/SSL
                    protocols.
                  </li>
                  <li>
                    <strong>Secure storage:</strong> Account and subscription data
                    is stored on secure infrastructure with restricted access.
                  </li>
                  <li>
                    <strong>Access controls:</strong> Only authorized personnel
                    can access personal data, and only when necessary.
                  </li>
                  <li>
                    <strong>Local video processing:</strong> Workout video is
                    processed on your device to reduce exposure of sensitive
                    information.
                  </li>
                </ul>
                <p className="text-xs md:text-sm text-yellow-400">
                  While we work hard to protect your information, no method of
                  transmission or storage is 100% secure. You are responsible for
                  keeping your device and account credentials safe.
                </p>
              </section>
  
              {/* 4. Sharing & disclosure */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  4. How We Share Your Information
                </h2>
                <p className="mb-3">
                  We do <span className="font-semibold">not</span> sell your
                  personal information. We may share data only in these cases:
                </p>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2">
                  4.1 Service Providers
                </h3>
                <p className="mb-2">
                  We work with trusted third‑party providers to help us operate
                  and improve Locked&apos;n, such as:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                  <li>Cloud hosting and database providers</li>
                  <li>Payment processors and subscription platforms</li>
                  <li>Customer support and analytics tools</li>
                </ul>
                <p className="text-sm mb-3">
                  These providers may process personal data on our behalf and are
                  contractually required to protect it and use it only for the
                  services they provide to us.
                </p>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2">
                  4.2 Legal Requirements
                </h3>
                <p className="mb-3">
                  We may disclose your information if required by law, regulation,
                  legal process, or government request, or when we believe it is
                  necessary to:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                  <li>Comply with a legal obligation</li>
                  <li>
                    Protect the rights, property, or safety of Locked&apos;n, our
                    users, or the public
                  </li>
                  <li>Detect and address fraud, security, or technical issues</li>
                </ul>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2">
                  4.3 Business Transfers
                </h3>
                <p className="mb-3">
                  If we are involved in a merger, acquisition, or sale of assets,
                  your information may be transferred as part of that deal. We
                  will notify you of any such change and any choices you may have.
                </p>
  
                <h3 className="text-base md:text-lg font-semibold text-cyan-300 mb-2">
                  4.4 With Your Consent
                </h3>
                <p>
                  We may share your information for any other purpose disclosed to
                  you at the time of collection, with your consent or direction
                  (for example, when you share progress to social media).
                </p>
              </section>
  
              {/* 5. Your rights & choices */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  5. Your Rights and Choices
                </h2>
                <p className="mb-3">
                  Depending on your location, you may have some or all of the
                  rights below regarding your personal information:
                </p>
                <ul className="space-y-3 ml-4">
                  <li>
                    <strong className="text-cyan-300">Access:</strong> Request a
                    copy of the personal information we hold about you.
                  </li>
                  <li>
                    <strong className="text-cyan-300">Correction:</strong> Ask us
                    to correct inaccurate or incomplete information.
                  </li>
                  <li>
                    <strong className="text-cyan-300">Deletion:</strong> Request
                    deletion of your data, subject to certain legal exceptions.
                  </li>
                  <li>
                    <strong className="text-cyan-300">Portability:</strong>{" "}
                    Request your data in a structured, commonly used,
                    machine‑readable format where technically feasible.
                  </li>
                  <li>
                    <strong className="text-cyan-300">Restriction/Object:</strong>{" "}
                    In some cases, request that we restrict or stop certain
                    processing activities.
                  </li>
                  <li>
                    <strong className="text-cyan-300">Marketing:</strong> Opt out
                    of marketing emails by clicking the unsubscribe link or
                    updating your preferences.
                  </li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, contact us at{" "}
                  <span className="text-cyan-400">lockedn.app@gmail.com</span>.
                  We may need to verify your identity before responding.
                </p>
              </section>
  
              {/* 6. Data retention */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  6. Data Retention
                </h2>
                <p className="mb-3">
                  We keep your personal information only as long as necessary to:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                  <li>Provide and maintain your account and our services</li>
                  <li>Comply with legal, tax, and accounting obligations</li>
                  <li>Resolve disputes and enforce our agreements</li>
                </ul>
                <p>
                  When your data is no longer needed, we will delete or anonymize
                  it in line with our data retention policies, unless a longer
                  retention period is required or permitted by law.
                </p>
              </section>
  
              {/* 7. Children's privacy */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  7. Children&apos;s Privacy
                </h2>
                <p>
                  Locked&apos;n is not intended for children under the age of 13
                  (or the minimum age of digital consent in your country). We do
                  not knowingly collect personal information from children. If we
                  learn that we have collected data from a child without verifiable
                  parental consent, we will delete it as soon as possible.
                </p>
                <p className="mt-3">
                  If you believe a child has provided us with personal information,
                  please contact us at{" "}
                  <span className="text-cyan-400">lockedn.app@gmail.com</span>.
                </p>
              </section>
  
              {/* 8. International transfers */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  8. International Data Transfers
                </h2>
                <p>
                  We may process and store your information in countries other
                  than where you live. These countries may have data protection
                  laws that are different from those in your country. When we
                  transfer data, we take steps to ensure it receives an adequate
                  level of protection in line with this Privacy Policy and
                  applicable laws.
                </p>
              </section>
  
              {/* 9. Third‑party links */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  9. Third‑Party Services and Links
                </h2>
                <p>
                  Our app and website may contain links to third‑party websites or
                  services (such as social media platforms, payment providers, or
                  health integrations). We are not responsible for the privacy
                  practices of those third parties. We encourage you to read their
                  privacy policies before providing any personal information.
                </p>
              </section>
  
              {/* 10. Changes to this policy */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  10. Changes to This Privacy Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time to reflect
                  changes in our practices, technologies, or legal requirements.
                  When we make material changes, we will notify you by updating
                  the &quot;Last updated&quot; date and, where appropriate, by
                  sending an email or showing an in‑app notification.
                </p>
                <p className="mt-3">
                  Your continued use of Locked&apos;n after any changes to this
                  policy means you accept the updated version.
                </p>
              </section>
  
              {/* 11. Contact us */}
              <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
                <h2 className="text-xl md:text-2xl font-bold text-cyan-400 mb-3">
                  11. Contact Us
                </h2>
                <p className="mb-3">
                  If you have any questions, concerns, or requests regarding this
                  Privacy Policy or how we handle your data, please contact us:
                </p>
                <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10">
                  <p className="text-slate-300 text-sm">
                    Email: lockedn.app@gmail.com
                  </p>
                  <p className="text-slate-300 text-sm">
                    Response time: within 48 hours
                  </p>
                </div>
              </section>
  
              {/* Footer note */}
              <section className="border-t border-white/10 pt-5 mt-4 text-sm text-slate-300">
                <p>
                  By using Locked&apos;n, you acknowledge that you have read and
                  understood this Privacy Policy. We are committed to protecting
                  your data and giving you a transparent, privacy‑first fitness
                  experience.
                </p>
                <p className="text-cyan-300 mt-3 font-semibold">
                  Thank you for trusting Locked&apos;n with your fitness journey! 💪
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    );
  }
  
