'use client';

import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Clock, CalendarDays } from 'lucide-react';

export default function AppointmentsHeroAnimation() {
  return (
    <div className="absolute inset-0 bg-surface-1/50 backdrop-blur-xl flex flex-col md:flex-row p-4 md:p-6 gap-4 overflow-hidden rounded-2xl border border-border">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-rose-500/15 blur-[80px] rounded-full pointer-events-none" />
      
      {/* Phone Mockup (Left) */}
      <div className="flex-[0.8] md:flex-[0.9] bg-surface-2 rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col relative z-10">
        <div className="h-10 border-b border-border bg-surface-1/80 flex items-center px-4 gap-3 shrink-0">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-600 to-orange-400 flex items-center justify-center shadow-sm">
             <Calendar className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-foreground">GhostAgent</span>
        </div>
        
        <div className="flex-1 p-3 flex flex-col gap-3 justify-end text-[11px] leading-relaxed relative">
          {/* Message 1: User */}
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: [0, 1, 1, 1, 0], y: [10, 0, 0, 0, -10], scale: [0.95, 1, 1, 1, 0.95] }}
            transition={{ duration: 10, repeat: Infinity, times: [0, 0.05, 0.9, 0.95, 1] }}
            className="self-end bg-primary text-primary-foreground p-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm"
          >
            I need a haircut this Friday afternoon.
          </motion.div>

          {/* Typing Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0, 0] }}
            transition={{ duration: 10, repeat: Infinity, times: [0, 0.15, 0.16, 0.3, 1] }}
            className="self-start bg-surface-3 p-2.5 rounded-2xl rounded-tl-sm w-12 flex items-center justify-center gap-1 shadow-sm absolute bottom-[125px]"
          >
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1 h-1 rounded-full bg-muted-foreground" />
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1 h-1 rounded-full bg-muted-foreground" />
            <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1 h-1 rounded-full bg-muted-foreground" />
          </motion.div>

          {/* Message 2: Bot */}
          <motion.div
             initial={{ opacity: 0, y: 10, scale: 0.95 }}
             animate={{ opacity: [0, 0, 0, 1, 1, 0], y: [10, 10, 10, 0, 0, -10], scale: [0.95, 0.95, 0.95, 1, 1, 0.95] }}
             transition={{ duration: 10, repeat: Infinity, times: [0, 0.2, 0.3, 0.35, 0.9, 1] }}
             className="self-start max-w-[90%] flex flex-col gap-2 relative top-0"
          >
             <div className="bg-surface-3 text-foreground p-2.5 rounded-2xl rounded-tl-sm shadow-sm border border-border/50">
               I have a 3:00 PM and a 4:30 PM open this Friday. What's your name and phone number to secure the slot?
             </div>
             
             {/* Interactive Chips Mockup */}
             <div className="flex gap-2">
                <div className="px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-bold text-[10px]">
                   3:00 PM
                </div>
                <div className="px-3 py-1.5 rounded-full border border-border bg-surface-1 text-muted-foreground font-bold text-[10px]">
                   4:30 PM
                </div>
             </div>
          </motion.div>

          {/* Message 3: User Confirmation */}
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: [0, 0, 0, 0, 1, 0], y: [10, 10, 10, 10, 0, -10], scale: [0.95, 0.95, 0.95, 0.95, 1, 0.95] }}
            transition={{ duration: 10, repeat: Infinity, times: [0, 0.5, 0.6, 0.65, 0.7, 1] }}
            className="self-end bg-primary text-primary-foreground p-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm"
          >
            3:00 PM works! John, 555-0192
          </motion.div>
          
          {/* Message 4: Bot Final */}
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: [0, 0, 0, 0, 0, 1, 0], y: [10, 10, 10, 10, 10, 0, -10], scale: [0.95, 0.95, 0.95, 0.95, 0.95, 1, 0.95] }}
            transition={{ duration: 10, repeat: Infinity, times: [0, 0.7, 0.8, 0.85, 0.9, 0.92, 1] }}
            className="self-start bg-surface-3 text-foreground p-2.5 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm border border-border/50 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Booked! See you Friday at 3:00 PM.
          </motion.div>
        </div>
      </div>
      
      {/* Dashboard Mockup (Right) */}
      <div className="hidden md:flex flex-1 flex-col gap-3 z-10 relative">
         <div className="flex justify-between items-center bg-surface-2 p-3 rounded-xl border border-border shadow-sm">
             <div className="flex items-center gap-2">
                 <CalendarDays className="w-4 h-4 text-rose-500" />
                 <span className="text-xs font-bold">Smart Calendar</span>
             </div>
             <motion.div 
                 animate={{ opacity: [0, 0, 1, 1, 0] }} 
                 transition={{ duration: 10, repeat: Infinity, times: [0, 0.7, 0.75, 0.95, 1] }}
                 className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20"
             >
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                 <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Slot Secured</span>
             </motion.div>
         </div>

         <div className="flex-1 bg-surface-2 p-3 rounded-xl border border-border shadow-sm flex flex-col gap-2 relative">
             <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                 <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Friday, Oct 24</div>
                 <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> 9:00 - 17:00</div>
             </div>
             
             {/* Calendar grid slots */}
             <div className="flex-1 relative flex flex-col gap-1.5">
                 {/* Existing slot */}
                 <div className="w-full h-8 bg-surface-3/50 rounded-lg flex items-center px-3 border border-border/30">
                     <span className="text-[9px] text-muted-foreground w-12">1:00 PM</span>
                     <div className="h-4 flex-1 bg-surface-1 rounded border border-border"></div>
                 </div>
                 
                 <div className="w-full h-8 bg-surface-3/50 rounded-lg flex items-center px-3 border border-border/30">
                     <span className="text-[9px] text-muted-foreground w-12">2:00 PM</span>
                     <div className="h-4 flex-1 bg-blue-500/20 rounded border border-blue-500/30 flex items-center px-2">
                        <span className="text-[8px] text-blue-400 font-semibold">Mike T. - Color</span>
                     </div>
                 </div>

                 {/* The target slot */}
                 <div className="w-full h-8 bg-surface-3/50 rounded-lg flex items-center px-3 border border-border/30 relative overflow-hidden">
                     <span className="text-[9px] text-muted-foreground w-12 relative z-10">3:00 PM</span>
                     
                     <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: [0, 0, 0, 1, 1, 0], x: [-20, -20, -20, 0, 0, 10] }}
                        transition={{ duration: 10, repeat: Infinity, times: [0, 0.7, 0.75, 0.8, 0.95, 1] }}
                        className="h-4 flex-1 bg-rose-500/20 rounded border border-rose-500/40 flex items-center px-2 relative z-10 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                     >
                        <span className="text-[8px] text-rose-400 font-semibold truncate">John (Haircut) • 555-0192</span>
                     </motion.div>
                 </div>
                 
                 <div className="w-full h-8 bg-surface-3/50 rounded-lg flex items-center px-3 border border-border/30">
                     <span className="text-[9px] text-muted-foreground w-12">4:00 PM</span>
                     <div className="h-4 flex-1 bg-surface-1 rounded border border-border"></div>
                 </div>
             </div>
             
             {/* Rules Badge */}
             <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-surface-1/80 backdrop-blur rounded border border-border shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-[8px] text-muted-foreground font-semibold">Conflict Check Passed</span>
             </div>
         </div>
      </div>
    </div>
  );
}
