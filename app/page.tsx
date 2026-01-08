"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Zap,
  Target,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Youtube,
  Mail,
} from "lucide-react";

export default function FitnessAppLanding() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCookies, setShowCookies] = useState(false);

  // 👇 NEW
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);

  // track when the slide last changed (auto or click)
  const lastSlideChangeRef = useRef(0);
  const autoSlideTimerRef = useRef<number | null>(null);

  const changeSlide = (
    updater: number | ((prev: number) => number)
  ) => {
    const now = Date.now();
    // avoid double-moves if auto + click fire together
    if (now - lastSlideChangeRef.current < 300) return;
    lastSlideChangeRef.current = now;

    setCurrentSlide((prev) =>
      typeof updater === "number" ? updater : updater(prev)
    );
  };

  // Slides now match all the feature boxes (plus Progress Tracking)
  const appImages = [
    {
      title: "AI Pose Detection",
      desc: "Real-time form tracking and analysis",
      color: "from-cyan-600 to-cyan-700",
      screenshots: ["/pose1.jpg", "/pose2.jpg", "/pose3.jpg"],
    },
    {
      title: "Instant Feedback",
      desc: "Corrects your form in real time",
      color: "from-teal-600 to-cyan-700",
      screenshots: ["/feed1.jpg", "/feed2.jpg", "/feed3.PNG"],
    },
    {
      title: "Auto Rep Count",
      desc: "Never worry about counting reps again",
      color: "from-cyan-700 to-teal-600",
      // ⬇️ change these names to match your real files if they differ
      screenshots: ["/rep1.jpg", "/rep2.jpg"],
    },
    {
      title: "Train Anywhere",
      desc: "No excuses – just your phone & Wi‑Fi",
      color: "from-teal-600 to-cyan-700",
      screenshots: ["/anywhere2.jpg", "/anywhere1.png", "/anywhere3.png"],
    },
    {
      title: "Exercise Library",
      desc: "Guided variety of workouts",
      color: "from-teal-600 to-cyan-600",
      screenshots: ["/ex1.jpg", "/ex2.jpg"],
    },
    {
      title: "Progress Tracking",
      desc: "Track your gains over time",
      color: "from-cyan-600 to-teal-700",
      // ⬇️ change this name to your actual progress screenshot
      screenshots: ["/progress1.jpg"],
    },
  ];

    // For mobile: track which screenshot index is shown in each slide
    const [mobileShotIndices, setMobileShotIndices] = useState<number[]>(
      () => appImages.map(() => 0)
    );
  
  
  
    const startAutoSlide = () => {
      if (autoSlideTimerRef.current !== null) {
        clearInterval(autoSlideTimerRef.current);
      }
    
      // phones: 6s, tablet/desktop: 8s
      const isMobile = window.innerWidth < 768;
      const delay = isMobile ? 4000 : 8000;
    
      autoSlideTimerRef.current = window.setInterval(() => {
        changeSlide((prev) => (prev + 1) % appImages.length);
      }, delay);
    };
    

  const stopAutoSlide = () => {
    if (autoSlideTimerRef.current !== null) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }
  };

  const handleManualSlideChange = (
    updater: number | ((prev: number) => number)
  ) => {
    changeSlide(updater);
    startAutoSlide(); // reset timer whenever user interacts
  };

  const handleMobileShotChange = (slideIndex: number, direction: 1 | -1) => {
    setMobileShotIndices((prev) => {
      const copy = [...prev];
      const total = appImages[slideIndex].screenshots?.length ?? 0;
      if (!total) return prev;
  
      const current = copy[slideIndex] ?? 0;
      const next = (current + direction + total) % total;
      copy[slideIndex] = next;
      return copy;
    });
  
    // restart hero slider timer on mobile tap,
    // but ONLY if no modal / zoom is open
    if (!showTerms && !showPrivacy && !showCookies && !activeScreenshot) {
      startAutoSlide();
    }
  };
  
  
  useEffect(() => {
    // pause the slider while a legal modal or screenshot is open
    if (showTerms || showPrivacy || showCookies || activeScreenshot) {
      stopAutoSlide();
      return;
    }
  
    startAutoSlide();
  
    return () => {
      stopAutoSlide();
    };
  }, [showTerms, showPrivacy, showCookies, activeScreenshot]);
  
  

  // (keep your existing mouse/scroll useEffect + body overflow useEffect)

  const nextSlide = () =>
    handleManualSlideChange((prev) => (prev + 1) % appImages.length);

  const prevSlide = () =>
    handleManualSlideChange(
      (prev) => (prev - 1 + appImages.length) % appImages.length
    );

    const handleFeatureClick = (index: number) => {
      changeSlide(index);
    
      const sliderElement = document.getElementById("feature-slider");
      if (sliderElement) {
        const rect = sliderElement.getBoundingClientRect();
        // scroll so the slider sits a bit below the top of the viewport
        const offset = window.scrollY + rect.top - 80;
        window.scrollTo({ top: offset, behavior: "smooth" });
      }
    };
    
    

  const openScreenshot = (src: string) => {
    setActiveScreenshot(src);
    // pause the hero slider while zoomed
    stopAutoSlide();
  };
  
  const closeScreenshot = () => {
    setActiveScreenshot(null);
    // when you exit zoom, restart the 8s timer
    if (!showTerms && !showPrivacy && !showCookies) {
      startAutoSlide();
    }
  };
  

  const changeMobileShot = (slideIndex: number, direction: "prev" | "next") => {
    setMobileShotIndices((prev) => {
      const copy = [...prev];
      const total = appImages[slideIndex].screenshots?.length ?? 1;
      const current = copy[slideIndex] ?? 0;
  
      const next =
        direction === "next"
          ? (current + 1) % total
          : (current - 1 + total) % total;
  
      copy[slideIndex] = next;
      return copy;
    });
  
    // 🔁 restart the main slide auto‑timer
    startAutoSlide(); // or whatever your timer function is called
  };
  
  


  const handleSubmit = async () => {
    if (formData.name && formData.email) {
      try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbxXAy2uLgC7Rj3KcHbSSfeM5YFyHd0dKNGAmLzgLIps--pZiz0fi_lodCxalK5fS6I/exec', {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email
          })
        });

        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          setFormData({ name: '', email: '' });
        }, 5000);
      } catch (error) {
        console.error('Error submitting form:', error);
        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          setFormData({ name: '', email: '' });
        }, 5000);
      }
    }
  };

  const Divider = () => (
    <div className="w-full flex justify-center px-4">
    <div className="relative w-full max-w-6xl h-1 mt-0 mb-16 overflow-hidden rounded-full">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 animate-pulse"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400 blur-sm"></div>
      </div>
    </div>
  );

  const TermsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowTerms(false)}>
      <div className="relative w-full max-w-4xl h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 bg-gradient-to-r from-cyan-600/20 to-cyan-700/20 backdrop-blur-md border-b border-cyan-500/30 p-6 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
            Terms of Service
          </h2>
          <button 
            onClick={() => setShowTerms(false)}
            className="p-2 rounded-full bg-gray-800/50 hover:bg-cyan-600/50 hover:scale-110 transition-all duration-300 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/50"
          >
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8" style={{scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 rgba(31, 41, 55, 0.5)'}}>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p className="text-sm text-gray-400 italic">Last Updated: December 24, 2025</p>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">1. Acceptance of Terms</h3>
              <p>
                Welcome to Locked'n! By accessing or using our AI-powered fitness application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service. These terms apply to all users, including those who are merely browsing our website or application.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">2. Service Description</h3>
              <p>
                Locked'n is an AI-powered fitness training application that utilizes computer vision and machine learning technology to provide real-time exercise form analysis, rep counting, and personalized workout guidance through your device's camera. Our service includes:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li>AI-powered pose detection and form correction</li>
                <li>Automatic repetition counting</li>
                <li>Exercise library with guided instructions</li>
                <li>Progress tracking and workout history</li>
                <li>Personalized fitness recommendations</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">3. User Responsibilities</h3>
              <p className="mb-3">As a user of Locked'n, you agree to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Provide accurate and complete information during registration</li>
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Use the service only for lawful purposes</li>
                <li>Not attempt to reverse engineer, modify, or tamper with our AI technology</li>
                <li>Ensure you have adequate space and a safe environment for exercise</li>
                <li>Consult with healthcare professionals before starting any fitness program</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">4. Health and Safety Disclaimer</h3>
              <p className="mb-3 font-semibold text-yellow-400">IMPORTANT: Please read this section carefully.</p>
              <p className="mb-3">
                Locked'n is designed to assist with fitness training but is NOT a substitute for professional medical advice, diagnosis, or treatment. Before beginning any exercise program, you should consult with your physician or healthcare provider, especially if you:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li>Have any pre-existing health conditions</li>
                <li>Are pregnant or nursing</li>
                <li>Have a history of heart disease, high blood pressure, or other cardiovascular issues</li>
                <li>Have experienced recent surgery or injury</li>
                <li>Are taking any medications that may affect your ability to exercise</li>
              </ul>
              <p>
                You acknowledge that physical exercise involves inherent risks of injury. You assume all risks associated with using our service and agree to exercise at your own risk. Locked'n and its creators shall not be liable for any injuries sustained while using the application.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">5. Privacy and Data Collection</h3>
              <p className="mb-3">
                We take your privacy seriously. Our AI technology processes video data locally on your device for pose detection and form analysis. We collect and store:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li>Account information (name, email, age, fitness goals)</li>
                <li>Workout statistics and progress metrics</li>
                <li>Device information and usage analytics</li>
              </ul>
              <p>
                We do NOT store or transmit video recordings of your workouts. All video processing occurs in real-time on your device. For complete details on how we handle your data, please review our Privacy Policy.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">6. Camera Permissions</h3>
              <p>
                To provide our core functionality, Locked'n requires access to your device's camera. By granting camera permissions, you confirm that:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li>You are the owner or authorized user of the device</li>
                <li>You consent to the app accessing your camera for pose detection purposes only</li>
                <li>No video data will be recorded, stored, or transmitted without your explicit consent</li>
                <li>You can revoke camera permissions at any time through your device settings</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">7. Subscription and Payments</h3>
              <p className="mb-3">
                Locked'n offers various subscription plans with different features and pricing tiers. By subscribing, you agree to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li>Pay all applicable fees for your chosen subscription plan</li>
                <li>Provide accurate and current payment information</li>
                <li>Automatic renewal of your subscription unless cancelled prior to the renewal date</li>
                <li>No refunds for partial subscription periods, except as required by law</li>
              </ul>
              <p>
                You may cancel your subscription at any time through your account settings. Cancellations will take effect at the end of the current billing period.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">8. Intellectual Property</h3>
              <p>
                All content, features, and functionality of Locked'n, including but not limited to software, AI algorithms, design, graphics, text, and logos, are owned by Locked'n and protected by international copyright, trademark, and other intellectual property laws. You may not:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li>Copy, modify, or distribute any part of our service</li>
                <li>Use our trademarks without written permission</li>
                <li>Attempt to extract or reverse engineer our AI technology</li>
                <li>Create derivative works based on our service</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">9. Limitation of Liability</h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOCKED'N AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, LOSS OF DATA, OR LOSS OF PROFITS, ARISING FROM YOUR USE OF OUR SERVICE.
              </p>
              <p className="mt-3">
                Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability for incidental or consequential damages. In such cases, our liability shall be limited to the greatest extent permitted by law.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">10. User-Generated Content</h3>
              <p>
                If you choose to share workout results, progress photos, or other content through our community features, you grant Locked'n a non-exclusive, worldwide, royalty-free license to use, reproduce, and display such content for promotional purposes. You represent that you own all rights to the content you share and that it does not violate any third-party rights.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">11. Termination</h3>
              <p className="mb-3">
                We reserve the right to terminate or suspend your account at any time, without prior notice, for conduct that we believe:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Violates these Terms of Service</li>
                <li>Is harmful to other users or our business</li>
                <li>Involves fraudulent or illegal activity</li>
                <li>Exposes us to legal liability</li>
              </ul>
              <p className="mt-3">
                Upon termination, your right to use the service will immediately cease, and we may delete your account data in accordance with our data retention policies.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">12. Modifications to Terms</h3>
              <p>
                We reserve the right to modify these Terms of Service at any time. We will notify users of significant changes via email or through in-app notifications. Your continued use of Locked'n after such modifications constitutes your acceptance of the updated terms. We encourage you to review these terms periodically.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">13. Third-Party Services</h3>
              <p>
                Locked'n may integrate with third-party services (such as health apps, payment processors, or analytics tools). We are not responsible for the practices or content of these third-party services. Your use of such services is subject to their respective terms and privacy policies.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">14. Governing Law</h3>
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws of the jurisdiction in which Locked'n operates, without regard to its conflict of law provisions. Any disputes arising from these terms shall be resolved through binding arbitration, except where prohibited by law.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">15. Contact Information</h3>
              <p className="mb-3">
                If you have any questions, concerns, or feedback regarding these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-800/50 p-4 rounded-lg border border-cyan-500/30">
                <p className="font-semibold text-cyan-400">Locked'n Team</p>
                <p>Email: lockedn.app@gmail.com</p>
                <p>Response Time: Within 48 hours</p>
              </div>
            </section>

            <section className="border-t border-gray-700 pt-6 mt-8">
              <p className="text-sm text-gray-400">
                By using Locked'n, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. These terms constitute a legally binding agreement between you and Locked'n.
              </p>
              <p className="text-sm text-cyan-400 mt-4 font-semibold">
                Thank you for choosing Locked'n. Let's get locked in together! 💪
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );

  const PrivacyModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowPrivacy(false)}>
      <div className="relative w-full max-w-4xl h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 bg-gradient-to-r from-cyan-600/20 to-cyan-700/20 backdrop-blur-md border-b border-cyan-500/30 p-6 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
            Privacy Policy
          </h2>
          <button 
            onClick={() => setShowPrivacy(false)}
            className="p-2 rounded-full bg-gray-800/50 hover:bg-cyan-600/50 hover:scale-110 transition-all duration-300 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/50"
          >
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8" style={{scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 rgba(31, 41, 55, 0.5)'}}>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p className="text-sm text-gray-400 italic">Last Updated: December 24, 2025</p>
            
            <section>
              <p className="text-lg">
                At Locked'n, we are committed to protecting your privacy and being transparent about how we collect, use, and protect your personal information. This Privacy Policy explains our data practices in detail.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">1. Information We Collect</h3>
              
              <h4 className="text-xl font-semibold text-cyan-300 mb-3 mt-4">1.1 Information You Provide</h4>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, age, gender, fitness level, and goals</li>
                <li><strong>Profile Data:</strong> Height, weight, fitness preferences, and workout history</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through third-party payment processors (we do not store full credit card numbers)</li>
                <li><strong>Communications:</strong> Messages you send to our support team or feedback you provide</li>
              </ul>

              <h4 className="text-xl font-semibold text-cyan-300 mb-3 mt-4">1.2 Information Collected Automatically</h4>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Workout Data:</strong> Exercise types, repetitions, sets, duration, and form feedback</li>
                <li><strong>Device Information:</strong> Device type, operating system, app version, and unique device identifiers</li>
                <li><strong>Usage Data:</strong> Features used, time spent in app, and interaction patterns</li>
                <li><strong>Performance Data:</strong> App crashes, errors, and technical diagnostics</li>
              </ul>

              <h4 className="text-xl font-semibold text-cyan-300 mb-3 mt-4">1.3 Camera and Video Data</h4>
              <div className="bg-cyan-900/20 p-4 rounded-lg border border-cyan-500/30 my-3">
                <p className="font-semibold text-cyan-400 mb-2">🔒 Your Privacy is Protected</p>
                <p>
                  Locked'n processes all video data <strong>locally on your device</strong> in real-time for AI pose detection and form analysis. We do NOT record, store, or transmit any video footage to our servers unless you explicitly choose to save and share specific workout recordings through our optional community features.
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">2. How We Use Your Information</h3>
              <p className="mb-3">We use the collected information for the following purposes:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Service Delivery:</strong> Provide AI-powered form analysis, rep counting, and personalized workout recommendations</li>
                <li><strong>Account Management:</strong> Create and manage your account, process subscriptions, and provide customer support</li>
                <li><strong>Improvement:</strong> Analyze usage patterns to improve our AI algorithms, features, and user experience</li>
                <li><strong>Communication:</strong> Send you important updates, workout reminders, and promotional content (you can opt out anytime)</li>
                <li><strong>Safety:</strong> Detect and prevent fraud, abuse, and security issues</li>
                <li><strong>Legal Compliance:</strong> Comply with legal obligations and enforce our Terms of Service</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">3. Data Storage and Security</h3>
              <p className="mb-3">
                We implement industry-standard security measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li><strong>Encryption:</strong> All data transmitted between your device and our servers is encrypted using TLS/SSL protocols</li>
                <li><strong>Secure Storage:</strong> Your data is stored on secure cloud servers with encryption at rest</li>
                <li><strong>Access Controls:</strong> Strict access controls limit who can view your personal information</li>
                <li><strong>Regular Audits:</strong> We conduct regular security audits and vulnerability assessments</li>
                <li><strong>Local Processing:</strong> Video analysis happens entirely on your device, minimizing data transmission</li>
              </ul>
              <p className="text-sm text-yellow-400">
                Note: While we implement strong security measures, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">4. Data Sharing and Disclosure</h3>
              <p className="mb-3">
                We respect your privacy and do not sell your personal information. We may share your data only in the following circumstances:
              </p>
              
              <h4 className="text-lg font-semibold text-cyan-300 mb-2 mt-4">4.1 Service Providers</h4>
              <p className="mb-2">
                We work with trusted third-party service providers who help us operate our service:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Cloud hosting providers (e.g., AWS, Google Cloud)</li>
                <li>Payment processors (e.g., Stripe, PayPal)</li>
                <li>Analytics services (e.g., Google Analytics)</li>
                <li>Customer support tools</li>
              </ul>
              <p className="text-sm">
                These providers are contractually obligated to protect your data and use it only for the purposes we specify.
              </p>

              <h4 className="text-lg font-semibold text-cyan-300 mb-2 mt-4">4.2 Legal Requirements</h4>
              <p>
                We may disclose your information if required by law, court order, or government regulation, or if we believe disclosure is necessary to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
                <li>Comply with legal obligations</li>
                <li>Protect our rights, property, or safety</li>
                <li>Prevent fraud or illegal activity</li>
                <li>Protect the safety of our users or the public</li>
              </ul>

              <h4 className="text-lg font-semibold text-cyan-300 mb-2 mt-4">4.3 Business Transfers</h4>
              <p>
                If Locked'n is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.
              </p>

              <h4 className="text-lg font-semibold text-cyan-300 mb-2 mt-4">4.4 With Your Consent</h4>
              <p>
                If you choose to share your workout results, progress photos, or achievements through our community features or social media integrations, this content will be visible to other users or the public as you direct.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">5. Your Rights and Choices</h3>
              <p className="mb-3">You have the following rights regarding your personal information:</p>
              
              <ul className="space-y-3 ml-4">
                <li>
                  <strong className="text-cyan-300">Access:</strong> Request a copy of the personal information we hold about you
                </li>
                <li>
                  <strong className="text-cyan-300">Correction:</strong> Request correction of inaccurate or incomplete information
                </li>
                <li>
                  <strong className="text-cyan-300">Deletion:</strong> Request deletion of your account and associated data (some data may be retained for legal or legitimate business purposes)
                </li>
                <li>
                  <strong className="text-cyan-300">Portability:</strong> Request a copy of your data in a structured, machine-readable format
                </li>
                <li>
                  <strong className="text-cyan-300">Opt-Out:</strong> Unsubscribe from marketing emails at any time by clicking the unsubscribe link
                </li>
                <li>
                  <strong className="text-cyan-300">Camera Access:</strong> Revoke camera permissions through your device settings (note: this will limit app functionality)
                </li>
              </ul>

              <p className="mt-4">
                To exercise any of these rights, please contact us at <span className="text-cyan-400">privacy@lockedn.app</span>
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">6. Data Retention</h3>
              <p className="mb-3">
                We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Active Accounts:</strong> We retain your data while your account is active</li>
                <li><strong>Deleted Accounts:</strong> After account deletion, most data is removed within 30 days. Some information may be retained longer for legal compliance, fraud prevention, or dispute resolution</li>
                <li><strong>Workout Data:</strong> Historical workout data is retained to provide you with progress tracking and insights</li>
                <li><strong>Legal Requirements:</strong> Some data may be retained longer if required by law or for legitimate business purposes</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">7. Children's Privacy</h3>
              <p>
                Locked'n is not intended for users under the age of 13 (or the applicable age of digital consent in your country). We do not knowingly collect personal information from children. If we become aware that we have collected information from a child without parental consent, we will take steps to delete that information promptly.
              </p>
              <p className="mt-3">
                If you are a parent or guardian and believe your child has provided us with personal information, please contact us at <span className="text-cyan-400">privacy@lockedn.app</span>
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">8. International Data Transfers</h3>
              <p>
                Locked'n operates globally, and your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. When we transfer your data internationally, we implement appropriate safeguards to protect your information in accordance with this Privacy Policy.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">9. Third-Party Links and Services</h3>
              <p>
                Our app and website may contain links to third-party websites and services (such as social media platforms, payment processors, or health apps). This Privacy Policy does not apply to those third parties. We encourage you to review the privacy policies of any third-party services you use.
              </p>
              <p className="mt-3">
                When you click links to third-party sites like Instagram, TikTok, or YouTube, those platforms may use their own cookies and tracking technologies in accordance with their privacy policies.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">10. Changes to This Privacy Policy</h3>
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. We will notify you of significant changes by:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
                <li>Posting the updated policy on our website and in the app</li>
                <li>Sending you an email notification</li>
                <li>Displaying an in-app notification</li>
              </ul>
              <p className="mt-3">
                The "Last Updated" date at the top of this policy indicates when it was last revised. Your continued use of Locked'n after changes are made constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">11. Contact Us</h3>
              <p className="mb-3">
                If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-800/50 p-4 rounded-lg border border-cyan-500/30">
                <p className="font-semibold text-cyan-400">Locked'n Team</p>
                <p>Email: lockedn.app@gmail.com</p>    
                <p>Response Time: Within 48 hours</p>
              </div>
            </section>

            <section className="border-t border-gray-700 pt-6 mt-8">
              <p className="text-sm text-gray-400">
                By using Locked'n, you acknowledge that you have read and understood this Privacy Policy. We are committed to protecting your privacy and earning your trust.
              </p>
              <p className="text-sm text-cyan-400 mt-4 font-semibold">
                Thank you for trusting Locked'n with your fitness journey! 💪
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );

  const CookieModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowCookies(false)}>
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-gradient-to-r from-cyan-600/20 to-cyan-700/20 backdrop-blur-md border-b border-cyan-500/30 p-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
            Cookie Policy
          </h2>
          <button 
            onClick={() => setShowCookies(false)}
            className="p-2 rounded-full bg-gray-800/50 hover:bg-cyan-600/50 hover:scale-110 transition-all duration-300 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/50"
          >
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-scroll max-h-[calc(90vh-100px)] p-8" style={{scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 rgba(31, 41, 55, 0.5)'}}>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p className="text-sm text-gray-400 italic">Last Updated: December 24, 2025</p>

            <section className="bg-cyan-900/20 p-6 rounded-lg border border-cyan-500/30">
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">🍪 We Don't Use Cookies</h3>
              <p className="text-lg">
                <strong>Locked'n does not currently use cookies or similar tracking technologies on this website or in our application.</strong>
              </p>
              <p className="mt-3">
                This means we do not place any tracking files on your device to monitor your browsing behavior, collect analytics, or serve targeted advertisements through our own systems.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">What Are Cookies?</h3>
              <p>
                Cookies are small text files that websites place on your device to store information about your preferences, login status, and browsing activity. They can be used for various purposes including:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li><strong>Essential Cookies:</strong> Required for basic website functionality</li>
                <li><strong>Analytics Cookies:</strong> Help understand how visitors use the site</li>
                <li><strong>Advertising Cookies:</strong> Used to deliver personalized ads</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and choices</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Our Current Approach</h3>
              <p className="mb-3">
                At Locked'n, we've designed our service to respect your privacy by:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Not using cookies or similar tracking technologies on our website</li>
                <li>Processing all workout video data locally on your device</li>
                <li>Storing only essential account and workout data on our secure servers</li>
                <li>Not serving targeted advertisements or using third-party advertising networks</li>
                <li>Limiting data collection to what's necessary to provide our AI fitness coaching service</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Future Changes</h3>
              <p className="mb-3">
                If we decide to introduce cookies in the future, we will:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Update this Cookie Policy with detailed information about what cookies we use and why</li>
                <li>Notify you prominently through email and in-app notifications</li>
                <li>Provide clear options to accept or decline non-essential cookies</li>
                <li>Offer granular controls to manage your cookie preferences</li>
                <li>Only use cookies for legitimate purposes such as:
                  <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                    <li>Improving app performance and user experience</li>
                    <li>Understanding aggregated usage patterns (analytics)</li>
                    <li>Remembering your preferences and settings</li>
                  </ul>
                </li>
              </ul>
              <p className="mt-3">
                Any future use of cookies will be transparent and in full compliance with applicable privacy laws including GDPR, CCPA, and other regional regulations.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Third-Party Websites and Services</h3>
              <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-500/30 mb-3">
                <p className="font-semibold text-yellow-400 mb-2">⚠️ Important Notice</p>
                <p>
                  While Locked'n does not use cookies, third-party websites linked from our site or app may use their own cookies and tracking technologies.
                </p>
              </div>
              
              <p className="mb-3">
                When you click links to external platforms such as:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li><strong>Social Media:</strong> Instagram, TikTok, YouTube, Facebook</li>
                <li><strong>Payment Processors:</strong> Stripe, PayPal, Apple Pay, Google Pay</li>
                <li><strong>Health Integrations:</strong> Apple Health, Google Fit (if applicable)</li>
                <li><strong>Analytics Services:</strong> Google Analytics (if we implement it in the future)</li>
              </ul>
              
              <p>
                These third-party services operate independently and may use cookies and similar technologies in accordance with their own privacy policies and cookie policies. We are not responsible for their data collection practices.
              </p>
              
              <p className="mt-3">
                We encourage you to review the privacy and cookie policies of any third-party services you interact with:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 mt-2 text-sm">
                <li>Instagram Cookie Policy: <span className="text-cyan-400">instagram.com/legal/cookies</span></li>
                <li>TikTok Privacy Policy: <span className="text-cyan-400">tiktok.com/legal/privacy-policy</span></li>
                <li>YouTube Privacy Policy: <span className="text-cyan-400">youtube.com/privacy</span></li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Your Browser Settings</h3>
              <p className="mb-3">
                Even though Locked'n doesn't use cookies, you can control cookie settings for all websites through your browser preferences:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies and other site data</li>
                <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Cookies and website data</li>
                <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
              </ul>
              <p className="mt-3 text-sm text-gray-400">
                Note: Blocking cookies on other websites may affect their functionality, but will not impact your experience with Locked'n since we don't use them.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Mobile App Data Storage</h3>
              <p>
                The Locked'n mobile application stores necessary data locally on your device to provide core functionality:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li><strong>Login Credentials:</strong> Securely stored to keep you logged in</li>
                <li><strong>App Preferences:</strong> Your settings and customizations</li>
                <li><strong>Cached Data:</strong> Temporary data to improve performance</li>
                <li><strong>Workout History:</strong> Local copy of your recent workouts for offline access</li>
              </ul>
              <p className="mt-3">
                This local data storage is essential for the app to function properly and is not the same as web cookies. You can clear this data by logging out or uninstalling the app.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Do Not Track Signals</h3>
              <p>
                Some browsers offer "Do Not Track" (DNT) signals that request websites not to track your browsing. Since Locked'n does not use cookies or tracking technologies, we do not track you regardless of your DNT settings. However, third-party services you interact with may respond to DNT signals differently.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Regional Privacy Laws</h3>
              <p className="mb-3">
                Our cookie-free approach helps us comply with various privacy regulations:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>GDPR (EU):</strong> By not using cookies, we don't need to show cookie consent banners</li>
                <li><strong>CCPA (California):</strong> We don't sell personal information or use tracking cookies</li>
                <li><strong>ePrivacy Directive (EU):</strong> No cookie consent required since we don't use them</li>
                <li><strong>LGPD (Brazil):</strong> Minimal data collection aligns with data minimization principles</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Questions About Cookies?</h3>
              <p className="mb-3">
                If you have any questions about this Cookie Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-800/50 p-4 rounded-lg border border-cyan-500/30">
                <p className="font-semibold text-cyan-400">Locked'n Team</p>
                <p>Email: lockedn.app@gmail.com</p>
                <p>Response Time: Within 48 hours</p>
              </div>
            </section>

            <section className="border-t border-gray-700 pt-6 mt-8">
              <p className="text-sm text-gray-400">
                We're committed to building a privacy-first fitness platform. By not using cookies, we're putting your privacy ahead of unnecessary data collection.
              </p>
              <p className="text-sm text-cyan-400 mt-4 font-semibold">
                Thank you for trusting Locked'n with your fitness journey! 💪🍪
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 overflow-hidden">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-cyan-600/20 to-cyan-700/20 backdrop-blur-md border-b border-cyan-500/30 p-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
            Terms of Service
          </h2>
          <button 
            onClick={() => setShowTerms(false)}
            className="p-2 rounded-full bg-gray-800/50 hover:bg-cyan-600/50 hover:scale-110 transition-all duration-300 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/50"
          >
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-8" style={{scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 rgba(31, 41, 55, 0.5)'}}>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p className="text-sm text-gray-400 italic">Last Updated: December 24, 2025</p>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">1. Acceptance of Terms</h3>
              <p>
                Welcome to Locked'n! By accessing or using our AI-powered fitness application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service. These terms apply to all users, including those who are merely browsing our website or application.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">2. Service Description</h3>
              <p>
                Locked'n is an AI-powered fitness training application that utilizes computer vision and machine learning technology to provide real-time exercise form analysis, rep counting, and personalized workout guidance through your device's camera. Our service includes:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li>AI-powered pose detection and form correction</li>
                <li>Automatic repetition counting</li>
                <li>Exercise library with guided instructions</li>
                <li>Progress tracking and workout history</li>
                <li>Personalized fitness recommendations</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">3. User Responsibilities</h3>
              <p className="mb-3">As a user of Locked'n, you agree to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Provide accurate and complete information during registration</li>
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Use the service only for lawful purposes</li>
                <li>Not attempt to reverse engineer, modify, or tamper with our AI technology</li>
                <li>Ensure you have adequate space and a safe environment for exercise</li>
                <li>Consult with healthcare professionals before starting any fitness program</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">4. Health and Safety Disclaimer</h3>
              <p className="mb-3 font-semibold text-yellow-400">IMPORTANT: Please read this section carefully.</p>
              <p className="mb-3">
                Locked'n is designed to assist with fitness training but is NOT a substitute for professional medical advice, diagnosis, or treatment. Before beginning any exercise program, you should consult with your physician or healthcare provider, especially if you:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li>Have any pre-existing health conditions</li>
                <li>Are pregnant or nursing</li>
                <li>Have a history of heart disease, high blood pressure, or other cardiovascular issues</li>
                <li>Have experienced recent surgery or injury</li>
                <li>Are taking any medications that may affect your ability to exercise</li>
              </ul>
              <p>
                You acknowledge that physical exercise involves inherent risks of injury. You assume all risks associated with using our service and agree to exercise at your own risk. Locked'n and its creators shall not be liable for any injuries sustained while using the application.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">5. Privacy and Data Collection</h3>
              <p className="mb-3">
                We take your privacy seriously. Our AI technology processes video data locally on your device for pose detection and form analysis. We collect and store:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li>Account information (name, email, age, fitness goals)</li>
                <li>Workout statistics and progress metrics</li>
                <li>Device information and usage analytics</li>
              </ul>
              <p>
                We do NOT store or transmit video recordings of your workouts. All video processing occurs in real-time on your device. For complete details on how we handle your data, please review our Privacy Policy.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">6. Camera Permissions</h3>
              <p>
                To provide our core functionality, Locked'n requires access to your device's camera. By granting camera permissions, you confirm that:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li>You are the owner or authorized user of the device</li>
                <li>You consent to the app accessing your camera for pose detection purposes only</li>
                <li>No video data will be recorded, stored, or transmitted without your explicit consent</li>
                <li>You can revoke camera permissions at any time through your device settings</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">7. Subscription and Payments</h3>
              <p className="mb-3">
                Locked'n offers various subscription plans with different features and pricing tiers. By subscribing, you agree to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-3">
                <li>Pay all applicable fees for your chosen subscription plan</li>
                <li>Provide accurate and current payment information</li>
                <li>Automatic renewal of your subscription unless cancelled prior to the renewal date</li>
                <li>No refunds for partial subscription periods, except as required by law</li>
              </ul>
              <p>
                You may cancel your subscription at any time through your account settings. Cancellations will take effect at the end of the current billing period.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">8. Intellectual Property</h3>
              <p>
                All content, features, and functionality of Locked'n, including but not limited to software, AI algorithms, design, graphics, text, and logos, are owned by Locked'n and protected by international copyright, trademark, and other intellectual property laws. You may not:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
                <li>Copy, modify, or distribute any part of our service</li>
                <li>Use our trademarks without written permission</li>
                <li>Attempt to extract or reverse engineer our AI technology</li>
                <li>Create derivative works based on our service</li>
              </ul>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">9. Limitation of Liability</h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOCKED'N AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, LOSS OF DATA, OR LOSS OF PROFITS, ARISING FROM YOUR USE OF OUR SERVICE.
              </p>
              <p className="mt-3">
                Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability for incidental or consequential damages. In such cases, our liability shall be limited to the greatest extent permitted by law.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">10. User-Generated Content</h3>
              <p>
                If you choose to share workout results, progress photos, or other content through our community features, you grant Locked'n a non-exclusive, worldwide, royalty-free license to use, reproduce, and display such content for promotional purposes. You represent that you own all rights to the content you share and that it does not violate any third-party rights.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">11. Termination</h3>
              <p className="mb-3">
                We reserve the right to terminate or suspend your account at any time, without prior notice, for conduct that we believe:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Violates these Terms of Service</li>
                <li>Is harmful to other users or our business</li>
                <li>Involves fraudulent or illegal activity</li>
                <li>Exposes us to legal liability</li>
              </ul>
              <p className="mt-3">
                Upon termination, your right to use the service will immediately cease, and we may delete your account data in accordance with our data retention policies.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">12. Modifications to Terms</h3>
              <p>
                We reserve the right to modify these Terms of Service at any time. We will notify users of significant changes via email or through in-app notifications. Your continued use of Locked'n after such modifications constitutes your acceptance of the updated terms. We encourage you to review these terms periodically.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">13. Third-Party Services</h3>
              <p>
                Locked'n may integrate with third-party services (such as health apps, payment processors, or analytics tools). We are not responsible for the practices or content of these third-party services. Your use of such services is subject to their respective terms and privacy policies.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">14. Governing Law</h3>
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws of the jurisdiction in which Locked'n operates, without regard to its conflict of law provisions. Any disputes arising from these terms shall be resolved through binding arbitration, except where prohibited by law.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">15. Contact Information</h3>
              <p className="mb-3">
                If you have any questions, concerns, or feedback regarding these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-800/50 p-4 rounded-lg border border-cyan-500/30">
                <p className="font-semibold text-cyan-400">Locked'n Team</p>
                <p>Email: lockedn.app@gmail.com</p>
                <p>Response Time: Within 48 hours</p>
              </div>
            </section>

            <section className="border-t border-gray-700 pt-6 mt-8">
              <p className="text-sm text-gray-400">
                By using Locked'n, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. These terms constitute a legally binding agreement between you and Locked'n.
              </p>
              <p className="text-sm text-cyan-400 mt-4 font-semibold">
                Thank you for choosing Locked'n. Let's get locked in together! 💪
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  

  return (
    <div className="min-h-screen relative text-white overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950"></div>
      <div className="fixed inset-0 bg-gradient-to-tr from-purple-600/20 via-transparent to-purple-900/20 opacity-80"></div>
      <div className="fixed inset-0 bg-gradient-to-bl from-indigo-600/10 via-purple-700/10 to-violet-900/10 opacity-60"></div>
      
      <div 
        className="fixed w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"
        style={{ 
          top: `${20 - scrollY * 0.1}px`,
          left: `${20 + scrollY * 0.05}px`,
          transition: 'all 0.3s ease-out'
        }}
      ></div>
      <div 
        className="fixed w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl"
        style={{ 
          bottom: `${40 - scrollY * 0.08}px`,
          right: `${40 + scrollY * 0.06}px`,
          transition: 'all 0.3s ease-out'
        }}
      ></div>
      <div 
        className="fixed w-64 h-64 bg-violet-500/20 rounded-full blur-3xl"
        style={{ 
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${scrollY * 0.15}px)`,
          transition: 'all 0.3s ease-out'
        }}
      ></div>

      <div 
        className="fixed w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none"
        style={{
          left: `${mousePosition.x - 192}px`,
          top: `${mousePosition.y - 192}px`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      ></div>

      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>
      {showTerms && <TermsModal />}
{showPrivacy && <PrivacyModal />}
{showCookies && <CookieModal />}

{showTerms && <TermsModal />}
{showPrivacy && <PrivacyModal />}
{showCookies && <CookieModal />}

{activeScreenshot && (
  <div
    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={closeScreenshot}
  >
    <div
      className="relative w-full max-w-xs md:max-w-sm aspect-[9/16] bg-black rounded-2xl border border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.8)] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={closeScreenshot}
        className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/70 hover:bg-cyan-600/80 border border-cyan-400/60 hover:scale-110 transition-all duration-200"
      >
        <svg
          className="w-4 h-4 text-cyan-200"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <img
        src={activeScreenshot}
        alt="Screenshot preview"
        className="w-full h-full object-contain"
      />
    </div>
  </div>
)}



<section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-32">
  <div className="relative z-10 w-full max-w-6xl mx-auto text-center">
    {/* Logo + title */}
    <div className="mb-12 flex flex-col items-center">
      <h2 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-transparent mb-6 drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">
        Locked'n
      </h2>
      <div className="relative w-32 h-32 group cursor-pointer">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400 opacity-75 blur-md animate-pulse group-hover:blur-xl group-hover:opacity-100 transition-all duration-500"></div>
        <div className="relative w-full h-full rounded-2xl p-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400 transform group-hover:scale-110 transition-transform duration-500">
          <div className="w-full h-full rounded-[14px] bg-white overflow-hidden shadow-2xl group-hover:shadow-cyan-500/60 transition-shadow duration-500">
            <img src="/logo.png" alt="Locked'n Logo" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </div>

    {/* Hero heading + subtext */}
    <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight px-4">
      Your Personal{" "}
      <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
        AI Trainer
      </span>
    </h1>

    <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed px-4">
      Revolutionary AI-powered form tracking using just your phone camera.
    </p>


{/* Video */}
<div className="w-full max-w-sm md:max-w-5xl mx-auto mb-8">
  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:shadow-cyan-500/40 transition-all duration-500">
    {/* Mobile: 9/16 (1080x1920), Desktop/Tablet: 16/9 */}
    <div className="aspect-[9/16] md:aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
      {/* Mobile video (phone) */}
      <video
        className="w-full h-full object-contain block md:hidden"
        autoPlay
        playsInline
        controls
      >
        <source src="/video_phone.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Desktop / iPad video */}
      <video
        className="w-full h-full object-contain hidden md:block"
        autoPlay
        playsInline
        controls
      >
        <source src="/video_desktop.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
</div>



<div className="mt-0 max-w-3xl mx-auto text-center text-xs md:text-sm text-cyan-100/80 leading-relaxed">
  <p>
    <span className="font-semibold text-white">NOTE:</span>{" "}
    Locked’n only uses your phone’s camera while you’re working out.
    We don’t see, record, or store your workouts, and nothing is uploaded
    to our servers. The AI model runs directly on your phone so your
    form checks stay private.
  </p>

  <p className="mt-2 text-cyan-100/70">
    For more info, please read our{" "}
    <button
      type="button"
      onClick={() => setShowTerms(true)}
      className="underline underline-offset-2 hover:text-cyan-300 transition-colors"
    >
      Terms
    </button>{" "}
    and{" "}
    <button
      type="button"
      onClick={() => setShowPrivacy(true)}
      className="underline underline-offset-2 hover:text-cyan-300 transition-colors"
    >
      Privacy Policy
    </button>
    .
  </p>
</div>



{/* App Store Coming Soon Banner */}
<div className="flex flex-col items-center gap-8 mt-10 mb-4 text-center">
  {/* Coming soon pill ON TOP */}
  <div className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-600/20 to-purple-600/20 backdrop-blur-sm px-6 py-3 rounded-full border border-cyan-400/40 shadow-[0_0_18px_rgba(34,211,238,0.45)]">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
    </span>
    <span className="text-sm md:text-base font-semibold text-cyan-200">
      Coming soon on <span className="text-cyan-300">iOS</span> &{" "}
      <span className="text-cyan-300">Android</span>
    </span>
  </div>

  {/* Store buttons under the pill */}
  <div className="flex flex-wrap gap-4 md:gap-6 justify-center items-stretch">
    {/* App Store */}
    <div className="group">
      <div className="relative w-64 md:w-72 bg-black/80 backdrop-blur-sm px-6 py-4 md:px-8 md:py-5 rounded-2xl border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.35)] group-hover:shadow-[0_0_22px_rgba(34,211,238,0.7)] group-hover:border-cyan-300/80 transition-all duration-500 cursor-not-allowed transform group-hover:-translate-y-1">
        <div className="flex items-center gap-3">
          <svg
            className="w-9 h-9 text-white group-hover:scale-110 transition-transform duration-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          <div className="text-left">
            <div className="text-xs text-gray-400">Download on the</div>
            <div className="text-sm md:text-base font-semibold text-gray-100">
              App Store
            </div>
          </div>
        </div>
        <div className="absolute -top-2 -right-2 bg-cyan-500 text-black text-xs font-bold px-2 py-1 rounded-full group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(34,211,238,0.8)] transition-all duration-300">
          Soon
        </div>
      </div>
    </div>

    {/* Google Play */}
    <div className="group">
      <div className="relative w-64 md:w-72 bg-black/80 backdrop-blur-sm px-6 py-4 md:px-8 md:py-5 rounded-2xl border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.35)] group-hover:shadow-[0_0_22px_rgba(34,211,238,0.7)] group-hover:border-cyan-300/80 transition-all duration-500 cursor-not-allowed transform group-hover:-translate-y-1">
        <div className="flex items-center gap-3">
          <svg
            className="w-9 h-9 text-white group-hover:scale-110 transition-transform duration-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
          </svg>
          <div className="text-left">
            <div className="text-xs text-gray-400">GET IT ON</div>
            <div className="text-sm md:text-base font-semibold text-gray-100">
              Google Play
            </div>
          </div>
        </div>
        <div className="absolute -top-2 -right-2 bg-cyan-500 text-black text-xs font-bold px-2 py-1 rounded-full group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(34,211,238,0.8)] transition-all duration-300">
          Soon
        </div>
      </div>
    </div>
  </div>
</div>



    
  </div>
</section>

          <Divider />

          <div className="-mt-8">

          <section className="relative pt-12 pb-4 px-4">
  <div className="w-full max-w-6xl mx-auto">
    <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 md:mb-16 px-4">
      Fix Your{" "}
      <span className="text-cyan-400">Form</span>{" "}
      Without Going{" "}
      <span className="text-cyan-400">Broke</span>
    </h2>

    {/* Mobile helper text */}
    <p className="mt-1 mb-6 text-sm text-cyan-200 text-center md:hidden">
      Select a feature to preview it below.
    </p>


          {/* Feature cards – row 1 */}
          <div className="flex flex-wrap gap-6 justify-center mb-6 text-left w-full px-4">
            <div
              onClick={() => handleFeatureClick(0)}
              className="flex items-start gap-3 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 w-64 hover:bg-gray-800/60 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-500 cursor-pointer group"
            >
              <div className="relative">
                <Camera className="w-6 h-6 text-cyan-400 mt-1 flex-shrink-0 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors duration-500">
                  AI Pose Detection
                </h3>
                <p className="text-gray-400 text-sm">
                  Advanced camera technology
                </p>
              </div>
            </div>

            <div
              onClick={() => handleFeatureClick(1)}
              className="flex items-start gap-3 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 w-64 hover:bg-gray-800/60 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-500 cursor-pointer group"
            >
              <div className="relative">
                <Target className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors duration-500">
                  Instant Feedback
                </h3>
                <p className="text-gray-400 text-sm">
                  Corrections in real-time
                </p>
              </div>
            </div>

            <div
              onClick={() => handleFeatureClick(2)}
              className="flex items-start gap-3 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 w-64 hover:bg-gray-800/60 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-500 cursor-pointer group"
            >
              <div className="relative">
                <Zap className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors duration-500">
                  Auto Rep Count
                </h3>
                <p className="text-gray-400 text-sm">Never lose count again</p>
              </div>
            </div>
          </div>

          {/* Feature cards – row 2 */}
          <div className="flex flex-wrap gap-6 justify-center mb-12 text-left w-full px-4">
            <div
              onClick={() => handleFeatureClick(3)}
              className="flex items-start gap-3 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 w-64 hover:bg-gray-800/60 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-500 cursor-pointer group"
            >
              <div className="relative">
                <svg
                  className="w-6 h-6 text-green-400 mt-1 flex-shrink-0 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors duration-500">
                  Train Anywhere
                </h3>
                <p className="text-gray-400 text-sm">
                  Just your phone & WiFi
                </p>
              </div>
            </div>

            <div
              onClick={() => handleFeatureClick(4)}
              className="flex items-start gap-3 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 w-64 hover:bg-gray-800/60 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-500 cursor-pointer group"
            >
              <div className="relative">
                <svg
                  className="w-6 h-6 text-orange-400 mt-1 flex-shrink-0 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>

              <div>

                
                <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors duration-500">
                  Exercise Library
                </h3>
                <p className="text-gray-400 text-sm">
                  Master new moves with ease
                </p>
              </div>
            </div>
            {/* Progress Tracking (new) */}
<div
  onClick={() => handleFeatureClick(5)}
  className="flex items-start gap-3 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 w-64 hover:bg-gray-800/60 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-500 cursor-pointer group"
>
  <div className="relative">
    {/* using Target icon already imported — swap if you want a different icon */}
    <Target className="w-6 h-6 text-cyan-400 mt-1 flex-shrink-0 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-500" />
  </div>
  <div>
    <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors duration-500">
      Progress Tracking
    </h3>
    <p className="text-gray-400 text-sm">
      Track your gains over time
    </p>
  </div>
</div>

          </div>
              
{/* Slider */}
<div id="feature-slider" className="relative w-full">
  <div className="overflow-hidden rounded-2xl shadow-2xl">
    <div
      className="flex transition-transform duration-500 ease-out"
      style={{ transform: `translateX(-${currentSlide * 100}%)` }}
    >
       {appImages.map((image, index) => {
        const shots = image.screenshots ?? [];
        const count = shots.length;

        // desktop / tablet grid
        let gridClasses = "grid-cols-3 max-w-4xl";
        let gapClass = "gap-6";

        if (count === 1) {
          gridClasses = "grid-cols-1 max-w-xs";
          gapClass = "gap-0";
        } else if (count === 2) {
          gridClasses = "grid-cols-2 max-w-[640px]";
          gapClass = "gap-4";
        }

        const currentShotIndex = mobileShotIndices[index] ?? 0;
        const safeIndex =
          count > 0 ? Math.min(currentShotIndex, count - 1) : 0;
        const activeSrc = count > 0 ? shots[safeIndex] : null;

        return (
          <div key={index} className="min-w-full">
            <div
              className={`bg-gradient-to-br ${image.color}
                rounded-2xl px-4 md:px-10 py-8 md:py-10
                flex flex-col items-center text-center shadow-2xl
                min-h-[560px] md:min-h-[720px]`}
            >
        
              {/* title + subtitle */}
              <h3 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2 text-cyan-300">
                {image.title}
              </h3>
              <p className="text-sm md:text-xl text-white/90 mb-4 md:mb-6">
                {image.desc}
              </p>
        

              {/* Desktop / iPad: grid of all screenshots */}
              <div
                className={`mt-4 hidden md:grid w-full mx-auto justify-items-center ${gridClasses} ${gapClass}`}
              >
                {shots.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openScreenshot(src)}
                    className="bg-black border border-cyan-400/80 rounded-xl overflow-hidden flex items-center justify-center hover:border-cyan-300 hover:shadow-[0_0_18px_rgba(34,211,238,0.7)] hover:scale-105 transition-all duration-300 cursor-pointer w-full md:max-w-[220px] lg:max-w-[270px]"

                  >
                    <div className="w-full aspect-[9/16] bg-black">
                      <img
                        src={src}
                        alt={`${image.title} screenshot ${i + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>

              {/* Mobile-only: single active screenshot with inner arrows */}
              <div className="mt-6 md:hidden flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
                {activeSrc ? (
                  <>
                    <div className="relative w-full">
                      {/* inner arrows – moved a bit further from the image */}
                      <button
                type="button"
                onClick={() => changeMobileShot(index, "prev")}
                className="absolute left-3 top-1/2 -translate-y-1/2 md:hidden
                          rounded-full bg-black/30 text-cyan-100 border border-cyan-400/40 p-2
                          hover:bg-cyan-500/80 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => changeMobileShot(index, "next")}
                className="absolute right-3 top-1/2 -translate-y-1/2 md:hidden
                          rounded-full bg-black/30 text-cyan-100 border border-cyan-400/40 p-2
                          hover:bg-cyan-500/80 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>




                      <button
                        type="button"
                        onClick={() => openScreenshot(activeSrc)}
                        className="bg-black border border-cyan-400/80 rounded-xl overflow-hidden flex items-center justify-center w-full"
                      >
                        <div className="w-full aspect-[9/16] bg-black">
                          <img
                            src={activeSrc}
                            alt={`${image.title} screenshot ${safeIndex + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </button>
                    </div>

                    <p className="text-xs text-gray-300 mt-1">
                      Screenshot {safeIndex + 1} of {count}
                    </p>
                  </>
                ) : (
                  <div className="w-full aspect-[9/16] bg-black/50 border border-cyan-400/40 rounded-xl" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>

  {/* Left arrow – desktop / tablet only */}
  <button
  onClick={prevSlide}
  className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2
             bg-cyan-500/20 border border-cyan-400 text-cyan-300
             backdrop-blur-sm p-3 rounded-full
             hover:bg-cyan-500/40 hover:text-white
             hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50
             transition-all duration-300 cursor-pointer"
>
  <ChevronLeft className="w-6 h-6" />
</button>


<button
  onClick={nextSlide}
  className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2
             bg-cyan-500/20 border border-cyan-400 text-cyan-300
             backdrop-blur-sm p-3 rounded-full
             hover:bg-cyan-500/40 hover:text-white
             hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50
             transition-all duration-300 cursor-pointer"
>
  <ChevronRight className="w-6 h-6" />
</button>



{/* Slider dots (all devices) */}
<div className="flex justify-center gap-2 mt-4 mb-2">
  {appImages.map((_, index) => (
    <button
      key={index}
      onClick={() => handleManualSlideChange(index)}
      className={`h-2 rounded-full transition-all duration-300 ${
        currentSlide === index
          ? "bg-cyan-400 w-6 shadow-lg shadow-cyan-500/50"
          : "bg-cyan-900/70 w-2"
      }`}
    />
  ))}
</div>

</div>

        </div>
      </section>
      </div>



<section className="relative pt-9 pb-20 px-4">
  <div className="w-full max-w-2xl mx-auto text-center -mt-0">
    <button 
      onClick={() => {
        const formSection = document.getElementById("early-access-form");
        formSection?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="relative group inline-flex items-center justify-center bg-gradient-to-r from-cyan-600 to-cyan-700 px-12 py-6 rounded-full text-xl font-bold hover:scale-110 transition-all duration-500 shadow-2xl hover:shadow-cyan-500/70 overflow-hidden cursor-pointer mx-auto"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <span className="relative z-10">Lock In</span>
    </button>
    <p className="mt-8 text-gray-300 px-4">
  Join the early access list and get notified when{" "}
  <span className="text-cyan-400 font-semibold">Locked'n</span> launches.
  <span className="block text-sm text-gray-400 mt-1">
    No spam. No credit card. Just a heads‑up.
  </span>
</p>
  </div>
</section>



      <Divider />

      <section id="early-access-form" className="relative py-7 px-4">
        <div className="w-full max-w-xl mx-auto">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm p-8 md:p-12 rounded-2xl border border-gray-700/50 shadow-2xl hover:border-cyan-500/40 hover:shadow-cyan-500/30 transition-all duration-500">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-center drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
  Wanna <span className="text-cyan-400">Lock In?</span>
</h2>

            <p className="text-gray-400 text-center mb-8">Be the first to experience AI-powered training</p>

            {isSubmitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xl font-semibold text-green-400">Thanks for signing up!</p>
                <p className="text-gray-400 mt-2">We'll be in touch soon.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <input type="text" placeholder="Your Name" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:shadow-lg focus:shadow-cyan-500/40 transition-all duration-300"
                />
                <input type="email" placeholder="Your Email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:shadow-lg focus:shadow-cyan-500/40 transition-all duration-300"
                />
            <button
  onClick={handleSubmit}
  className="relative w-full bg-gradient-to-r from-cyan-600 to-cyan-700 py-4 rounded-xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-cyan-500/60 overflow-hidden group cursor-pointer"
>
  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
  <span className="relative z-10">Join Now</span>
</button>

                <p className="text-center text-sm text-gray-500">🎁 Early members get 3 days free trial</p>
              </div>
            )}
          </div>
        </div>
      </section>


      
      <footer className="relative border-t border-gray-800 py-12 px-4 mt-20 bg-gradient-to-b from-gray-900 to-black">
        <div className="w-full max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Locked'n column */}
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                Locked'n
              </h3>
              <p className="text-gray-400">
                Your personal trainer in your pocket. Train smarter with AI.
              </p>
            </div>

            {/* Legal column */}
            <div className="text-center md:text-left">
              <h4 className="text-2xl font-bold mb-4 text-cyan-400">
                Legal
              </h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <button
                    onClick={() => setShowTerms(true)}
                    className="hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowPrivacy(true)}
                    className="hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowCookies(true)}
                    className="hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    Cookie Policy
                  </button>
                </li>
              </ul>
            </div>

             {/* Follow Us column */}
             <div className="text-center md:text-left">
              <h4 className="text-2xl font-bold mb-4 text-cyan-400">
                Follow Us
              </h4>
              <div className="flex gap-4 justify-center md:justify-start">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://www.youtube.com/@Rampo_o0/featured"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-purple-600 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
                >
                  <Youtube className="w-5 h-5" />
                </a>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://www.instagram.com/lockedn.app"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-purple-600 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://www.tiktok.com/@lockedn.app"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-purple-600 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12.985 2c.282 1.65 1.463 3.097 3.134 3.73v3.078c-1.18-.12-2.27-.51-3.134-1.11v6.484c0 2.92-2.36 5.29-5.27 5.29S2.46 17.1 2.46 14.18c0-2.91 2.36-5.27 5.27-5.27.41 0 .82.05 1.2.15v3.15c-.28-.12-.58-.18-.9-.18-1.22 0-2.21 1-2.21 2.22 0 1.23.99 2.22 2.21 2.22 1.22 0 2.21-.99 2.21-2.22V2h2.52z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Contact Us column */}
            <div className="text-center">
              <h4 className="text-2xl font-bold mb-4 text-cyan-400">
                Contact Us
              </h4>
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=lockedn.app@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Email Locked'n"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto hover:bg-purple-600 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
              >
                <svg
                  className="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  {/* envelope outline */}
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    ry="2"
                    strokeWidth="2"
                  />
                  {/* envelope flap */}
                  <path
                    d="M3 7l9 7 9-7"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* shorter divider line */}
          <div className="border-t border-gray-800 pt-8 mt-3 max-w-4xl mx-auto text-center text-gray-500 text-sm">
            <p>© 2026 Locked'n. All rights reserved.</p>
            <p className="mt-2">
              This site is not affiliated with any fitness organization.
            </p>
          </div>
        </div>
      </footer>


    </div>
  );
}
