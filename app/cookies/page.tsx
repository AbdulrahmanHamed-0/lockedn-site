import Link from "next/link";

export default function CookiePolicyPage() {
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
                Cookie Policy
              </h1>
              <p className="mt-2 text-[0.65rem] md:text-xs text-slate-300/80">
                Last updated :{" "}
                <span className="font-semibold text-white">
                  January 25, 2026
                </span>
              </p>
            </div>
  
            {/* Static close icon just for looks (no modal here). 
                You can remove this <div> completely if you don't want it. */}
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
          <div
        className="flex-1 overflow-y-auto px-6 md:px-8 py-6 md:py-8"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#e5e7eb rgba(15,23,42,0.75)",
        }}
      >
        <div className="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
          {/* 1. We don't use cookies */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              1. We Don&apos;t Use Cookies
            </h3>
            <p className="mb-3">
              Locked&apos;n does not currently use cookies or similar tracking
              technologies on this website or in our application.
            </p>
            <p className="mb-3">
              This means we do not place any tracking files on your device to
              monitor your browsing behavior, collect analytics, or serve
              targeted advertisements through our own systems.
            </p>
            <div className="bg-cyan-900/20 p-4 rounded-lg border border-cyan-500/30">
              <p className="font-semibold text-cyan-300">
                Our focus is on delivering a privacy‑first fitness experience
                with minimal data collection.
              </p>
            </div>
          </section>

          {/* 2. What are cookies */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              2. What Are Cookies?
            </h3>
            <p>
              Cookies are small text files that websites place on your device to
              store information about your preferences, login status, and
              browsing activity. They can be used for a variety of purposes,
              including:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>
                <strong>Essential cookies:</strong> Required for basic website
                functionality
              </li>
              <li>
                <strong>Analytics cookies:</strong> Help understand how visitors
                use the site
              </li>
              <li>
                <strong>Advertising cookies:</strong> Used to deliver
                personalized ads
              </li>
              <li>
                <strong>Preference cookies:</strong> Remember your settings and
                choices
              </li>
            </ul>
          </section>

          {/* 3. Our current approach */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              3. Our Current Approach
            </h3>
            <p className="mb-3">
              At Locked&apos;n, we&apos;ve designed our service to respect your
              privacy by:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Not using cookies or similar tracking technologies</li>
              <li>
                Processing all workout video data locally on your device rather
                than on our servers
              </li>
              <li>
                Storing only essential account and workout data on our secure
                servers
              </li>
              <li>
                Not serving targeted advertisements or using third‑party ad
                networks
              </li>
              <li>
                Limiting data collection to what&apos;s necessary to provide our
                AI fitness coaching service
              </li>
            </ul>
          </section>

          {/* 4. Future changes */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              4. Future Changes
            </h3>
            <p className="mb-3">
              If we decide to introduce cookies in the future, we will:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                Update this Cookie Policy with details on what cookies we use
                and why
              </li>
              <li>
                Notify you prominently through email and in‑app notifications
              </li>
              <li>
                Provide clear options to accept or decline non‑essential cookies
              </li>
              <li>
                Offer granular controls to manage your cookie preferences
              </li>
              <li>
                Use cookies only for legitimate purposes such as improving app
                performance, understanding aggregated usage patterns, and
                remembering your preferences
              </li>
            </ul>
            <p className="mt-3">
              Any future use of cookies will be transparent and in full
              compliance with applicable privacy laws (such as GDPR and CCPA).
            </p>
          </section>

          {/* 5. Third‑party websites */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
              <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              5. Third‑Party Websites and Services
            </h3>
            <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-500/30 mb-3">
              <p className="font-semibold text-yellow-300">
                ⚠️ Important: Other services may still use cookies.
              </p>
            </div>
            <p className="mb-3">
              While Locked&apos;n does not use cookies, third‑party websites
              linked from our site or app may use their own cookies and tracking
              technologies. This includes:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
              <li>
                <strong>Social media:</strong> Instagram, TikTok, YouTube, etc.
              </li>
              <li>
                <strong>Payment processors:</strong> Stripe, PayPal, Apple Pay,
                Google Pay
              </li>
              <li>
                <strong>Health integrations:</strong> Apple Health, Google Fit
                (if applicable)
              </li>
              <li>
                <strong>Analytics services:</strong> Should we adopt them in the
                future
              </li>
            </ul>
            <p>
              These third‑party services operate independently and follow their
              own privacy and cookie policies. We encourage you to review those
              policies when using external links.
            </p>
          </section>

          {/* 6. Browser settings */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              6. Your Browser Settings
            </h3>
            <p className="mb-3">
              You can control how cookies are handled for all websites through
              your browser settings:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong>Chrome:</strong> Settings → Privacy and Security →
                Cookies and other site data
              </li>
              <li>
                <strong>Firefox:</strong> Settings → Privacy &amp; Security →
                Cookies and Site Data
              </li>
              <li>
                <strong>Safari:</strong> Preferences → Privacy → Cookies and
                website data
              </li>
              <li>
                <strong>Edge:</strong> Settings → Cookies and site permissions →
                Cookies and site data
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Blocking cookies on other websites may affect their functionality,
              but it will not impact your experience with Locked&apos;n since we
              don&apos;t use cookies.
            </p>
          </section>

          {/* 7. Mobile app storage */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              7. Mobile App Data Storage
            </h3>
            <p className="mb-3">
              The Locked&apos;n mobile app stores necessary data locally on your
              device to provide core functionality:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>
                <strong>Login credentials:</strong> Securely stored to keep you
                signed in
              </li>
              <li>
                <strong>App preferences:</strong> Your settings and
                customizations
              </li>
              <li>
                <strong>Cached data:</strong> Temporary files to improve
                performance
              </li>
              <li>
                <strong>Workout history:</strong> Local copy of recent workouts
                for quick access
              </li>
            </ul>
            <p className="mt-3">
              This local storage is essential for the app to function and is not
              the same as web cookies. You can clear this data by logging out or
              uninstalling the app.
            </p>
          </section>

          {/* 8. Do Not Track */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              8. Do Not Track Signals
            </h3>
            <p>
              Some browsers offer &quot;Do Not Track&quot; (DNT) settings that
              request websites not to track your browsing. Since Locked&apos;n
              does not use cookies or tracking technologies, we do not track you
              regardless of DNT settings. Third‑party services you interact with
              may respond to DNT signals differently.
            </p>
          </section>

          {/* 9. Regional privacy laws */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              9. Regional Privacy Laws
            </h3>
            <p className="mb-3">
              Our cookie‑free approach helps us align with major privacy
              regulations:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong>GDPR (EU):</strong> No cookie consent banner required
                when no cookies are used
              </li>
              <li>
                <strong>CCPA (California):</strong> We do not sell personal
                information or use tracking cookies
              </li>
              <li>
                <strong>ePrivacy Directive (EU):</strong> No storage of tracking
                cookies on your device
              </li>
              <li>
                <strong>Other laws:</strong> Our minimal data collection supports
                global privacy‑by‑design best practices
              </li>
            </ul>
          </section>

          {/* 10. Questions / contact */}
          <section className="border border-white/5 rounded-2xl bg-slate-900/40 px-4 py-4 md:px-6 md:py-5 shadow-[0_0_12px_rgba(0,0,0,0.55)]">
          <h3 className="text-xl md:text-2x1 font-bold text-cyan-400 mb-3">
              10. Questions About Cookies?
            </h3>
            <p className="mb-3">
              If you have any questions about this Cookie Policy or our data
              practices, please contact us:
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

          {/* Footer */}
          <section className="border-t border-white/10 pt-5 mt-4 text-sm text-slate-300">
            <p>
              We&apos;re committed to building a privacy‑first fitness platform.
              By not using cookies, we&apos;re putting your privacy ahead of
              unnecessary tracking.
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
  
