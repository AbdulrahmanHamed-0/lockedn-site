import Link from "next/link";


export default function TermsOfServicePage() {
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
                Terms of Service
              </h1>
              <p className="mt-2 text-[0.65rem] md:text-xs text-slate-300/80">
                Last updated :{" "}
                <span className="font-semibold text-white">
                  January 25, 2026
                </span>
              </p>
            </div>
  
            {/* Static close icon (visual only, no modal here).
                Remove this <div> if you don't want the X. */}
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
      {/* ⬇️ removed the old top 'Last Updated' line + welcome blurb */}

      <section
      id="terms-3"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
       <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
          1. Acceptance of Terms
        </h3>
        <p>
          By accessing or using our AI-powered fitness application, you
          agree to be bound by these Terms of Service. If you do not agree
          to these terms, please do not use our service. These terms apply
          to all users, including those who are merely browsing our website
          or application.
        </p>
      </section>

      <section
      id="terms-3"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
        <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
          2. Service Description
        </h3>
        <p>
          Locked&apos;n is an AI-powered fitness training application that
          utilizes computer vision and machine learning technology to
          provide real-time exercise form analysis, rep counting, and
          personalized workout guidance through your device&apos;s camera.
          Our service includes:
        </p>
        <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
          <li>AI-powered pose detection and form correction</li>
          <li>Automatic repetition counting</li>
          <li>Exercise library with guided instructions</li>
          <li>Progress tracking and workout history</li>
          <li>Personalized fitness recommendations</li>
        </ul>
      </section>

    {/* 3. User Responsibilities */}
    <section
      id="terms-3"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
   <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        3. User Responsibilities
      </h3>
      <p className="mb-3">
        As a user of Locked&apos;n, you agree to:
      </p>
      <ul className="list-disc list-inside ml-4 space-y-1.5">
        <li>Provide accurate and complete information during registration</li>
        <li>Maintain the confidentiality of your account credentials</li>
        <li>Use the service only for lawful purposes</li>
        <li>
          Not attempt to reverse engineer, modify, or tamper with our AI
          technology
        </li>
        <li>Ensure you have adequate space and a safe environment for exercise</li>
        <li>
          Consult with healthcare professionals before starting any fitness
          program
        </li>
      </ul>
    </section>

    {/* 4. Health & Safety */}
    <section
      id="terms-4"
      className="border border-amber-400/40 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_16px_rgba(245,158,11,0.25)]"
    >
      <h3 className="text-base md:text-xl font-semibold text-amber-300 mb-2">
        4. Health and Safety Disclaimer
      </h3>
      <p className="mb-3 font-semibold text-amber-200">
        IMPORTANT: Locked&apos;n is not a medical service.
      </p>
      <p className="mb-3">
        Locked&apos;n is designed to assist with fitness training but is
        not a substitute for professional medical advice, diagnosis, or
        treatment. Before beginning any exercise program, you should
        consult with your physician or healthcare provider, especially if
        you:
      </p>
      <ul className="list-disc list-inside ml-4 space-y-1.5 mb-3">
        <li>Have any pre-existing health conditions</li>
        <li>Are pregnant or nursing</li>
        <li>
          Have a history of heart disease, high blood pressure, or other
          cardiovascular issues
        </li>
        <li>Have experienced recent surgery or injury</li>
        <li>
          Are taking any medications that may affect your ability to
          exercise
        </li>
      </ul>
      <p>
        You acknowledge that physical exercise involves inherent risks of
        injury. You assume all risks associated with using our service and
        agree to exercise at your own risk. Locked&apos;n and its creators
        shall not be liable for any injuries sustained while using the
        application.
      </p>
    </section>

    {/* 5. Privacy & Data */}
    <section
      id="terms-5"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
     <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        5. Privacy and Data Collection
      </h3>
      <p className="mb-3">
        We take your privacy seriously. Our AI technology processes video
        data locally on your device for pose detection and form analysis.
        We collect and store:
      </p>
      <ul className="list-disc list-inside ml-4 space-y-1.5 mb-3">
        <li>Account information (name, email, age, fitness goals)</li>
        <li>Workout statistics and progress metrics</li>
        <li>Device information and usage analytics</li>
      </ul>
      <p>
        We do not store or transmit video recordings of your workouts. All
        video processing occurs in real-time on your device. For complete
        details on how we handle your data, please review our Privacy
        Policy.
      </p>
    </section>

    {/* 6. Camera Permissions */}
    <section
      id="terms-6"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
     <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        6. Camera Permissions
      </h3>
      <p>
        To provide our core functionality, Locked&apos;n requires access
        to your device&apos;s camera. By granting camera permissions, you
        confirm that:
      </p>
      <ul className="list-disc list-inside ml-4 mt-2 space-y-1.5">
        <li>You are the owner or authorized user of the device</li>
        <li>
          You consent to the app accessing your camera for pose detection
          purposes only
        </li>
        <li>
          No video data will be recorded, stored, or transmitted without
          your explicit consent
        </li>
        <li>
          You can revoke camera permissions at any time through your
          device settings
        </li>
      </ul>
    </section>

    {/* 7. Subscription & Payments */}
    <section
      id="terms-7"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
     <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        7. Subscription and Payments
      </h3>
      <p className="mb-3">
        Locked&apos;n offers various subscription plans with different
        features and pricing tiers. By subscribing, you agree to:
      </p>
      <ul className="list-disc list-inside ml-4 space-y-1.5 mb-3">
        <li>Pay all applicable fees for your chosen subscription plan</li>
        <li>Provide accurate and current payment information</li>
        <li>
          Automatic renewal of your subscription unless cancelled prior to
          the renewal date
        </li>
        <li>
          No refunds for partial subscription periods, except as required
          by law
        </li>
      </ul>
      <p>
        You may cancel your subscription at any time through your account
        settings. Cancellations will take effect at the end of the current
        billing period.
      </p>
    </section>

    {/* 8. IP */}
    <section
      id="terms-8"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
       <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        8. Intellectual Property
      </h3>
      <p>
        All content, features, and functionality of Locked&apos;n,
        including but not limited to software, AI algorithms, design,
        graphics, text, and logos, are owned by Locked&apos;n and protected
        by international copyright, trademark, and other intellectual
        property laws. You may not:
      </p>
      <ul className="list-disc list-inside ml-4 mt-2 space-y-1.5">
        <li>Copy, modify, or distribute any part of our service</li>
        <li>Use our trademarks without written permission</li>
        <li>Attempt to extract or reverse engineer our AI technology</li>
        <li>Create derivative works based on our service</li>
      </ul>
    </section>

    {/* 9. Liability */}
    <section
      id="terms-9"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
      <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        9. Limitation of Liability
      </h3>
      <p className="font-semibold">
To the maximum extent permitted by law, Locked&apos;n and its
affiliates, officers, employees, and agents shall not be liable
for any indirect, incidental, special, consequential, or punitive
damages, including but not limited to personal injury, loss of
data, or loss of profits, arising from your use of our service.
</p>

      <p className="mt-3">
        Some jurisdictions do not allow the exclusion of certain warranties
        or limitation of liability for incidental or consequential damages.
        In such cases, our liability shall be limited to the greatest
        extent permitted by law.
      </p>
    </section>

    {/* 10. UGC */}
    <section
      id="terms-10"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
     <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        10. User‑Generated Content
      </h3>
      <p>
        If you choose to share workout results, progress photos, or other
        content through our community features, you grant Locked&apos;n a
        non-exclusive, worldwide, royalty-free license to use, reproduce,
        and display such content for promotional purposes. You represent
        that you own all rights to the content you share and that it does
        not violate any third-party rights.
      </p>
    </section>

    {/* 11. Termination */}
    <section
      id="terms-11"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
      <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        11. Termination
      </h3>
      <p className="mb-3">
        We reserve the right to terminate or suspend your account at any
        time, without prior notice, for conduct that we believe:
      </p>
      <ul className="list-disc list-inside ml-4 space-y-1.5">
        <li>Violates these Terms of Service</li>
        <li>Is harmful to other users or our business</li>
        <li>Involves fraudulent or illegal activity</li>
        <li>Exposes us to legal liability</li>
      </ul>
      <p className="mt-3">
        Upon termination, your right to use the service will immediately
        cease, and we may delete your account data in accordance with our
        data retention policies.
      </p>
    </section>

    {/* 12. Modifications */}
    <section
      id="terms-12"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
      <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        12. Modifications to Terms
      </h3>
      <p>
        We reserve the right to modify these Terms of Service at any time.
        We will notify users of significant changes via email or through
        in-app notifications. Your continued use of Locked&apos;n after
        such modifications constitutes your acceptance of the updated
        terms. We encourage you to review these terms periodically.
      </p>
    </section>

    {/* 13. Third‑party services */}
    <section
      id="terms-13"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
      <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        13. Third‑Party Services
      </h3>
      <p>
        Locked&apos;n may integrate with third-party services (such as
        health apps, payment processors, or analytics tools). We are not
        responsible for the practices or content of these third-party
        services. Your use of such services is subject to their respective
        terms and privacy policies.
      </p>
    </section>

    {/* 14. Governing Law */}
    <section
      id="terms-14"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
      <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        14. Governing Law
      </h3>
      <p>
        These Terms of Service shall be governed by and construed in
        accordance with the laws of the jurisdiction in which Locked&apos;n
        operates, without regard to its conflict of law provisions. Any
        disputes arising from these terms shall be resolved through binding
        arbitration, except where prohibited by law.
      </p>
    </section>

    {/* 15. Contact */}
    <section
      id="terms-15"
      className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
    >
     <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
        15. Contact Information
      </h3>
      <p className="mb-3">
        If you have any questions, concerns, or feedback regarding these
        Terms of Service, please contact us at:
      </p>
      <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10">
<p className="text-slate-300 text-sm">Email: lockedn.app@gmail.com</p>
<p className="text-slate-300 text-sm">Response time: within 48 hours</p>

</div>

    </section>

<section className="border-t border-white/10 pt-5 mt-4 text-sm text-slate-300">
<p>
By using Locked&apos;n, you acknowledge that you have read,
understood, and agree to be bound by these Terms of Service. These
terms constitute a legally binding agreement between you and
Locked&apos;n.
</p>
<p className="text-cyan-300 mt-3 font-semibold">
Thank you for trusting Locked'n with your fitness journey! 💪
</p>
</section>


  </div>
</div>
</div>
      </main>
    );
  }
  
