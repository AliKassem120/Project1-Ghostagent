'use client';

import { motion } from 'framer-motion';
import { 
    MessageCircle, Calendar, Package, Clock, Zap, CheckCircle2, ShoppingBag, TrendingUp, ShieldCheck, CalendarDays
} from 'lucide-react';
import GhostLogo from '@/components/GhostLogo';

// ---------------------------------------------------------
// SCENE 1: Problem (0-7s)
// ---------------------------------------------------------
function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ times: [0, 0.1, 0.9, 1], duration: 7 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-red-500/10 to-background" />
      <div className="w-full max-w-2xl relative z-10 flex flex-col gap-4">
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm">
            <p className="text-xl">Do you have this in medium? 🤔</p>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm ml-12">
            <p className="text-xl">What time do you open tomorrow?</p>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm ml-24">
            <p className="text-xl">Can I book an appointment for Friday?</p>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 }} className="bg-surface-2 p-4 rounded-2xl rounded-bl-sm self-start shadow-xl border border-border/50 max-w-sm ml-8">
            <p className="text-xl">How much is delivery? 🚚</p>
         </motion.div>
      </div>

      <motion.div 
         initial={{ opacity: 0, scale: 0.9 }} 
         animate={{ opacity: 1, scale: 1 }} 
         transition={{ delay: 4.5 }}
         className="absolute bottom-32 text-center z-20"
      >
         <h2 className="text-4xl font-black text-white tracking-tight mb-2">Customers message 24/7.</h2>
         <p className="text-2xl text-red-400 font-medium">Manual replies slow you down.</p>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 2: Connection (7-13s)
// ---------------------------------------------------------
function Scene2() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 7, times: [0, 0.1, 0.9, 1], duration: 6 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-background" />
      
      <div className="relative z-10 w-full h-full flex items-center justify-center">
          {/* Center Logo */}
          <motion.div 
             initial={{ scale: 0 }} 
             animate={{ scale: [0, 1.2, 1] }} 
             transition={{ delay: 7.5, duration: 0.8 }}
             className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_100px_rgba(139,92,246,0.5)] z-20 absolute"
          >
             <GhostLogo className="w-16 h-16 text-white" />
          </motion.div>

          {/* Nodes */}
          {[
            { icon: MessageCircle, label: "Instagram DMs", angle: -90, color: "text-pink-500", delay: 8.0 },
            { icon: Package, label: "Inventory", angle: -30, color: "text-blue-500", delay: 8.4 },
            { icon: Calendar, label: "Calendar", angle: 30, color: "text-rose-500", delay: 8.8 },
            { icon: ShoppingBag, label: "Orders", angle: 90, color: "text-green-500", delay: 9.2 },
          ].map((node, i) => {
             const rad = (node.angle * Math.PI) / 180;
             const x = Math.sin(rad) * 300;
             const y = -Math.cos(rad) * 300;
             
             return (
               <motion.div 
                 key={i}
                 initial={{ opacity: 0, x: 0, y: 0 }}
                 animate={{ opacity: 1, x, y }}
                 transition={{ delay: node.delay, duration: 0.8, type: 'spring' }}
                 className="absolute flex flex-col items-center gap-4"
               >
                  <div className="w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shadow-xl relative z-10">
                     <node.icon className={`w-10 h-10 ${node.color}`} />
                     <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: node.delay + 0.5 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-background flex items-center justify-center"
                     >
                        <CheckCircle2 className="w-3 h-3 text-white" />
                     </motion.div>
                  </div>
                  <span className="text-xl font-bold">{node.label}</span>
               </motion.div>
             );
          })}

          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 10 }}
            className="absolute bottom-20 text-center"
          >
             <h2 className="text-4xl font-black text-white tracking-tight mb-2">GhostAgent Connects Instantly.</h2>
             <p className="text-2xl text-primary font-medium">One AI. All your systems synced.</p>
          </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 3: E-Commerce (13-28s)
// ---------------------------------------------------------
function Scene3() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center p-12 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 13, times: [0, 0.05, 0.95, 1], duration: 15 }}
    >
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-full max-w-6xl h-full max-h-[800px] flex gap-8">
            
            {/* Phone Left */}
            <div className="flex-1 bg-surface-2 rounded-[2.5rem] border border-border/50 shadow-2xl flex flex-col overflow-hidden relative">
                <div className="h-16 bg-surface-1/80 border-b border-border/50 flex items-center px-6 gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-sm">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-lg">GhostAgent</div>
                        <div className="text-sm text-green-500">Active Now</div>
                    </div>
                </div>
                
                <div className="flex-1 p-6 flex flex-col gap-6 justify-end pb-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 14 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        Do you have the Essential Hoodie in Black (M)?
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: 15, duration: 1.5 }} className="self-start bg-surface-3 p-4 rounded-2xl rounded-tl-sm w-20 flex justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 16.5 }} className="self-start max-w-[80%]">
                        <div className="bg-surface-3 p-4 rounded-2xl rounded-tl-sm text-lg mb-3">
                            Yes! Just checked the warehouse. We have <strong>2 left in stock</strong>.
                        </div>
                        <div className="bg-surface-1 border border-border p-4 rounded-2xl flex items-center gap-4">
                            <div className="w-16 h-16 bg-surface-3 rounded-xl flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-muted-foreground" /></div>
                            <div className="flex-1">
                                <div className="font-bold text-lg">Essential Hoodie</div>
                                <div className="text-muted-foreground">$65.00 • Black • M</div>
                            </div>
                            <div className="px-4 py-2 bg-primary text-white rounded-lg font-bold">Buy</div>
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 20 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        Perfect, just ordered!
                    </motion.div>
                </div>
            </div>

            {/* Dashboard Right */}
            <div className="flex-[1.2] flex flex-col gap-8 py-8">
                <div className="space-y-4">
                    <h2 className="text-5xl font-black text-white tracking-tight">E-Commerce Automation</h2>
                    <p className="text-2xl text-blue-400">Syncs inventory in real-time. Closes sales automatically.</p>
                </div>

                <div className="bg-surface-2 rounded-3xl border border-border/50 p-8 shadow-2xl flex-1 flex flex-col gap-6">
                    <div className="flex items-center justify-between pb-6 border-b border-border/50">
                        <div className="flex items-center gap-3 text-xl font-bold"><Package className="text-blue-500" /> Live Inventory Sync</div>
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" /> Syncing
                        </motion.div>
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <div className="text-lg text-muted-foreground font-semibold mb-2">Essential Hoodie (Black, M)</div>
                            <div className="text-7xl font-black font-mono">
                                <motion.span animate={{ opacity: [1, 0] }} transition={{ delay: 17, duration: 0.1 }} className="absolute">3</motion.span>
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0, 1] }} transition={{ delay: 17, duration: 0.1 }}>2</motion.span>
                            </div>
                        </div>
                        <div className="px-4 py-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 font-bold text-lg">In Stock</div>
                    </div>

                    <div className="w-full h-4 bg-surface-3 rounded-full overflow-hidden mt-4">
                        <motion.div initial={{ width: '60%' }} animate={{ width: '40%' }} transition={{ delay: 17, duration: 0.5, type: 'spring' }} className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
                    </div>

                    <div className="mt-auto space-y-4">
                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Action Log</div>
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 16.5 }} className="bg-surface-1 p-4 rounded-xl border border-border/50 flex items-center gap-4 text-lg">
                            <ShieldCheck className="w-6 h-6 text-green-500" /> Checked live stock (100% accurate)
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 21 }} className="bg-surface-1 p-4 rounded-xl border border-border/50 flex items-center gap-4 text-lg">
                            <TrendingUp className="w-6 h-6 text-blue-500" /> Order #8492 captured & synced
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 4: Appointments (28-43s)
// ---------------------------------------------------------
function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center p-12 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 28, times: [0, 0.05, 0.95, 1], duration: 15 }}
    >
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-full max-w-6xl h-full max-h-[800px] flex gap-8">
            
            {/* Phone Left */}
            <div className="flex-1 bg-surface-2 rounded-[2.5rem] border border-border/50 shadow-2xl flex flex-col overflow-hidden relative">
                <div className="h-16 bg-surface-1/80 border-b border-border/50 flex items-center px-6 gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 to-orange-400 flex items-center justify-center shadow-sm">
                        <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-lg">GhostAgent</div>
                        <div className="text-sm text-green-500">Active Now</div>
                    </div>
                </div>
                
                <div className="flex-1 p-6 flex flex-col gap-6 justify-end pb-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 29 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        Can I book a haircut for tomorrow?
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: 30, duration: 1.5 }} className="self-start bg-surface-3 p-4 rounded-2xl rounded-tl-sm w-20 flex justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 31.5 }} className="self-start max-w-[90%]">
                        <div className="bg-surface-3 p-4 rounded-2xl rounded-tl-sm text-lg mb-3">
                            I have a 3:00 PM and a 4:30 PM open tomorrow. What's your name & phone to secure it?
                        </div>
                        <div className="flex gap-3">
                            <div className="px-4 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary font-bold">3:00 PM</div>
                            <div className="px-4 py-2 rounded-full border border-border bg-surface-1 text-muted-foreground font-bold">4:30 PM</div>
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 35 }} className="self-end bg-primary text-white p-4 rounded-2xl rounded-tr-sm max-w-[80%] text-lg">
                        3:00 PM works! John, 555-0192
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 37 }} className="self-start bg-surface-3 p-4 rounded-2xl rounded-tl-sm max-w-[80%] text-lg flex items-center gap-3">
                        <CheckCircle2 className="text-green-500 w-6 h-6 shrink-0" />
                        Booked! See you tomorrow at 3:00 PM.
                    </motion.div>
                </div>
            </div>

            {/* Dashboard Right */}
            <div className="flex-[1.2] flex flex-col gap-8 py-8">
                <div className="space-y-4">
                    <h2 className="text-5xl font-black text-white tracking-tight">Service Scheduling</h2>
                    <p className="text-2xl text-rose-400">Strict calendar logic. Zero double bookings.</p>
                </div>

                <div className="bg-surface-2 rounded-3xl border border-border/50 p-8 shadow-2xl flex-1 flex flex-col gap-6">
                    <div className="flex items-center justify-between pb-6 border-b border-border/50">
                        <div className="flex items-center gap-3 text-xl font-bold"><CalendarDays className="text-rose-500" /> Smart Calendar</div>
                        <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" /> Live
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-surface-1 p-4 rounded-xl border border-border/50 mb-4">
                        <div className="text-lg font-bold">Tomorrow, Oct 24</div>
                        <div className="text-muted-foreground flex items-center gap-2"><Clock /> 9:00 - 17:00</div>
                    </div>

                    <div className="flex-1 flex flex-col gap-3 relative">
                        <div className="h-12 bg-surface-3/50 rounded-xl flex items-center px-4 border border-border/30">
                            <span className="w-24 text-muted-foreground">1:00 PM</span>
                            <div className="h-6 flex-1 bg-surface-1 border border-border rounded-md" />
                        </div>
                        <div className="h-12 bg-surface-3/50 rounded-xl flex items-center px-4 border border-border/30">
                            <span className="w-24 text-muted-foreground">2:00 PM</span>
                            <div className="h-6 flex-1 bg-blue-500/20 border border-blue-500/30 rounded-md px-3 flex items-center text-blue-400 font-bold">Mike T.</div>
                        </div>
                        <div className="h-12 bg-surface-3/50 rounded-xl flex items-center px-4 border border-border/30 relative">
                            <span className="w-24 text-muted-foreground relative z-10">3:00 PM</span>
                            <motion.div style={{ transformOrigin: 'left' }} initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 37, duration: 0.5 }} className="h-6 flex-1 bg-rose-500/20 border border-rose-500/40 rounded-md px-3 flex items-center text-rose-400 font-bold relative z-10 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                                John (Haircut) • 555-0192
                            </motion.div>
                        </div>
                        <div className="h-12 bg-surface-3/50 rounded-xl flex items-center px-4 border border-border/30">
                            <span className="w-24 text-muted-foreground">4:00 PM</span>
                            <div className="h-6 flex-1 bg-surface-1 border border-border rounded-md" />
                        </div>
                    </div>
                    
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 37.5 }} className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center gap-4 text-green-500 font-bold text-lg">
                        <CheckCircle2 className="w-6 h-6" /> Appointment saved securely
                    </motion.div>
                </div>
            </div>
        </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 5: Dashboard Overview (43-53s)
// ---------------------------------------------------------
function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ delay: 43, times: [0, 0.1, 0.9, 1], duration: 10 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-background" />
      
      <div className="text-center mb-12 relative z-10">
         <h2 className="text-5xl font-black text-white tracking-tight mb-4">Your entire business on Autopilot.</h2>
         <p className="text-2xl text-muted-foreground">All metrics in one unified dashboard.</p>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 44 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <MessageCircle className="w-10 h-10 text-primary mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">243</div>
            <div className="text-muted-foreground font-bold">Replies Automated</div>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 44.2 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <ShoppingBag className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">38</div>
            <div className="text-muted-foreground font-bold">Orders Captured</div>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 44.4 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <CalendarDays className="w-10 h-10 text-rose-500 mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">21</div>
            <div className="text-muted-foreground font-bold">Appointments Booked</div>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 44.6 }} className="bg-surface-2 p-8 rounded-3xl border border-border shadow-xl text-center">
            <ShieldCheck className="w-10 h-10 text-blue-500 mx-auto mb-4" />
            <div className="text-5xl font-black mb-2">0</div>
            <div className="text-muted-foreground font-bold">Double Bookings</div>
         </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// SCENE 6: Final CTA (53-60s)
// ---------------------------------------------------------
function Scene6() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 1] }}
      transition={{ delay: 53, times: [0, 0.1, 0.9, 1], duration: 7 }}
    >
      <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-background to-background" />
      
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 53.5, type: 'spring' }} className="relative z-10 flex flex-col items-center text-center">
         <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_100px_rgba(139,92,246,0.6)] mb-8">
             <GhostLogo className="w-12 h-12 text-white" />
         </div>
         <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-6 leading-tight">
             Turn your DMs into <br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">sales and bookings.</span>
         </h1>
         <p className="text-3xl text-muted-foreground mb-12 max-w-3xl leading-relaxed">
             Automate replies, orders, and appointments with one AI business agent.
         </p>
         <div className="px-10 py-5 bg-primary text-white rounded-full text-2xl font-bold shadow-[0_0_40px_rgba(139,92,246,0.4)]">
             Get Started Free
         </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------
export default function GhostAgentDemoVideoScene() {
  return (
    <div className="relative w-[1920px] h-[1080px] bg-background overflow-hidden font-sans select-none" style={{ transformOrigin: 'top left' }}>
       <Scene1 />
       <Scene2 />
       <Scene3 />
       <Scene4 />
       <Scene5 />
       <Scene6 />
       
       {/* Global Timeline Overlay (Optional, for debugging or visual progress) */}
       <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full z-50">
           <motion.div 
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 60, ease: 'linear' }}
           />
       </div>
    </div>
  );
}
