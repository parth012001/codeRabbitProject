// Content configuration for landing page
import type { AnimationCycle } from './animations';

export const landingContent = {
  hero: {
    badge: '✨ Your AI Email + Calendar Assistant',
    headline: {
      part1: 'Turn Your Inbox Into',
      part2: 'Your Superpower',
    },
    subheadline:
      'Powered by Mastra AI. Manage your inbox efficiently with AI-powered email classification, smart replies, and automated calendar scheduling—all without lifting a finger.',
    cta: {
      primary: 'Get Started Free',
      secondary: 'Free to start • No credit card required',
    },
    trustSignals: [
      {
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        text: '256-bit AES',
        color: 'text-green-600',
      },
      {
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
        text: 'OAuth 2.0',
        color: 'text-blue-600',
      },
      {
        icon: 'M5 13l4 4L19 7',
        text: 'No Passwords',
        color: 'text-purple-600',
      },
    ],
  },

  emailWorkflows: {
    meeting: {
      inbox: {
        sender: 'Sarah Johnson',
        subject: 'Meeting Follow-up',
        message: 'Hi! Can we schedule a quick call to discuss the Q4 roadmap?',
        timestamp: '2 min ago',
      },
      draft: {
        recipient: 'Sarah Johnson',
        message: "Hi Sarah! Absolutely, I'd be happy to discuss the Q4 roadmap.",
      },
      calendar: {
        title: 'Q4 Roadmap Discussion',
        time: 'Tomorrow, 2:00 PM',
        duration: '30 min • Google Meet',
      },
    },
    regular: {
      inbox: {
        sender: 'Mike Chen',
        subject: 'Project Update Question',
        message:
          "Hey! What's the status on the API integration? Need this for the client demo.",
        timestamp: '2 min ago',
      },
      draft: {
        recipient: 'Mike Chen',
        message:
          "Hey Mike! The API integration is 80% complete. We're on track for the demo—I'll have it ready by Thursday EOD.",
      },
      userEdit: {
        changed: '"...by Thursday EOD"',
        editType: '→ Made tone more casual',
      },
      aiLearning: {
        title: 'Noa Learning',
        subtitle: 'Adapting to your style...',
        analyzing: 'Analyzing your edit patterns',
        learned: 'Next time: More casual tone for Mike ✓',
      },
    },
  },

  howItWorks: {
    title: 'How It Works',
    subtitle: 'Three simple steps to automate your email and calendar',
    steps: [
      {
        num: '1',
        title: 'Connect Securely',
        desc: 'One-click Google sign-in. Email Assistant syncs with your Gmail and calendar securely via OAuth.',
        gradient: 'from-blue-500 to-blue-600',
      },
      {
        num: '2',
        title: 'AI Does the Work',
        desc: 'Emails are automatically classified, prioritized, and smart drafts are generated. Meeting requests are detected automatically.',
        gradient: 'from-purple-500 to-purple-600',
      },
      {
        num: '3',
        title: 'Review & Approve',
        desc: 'You stay in control. Review drafts, approve meetings, or edit before sending. The AI learns from every interaction.',
        gradient: 'from-pink-500 to-purple-600',
      },
    ],
  },

  features: {
    title: 'Why Noa?',
    subtitle: 'An intelligent email + calendar assistant powered by Mastra AI',
    mainFeatures: [
      {
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
        title: 'Smart Classification',
        desc: 'AI automatically categorizes emails by priority, sentiment, and topic so you focus on what matters.',
        gradient: 'from-blue-500 to-blue-600',
      },
      {
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        title: 'Calendar Integration',
        desc: 'Detects meeting requests, checks your availability, and can schedule meetings automatically.',
        gradient: 'from-purple-500 to-purple-600',
      },
      {
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        title: 'AI-Powered Replies',
        desc: 'Get smart draft replies in seconds. Context-aware, thread-smart, and always professional.',
        gradient: 'from-pink-500 to-purple-600',
      },
    ],
    additionalFeatures: [
      {
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        title: 'Priority Detection',
        desc: 'Automatically identifies urgent emails and surfaces them first in your inbox triage.',
        gradient: 'from-blue-50 to-purple-50',
        border: 'border-blue-100',
        iconGradient: 'from-blue-500 to-blue-600',
      },
      {
        icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        title: 'Sentiment Analysis',
        desc: 'Understand the tone of incoming emails to craft appropriate responses.',
        gradient: 'from-purple-50 to-pink-50',
        border: 'border-purple-100',
        iconGradient: 'from-purple-500 to-purple-600',
      },
      {
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        title: 'Meeting Scheduling',
        desc: 'Automatically finds optimal meeting times based on your calendar availability.',
        gradient: 'from-green-50 to-blue-50',
        border: 'border-green-100',
        iconGradient: 'from-green-500 to-green-600',
      },
      {
        icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
        title: 'Workflow Automation',
        desc: 'Inbox triage workflows that fetch, classify, and summarize your emails automatically.',
        gradient: 'from-orange-50 to-pink-50',
        border: 'border-orange-100',
        iconGradient: 'from-orange-500 to-orange-600',
      },
    ],
  },

  security: {
    title: 'Your Data, Your Control',
    subtitle: 'We take security seriously. Your trust is our top priority.',
    features: [
      {
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
        title: '256-bit AES Encryption',
        desc: 'Industry-standard encryption for all sensitive data in transit and at rest.',
        gradient: 'from-green-400 to-green-600',
      },
      {
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        title: 'OAuth 2.0',
        desc: "Google's secure authentication. We never see your password.",
        gradient: 'from-blue-400 to-blue-600',
      },
      {
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        title: 'You Approve All Actions',
        desc: 'We draft replies and suggest meetings. You review and approve before anything is sent.',
        gradient: 'from-purple-400 to-purple-600',
      },
      {
        icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
        title: 'Privacy Focused',
        desc: 'Your data is encrypted and secure. Revoke access anytime from settings.',
        gradient: 'from-orange-400 to-pink-600',
      },
    ],
  },

  finalCta: {
    title: 'Ready to Supercharge Your Inbox?',
    subtitle: 'Join Noa and automate your email management in minutes.',
    cta: 'Get Started Free',
    trustSignals: ['Free to get started', 'No credit card required', 'Cancel anytime'],
  },
};

// Helper function to get content based on cycle
export const getWorkflowContent = (cycle: AnimationCycle) => {
  return landingContent.emailWorkflows[cycle];
};
