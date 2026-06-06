'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { 
  MessageSquare, 
  Globe, 
  BrainCircuit, 
  ShieldAlert, 
  Instagram, 
  MessageCircle, 
  Heart, 
  Megaphone, 
  Inbox, 
  Calendar, 
  ShoppingBag, 
  RefreshCcw, 
  BarChart3, 
  Clock 
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

interface FeatureCard {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  colorClass: string;
}

interface Category {
  id: string;
  nameKey: string;
  features: FeatureCard[];
}

export default function AllFeaturesGrid() {
  const tFeat = useTranslations('Features');
  const [activeTab, setActiveTab] = useState<string>('all');

  const categories: Category[] = [
    {
      id: 'ai-engine',
      nameKey: 'aiSalesEngine',
      features: [
        {
          id: 'smart-replies',
          icon: MessageCircle,
          titleKey: 'smartReplies',
          descKey: 'smartRepliesDesc',
          colorClass: 'text-primary bg-primary/10 border-primary/20',
        },
        {
          id: 'multilingual',
          icon: Globe,
          titleKey: 'multilingual',
          descKey: 'multilingualDesc',
          colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        },
        {
          id: 'context-memory',
          icon: BrainCircuit,
          titleKey: 'contextMemory',
          descKey: 'contextMemoryDesc',
          colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        },
        {
          id: 'human-handoff',
          icon: ShieldAlert,
          titleKey: 'humanHandoff',
          descKey: 'humanHandoffDesc',
          colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        },
      ],
    },
    {
      id: 'channels',
      nameKey: 'channelPower',
      features: [
        {
          id: 'insta-automation',
          icon: Instagram,
          titleKey: 'instagramDm',
          descKey: 'instagramDmDesc',
          colorClass: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
        },
        {
          id: 'whatsapp-api',
          icon: MessageSquare,
          titleKey: 'whatsappApi',
          descKey: 'whatsappApiDesc',
          colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        },
        {
          id: 'comment-reply',
          icon: Heart,
          titleKey: 'commentReply',
          descKey: 'commentReplyDesc',
          colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        },
        {
          id: 'broadcasts',
          icon: Megaphone,
          titleKey: 'marketingBroadcast',
          descKey: 'marketingBroadcastDesc',
          colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        },
      ],
    },
    {
      id: 'business',
      nameKey: 'businessManagement',
      features: [
        {
          id: 'unified-inbox',
          icon: Inbox,
          titleKey: 'unifiedInbox',
          descKey: 'unifiedInboxDesc',
          colorClass: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
        },
        {
          id: 'calendar-sync',
          icon: Calendar,
          titleKey: 'appointmentCalendar',
          descKey: 'appointmentCalendarDesc',
          colorClass: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
        },
        {
          id: 'order-mgmt',
          icon: ShoppingBag,
          titleKey: 'orderManagement',
          descKey: 'orderManagementDesc',
          colorClass: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        },
        {
          id: 'system-sync',
          icon: RefreshCcw,
          titleKey: 'inventorySync',
          descKey: 'inventorySyncDesc',
          colorClass: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        },
        {
          id: 'analytics',
          icon: BarChart3,
          titleKey: 'analyticsDashboard',
          descKey: 'analyticsDashboardDesc',
          colorClass: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
        },
        {
          id: 'business-hours',
          icon: Clock,
          titleKey: 'businessHours',
          descKey: 'businessHoursDesc',
          colorClass: 'text-red-500 bg-red-500/10 border-red-500/20',
        },
      ],
    },
  ];

  // Flat list of features for 'all' tab or fallback display
  const allFeatures = categories.flatMap(cat => cat.features);

  return (
    <section id="features" className="relative py-16 md:py-24 px-5 md:px-6 z-10 scroll-mt-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 md:mb-14"
        >
          <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase mb-3 block">
            {tFeat('label')}
          </span>
          <h2 className="text-3xl md:text-5xl font-black mb-4 text-foreground tracking-tighter">
            {tFeat('title')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            {tFeat('description')}
          </p>
        </motion.div>

        {/* Categories Tabs - Horizontal Scroll on Mobile with Snapping */}
        <div className="flex md:justify-center mb-10 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0">
          <div className="flex gap-2.5 min-w-max">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all uppercase tracking-widest min-h-[44px] border ${
                activeTab === 'all'
                  ? 'bg-primary border-primary text-primary-foreground shadow-md'
                  : 'bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3'
              }`}
            >
              All Features
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all uppercase tracking-widest min-h-[44px] border ${
                  activeTab === cat.id
                    ? 'bg-primary border-primary text-primary-foreground shadow-md'
                    : 'bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3'
                }`}
              >
                {tFeat(cat.nameKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          <AnimatePresence mode="popLayout">
            {categories
              .filter(cat => activeTab === 'all' || cat.id === activeTab)
              .flatMap((cat) =>
                cat.features.map((feature) => (
                  <motion.div
                    layout
                    key={feature.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="glass-frosted border border-border/80 rounded-3xl p-6 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.1)] transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border ${feature.colorClass}`}>
                        <feature.icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-extrabold text-foreground mb-2 tracking-tight">
                        {tFeat(feature.titleKey)}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
                        {tFeat(feature.descKey)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
