'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import type { AnimationCycle } from '@/config/animations';
import {
  Header,
  HeroSection,
  HowItWorksSection,
  FeaturesSection,
  SecuritySection,
  FinalCTASection,
  Footer,
} from '@/components/landing';

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [animationCycle, setAnimationCycle] = React.useState<AnimationCycle>('meeting');

  // Redirect authenticated users to dashboard
  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      redirect('/dashboard');
    }
  }, [isLoaded, isSignedIn]);

  // Handle scroll for header background
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Alternate between meeting and regular email cycles every 15 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      setAnimationCycle((prev) => (prev === 'meeting' ? 'regular' : 'meeting'));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render landing page if user is signed in (they'll be redirected)
  if (isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 scroll-smooth">
      {/* Header */}
      <Header isScrolled={isScrolled} onNavigate={scrollToSection} />

      {/* Hero Section */}
      <HeroSection animationCycle={animationCycle} />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Key Features Section */}
      <FeaturesSection />

      {/* Security Trust Section */}
      <SecuritySection />

      {/* Final CTA Section */}
      <FinalCTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}
