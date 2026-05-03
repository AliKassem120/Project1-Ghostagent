'use client';

import { motion } from 'framer-motion';
import { 
    MessageCircle, Calendar, Package, Clock, Zap, CheckCircle2, ShoppingBag, TrendingUp, ShieldCheck, CalendarDays
} from 'lucide-react';
import GhostLogo from '@/components/GhostLogo';

// ---------------------------------------------------------
// SCENE 1: Intro (0-3s)
// ---------------------------------------------------------
function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ times: [0, 0.1, 0.9, 1], duration: 3 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-background" />
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} className="relative z-10 flex flex-col items-center">
         <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_100px_rgba(139,92,246,0.6)] mb-6">
             <GhostLogo iconOnly className="w-12 h-12" />
         </div>
         <h1 className="text-5xl font-black text-white tracking-tighter">Your Instagram DMs, automated.</h1>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 2: Problem (3-10s)
// ---------------------------------------------------------
function Scene2() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-background z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 3, times: [0, 0.1, 0.9, 1], duration: 7 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-red-500/10 to-background" />
      <div className="w-full max-w-2xl relative z-10 flex flex-col gap-4">
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm">
            <p className="text-xl">Do you have this in medium? 🤔</p>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm ml-12">
            <p className="text-xl">Can I book tomorrow?</p>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 6 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm ml-24">
            <p className="text-xl">How much is delivery? 🚚</p>
         </motion.div>
      </div>

      <motion.div 
         initial={{ opacity: 0, scale: 0.9 }} 
         animate={{ opacity: 1, scale: 1 }} 
         transition={{ delay: 7 }}
         className="absolute bottom-32 text-center z-20"
      >
         <h2 className="text-4xl font-black text-red-400 tracking-tight">Manual replies cost sales.</h2>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 3: E-Commerce (10-23s)
// ---------------------------------------------------------
function Scene3() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center p-12 bg-background z-30"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 10, times: [0, 0.05, 0.95, 1], duration: 13 }}
    >
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-full max-w-6xl h-full max-h-[800px] flex gap-8">
            <div className="flex-1 bg-surface-2 rounded-[2.5rem] border border-border/50 shadow-2xl flex flex-col overflow-hidden relative">
                <div className="h-16 bg-surface-1/80 border-b border-border/50 flex items-center px-6 gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-sm">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div><div className="font-bold text-lg">GhostAgent</div><div className="text-sm text-green-500">Active Now</div></div>
                </div>
                <div className="flex-1 p-6 flex flex-col gap-6 justify-end pb-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 11 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        Do you have the hoodie in Black (M)?
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: 12, duration: 1.5 }} className="self-start bg-surface-3 p-4 rounded-2xl rounded-tl-sm w-20 flex justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 13.5 }} className="self-start max-w-[80%]">
                        <div className="bg-surface-3 p-4 rounded-2xl rounded-tl-sm text-lg mb-3">
                            Yes! We have <strong>2 left in stock</strong>.
                        </div>
                        <div className="bg-surface-1 border border-border p-4 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-surface-3 rounded-xl flex items-center justify-center"><ShoppingBag className="text-muted-foreground" /></div>
                            <div className="flex-1"><div className="font-bold">Essential Hoodie</div><div className="text-sm text-muted-foreground">$65.00</div></div>
                            <div className="px-4 py-2 bg-primary text-white rounded-lg font-bold">Buy</div>
                        </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 16 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        Perfect, ordered!
                    </motion.div>
                </div>
            </div>

            <div className="flex-[1.2] flex flex-col gap-8 py-8 justify-center">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 11.5 }} className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-2xl flex items-center gap-4">
                    <Package className="w-8 h-8 text-blue-500" />
                    <div className="text-2xl font-bold text-blue-400">Live inventory checks</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 13.5 }} className="bg-purple-500/10 border border-purple-500/30 p-6 rounded-2xl flex items-center gap-4">
                    <MessageCircle className="w-8 h-8 text-purple-500" />
                    <div className="text-2xl font-bold text-purple-400">Instant product replies</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 16 }} className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl flex items-center gap-4">
                    <TrendingUp className="w-8 h-8 text-green-500" />
                    <div className="text-2xl font-bold text-green-400">Orders captured in the DM</div>
                </motion.div>
            </div>
        </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 4: Appointments (23-38s)
// ---------------------------------------------------------
function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center p-12 bg-background z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 23, times: [0, 0.05, 0.95, 1], duration: 15 }}
    >
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-full max-w-6xl h-full max-h-[800px] flex gap-8">
            <div className="flex-1 bg-surface-2 rounded-[2.5rem] border border-border/50 shadow-2xl flex flex-col overflow-hidden relative">
                <div className="h-16 bg-surface-1/80 border-b border-border/50 flex items-center px-6 gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 to-orange-400 flex items-center justify-center shadow-sm">
                        <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div><div className="font-bold text-lg">GhostAgent</div><div className="text-sm text-green-500">Active Now</div></div>
                </div>
                <div className="flex-1 p-6 flex flex-col gap-6 justify-end pb-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 24 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        Can I book for tomorrow?
                    </motion.div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: 25, duration: 1.5 }} className="self-start bg-surface-3 p-4 rounded-2xl rounded-tl-sm w-20 flex justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 26.5 }} className="self-start max-w-[90%]">
                        <div className="bg-surface-3 p-4 rounded-2xl rounded-tl-sm text-lg mb-3">
                            I have 3:00 PM available. What's your name & phone to secure it?
                        </div>
                        <div className="px-4 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary font-bold w-fit">3:00 PM</div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 29 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        3:00 PM works! John, 555-0192
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 31 }} className="self-start bg-surface-3 p-4 rounded-2xl rounded-tl-sm max-w-[80%] text-lg flex items-center gap-3">
                        <CheckCircle2 className="text-green-500 w-6 h-6 shrink-0" />
                        Booked! See you tomorrow.
                    </motion.div>
                </div>
            </div>

            <div className="flex-[1.2] flex flex-col gap-8 py-8 justify-center">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 24.5 }} className="bg-orange-500/10 border border-orange-500/30 p-6 rounded-2xl flex items-center gap-4">
                    <Clock className="w-8 h-8 text-orange-500" />
                    <div className="text-2xl font-bold text-orange-400">Business hours checked</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 26.5 }} className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl flex items-center gap-4">
                    <CalendarDays className="w-8 h-8 text-rose-500" />
                    <div className="text-2xl font-bold text-rose-400">No double bookings</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 31 }} className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl flex items-center gap-4">
                    <ShieldCheck className="w-8 h-8 text-green-500" />
                    <div className="text-2xl font-bold text-green-400">Name & phone captured</div>
                </motion.div>
            </div>
        </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 5: Dashboard Overview (38-47s)
// ---------------------------------------------------------
function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-background z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 38, times: [0, 0.1, 0.9, 1], duration: 9 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-background" />
      
      <div className="text-center mb-12 relative z-10">
         <h2 className="text-5xl font-black text-white tracking-tight mb-4">Your entire business on Autopilot.</h2>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 39 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <MessageCircle className="w-10 h-10 text-primary mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">243</div>
            <div className="text-muted-foreground font-bold">Replies Automated</div>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 39.2 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <ShoppingBag className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">38</div>
            <div className="text-muted-foreground font-bold">Orders Captured</div>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 39.4 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <CalendarDays className="w-10 h-10 text-rose-500 mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">21</div>
            <div className="text-muted-foreground font-bold">Appointments Booked</div>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 39.6 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <ShieldCheck className="w-10 h-10 text-blue-500 mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">0</div>
            <div className="text-muted-foreground font-bold">Double Bookings</div>
         </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 6: Final CTA (47-52s)
// ---------------------------------------------------------
function Scene6() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-background z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 1] }}
      transition={{ delay: 47, times: [0, 0.1, 0.9, 1], duration: 5 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-background to-background" />
      
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 47.5, type: 'spring' }} className="relative z-10 flex flex-col items-center text-center">
         <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_100px_rgba(139,92,246,0.6)] mb-8">
             <GhostLogo iconOnly className="w-12 h-12" />
         </div>
         <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-6 leading-tight">
             Turn DMs into <br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">sales and bookings.</span>
         </h1>
         <div className="mt-8 px-10 py-5 bg-primary text-white rounded-full text-2xl font-bold shadow-[0_0_40px_rgba(139,92,246,0.4)]">
             Get Started Free
         </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------
export default function GhostAgentDemoVideoScene({ recordingMode = false }: { recordingMode?: boolean }) {
  return (
    <div data-demo-ready="true" className="relative w-[1920px] h-[1080px] bg-background overflow-hidden font-sans select-none" style={{ transformOrigin: 'top left' }}>
       <Scene1 />
       <Scene2 />
       <Scene3 />
       <Scene4 />
       <Scene5 />
       <Scene6 />
    </div>
  );
}
