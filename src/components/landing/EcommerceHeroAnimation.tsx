'use client';

import { motion } from 'framer-motion';
import { Package, ShieldCheck, ShoppingBag, TrendingUp, Zap } from 'lucide-react';

export default function EcommerceHeroAnimation() {
  return (
    <div className="absolute inset-0 bg-surface-1/50 backdrop-blur-xl flex flex-col md:flex-row p-3 sm:p-4 md:p-6 gap-4 overflow-hidden rounded-2xl border border-border">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none" />
      
      {/* Phone Mockup (Left) */}
      <div className="w-full md:flex-[0.9] h-full bg-surface-2 rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col relative z-10 scale-[0.95] sm:scale-100 origin-center sm:origin-top">
        <div className="h-10 border-b border-border bg-surface-1/80 flex items-center px-4 gap-3 shrink-0">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-sm">
             <Zap className="w-3 h-3 text-white" />
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
            Do you have the Essential Hoodie in Black (Medium)?
          </motion.div>

          {/* Typing Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0, 0] }}
            transition={{ duration: 10, repeat: Infinity, times: [0, 0.15, 0.16, 0.3, 1] }}
            className="self-start bg-surface-3 p-2.5 rounded-2xl rounded-tl-sm w-12 flex items-center justify-center gap-1 shadow-sm absolute bottom-14"
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
             className="self-start max-w-[85%] flex flex-col gap-2 relative top-0"
          >
             <div className="bg-surface-3 text-foreground p-2.5 rounded-2xl rounded-tl-sm shadow-sm border border-border/50">
               Yes! I just checked the warehouse. We have <strong>2 left in stock</strong>.
             </div>
             
             {/* Product Card */}
             <div className="bg-surface-1 border border-border p-2 rounded-xl shadow-sm flex gap-3 items-center">
                <div className="w-10 h-10 rounded-md bg-surface-3 shrink-0 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                   <div className="font-bold text-foreground text-[10px]">Essential Hoodie</div>
                   <div className="text-muted-foreground text-[9px]">$65.00 • Black • M</div>
                </div>
                <div className="px-2 py-1 bg-primary text-primary-foreground rounded text-[9px] font-bold">
                   Buy
                </div>
             </div>
          </motion.div>

          {/* Message 3: User Checkout */}
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: [0, 0, 0, 0, 1, 0], y: [10, 10, 10, 10, 0, -10], scale: [0.95, 0.95, 0.95, 0.95, 1, 0.95] }}
            transition={{ duration: 10, repeat: Infinity, times: [0, 0.5, 0.6, 0.65, 0.7, 1] }}
            className="self-end bg-primary text-primary-foreground p-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm"
          >
            Perfect, checking out now!
          </motion.div>
        </div>
      </div>
      
      {/* Dashboard Mockup (Right) */}
      <div className="hidden md:flex flex-1 flex-col gap-3 z-10 relative">
         <div className="flex justify-between items-center bg-surface-2 p-3 rounded-xl border border-border shadow-sm">
             <div className="flex items-center gap-2">
                 <Package className="w-4 h-4 text-blue-500" />
                 <span className="text-xs font-bold">Live Inventory</span>
             </div>
             <motion.div 
                 animate={{ opacity: [0.4, 1, 0.4] }} 
                 transition={{ duration: 2, repeat: Infinity }}
                 className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20"
             >
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                 <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Syncing</span>
             </motion.div>
         </div>

         <div className="flex-1 bg-surface-2 p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4">
             <div className="flex justify-between items-end">
                <div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Essential Hoodie (M)</div>
                    <div className="text-3xl font-black text-foreground font-mono relative h-9 w-12">
                       <motion.span animate={{ opacity: [1, 1, 0, 0, 0, 1] }} transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 0.7, 0.71, 1] }} className="absolute">3</motion.span>
                       <motion.span animate={{ opacity: [0, 0, 1, 1, 0, 0] }} transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 0.7, 0.71, 1] }} className="absolute">2</motion.span>
                       <motion.span animate={{ opacity: [0, 0, 0, 0, 1, 0] }} transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 0.7, 0.71, 1] }} className="absolute">1</motion.span>
                    </div>
                </div>
                
                <motion.div 
                    animate={{ backgroundColor: ['rgba(34, 197, 94, 0.1)', 'rgba(34, 197, 94, 0.1)', 'rgba(234, 179, 8, 0.1)', 'rgba(234, 179, 8, 0.1)'] }}
                    transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 1] }}
                    className="px-2 py-1 rounded text-[10px] font-bold border relative h-6 w-16"
                    style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                >
                   <motion.span animate={{ opacity: [1, 1, 0, 0] }} transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 1] }} className="text-green-500 absolute inset-0 flex items-center justify-center whitespace-nowrap">In Stock</motion.span>
                   <motion.span animate={{ opacity: [0, 0, 1, 1] }} transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 1] }} className="text-yellow-500 absolute inset-0 flex items-center justify-center whitespace-nowrap">Low Stock</motion.span>
                </motion.div>
             </div>

             {/* Animated Chart Bar */}
             <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden mt-2">
                <motion.div 
                   className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                   animate={{ width: ['60%', '60%', '40%', '40%', '20%', '20%'] }}
                   transition={{ duration: 10, repeat: Infinity, times: [0, 0.35, 0.36, 0.7, 0.71, 1], ease: "easeInOut" }}
                />
             </div>

             {/* Recent Activity */}
             <div className="mt-auto space-y-2">
                 <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Automated Actions</div>
                 <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: [0, 0, 1, 1, 0], x: [-10, -10, 0, 0, 10] }}
                    transition={{ duration: 10, repeat: Infinity, times: [0, 0.3, 0.35, 0.9, 1] }}
                    className="flex items-center gap-2 text-[10px] bg-surface-1 p-2 rounded-lg border border-border"
                 >
                     <ShieldCheck className="w-3 h-3 text-green-500" />
                     <span className="text-foreground font-medium">Verified stock for @alex_j</span>
                 </motion.div>
                 
                 <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: [0, 0, 0, 1, 0], x: [-10, -10, -10, 0, 10] }}
                    transition={{ duration: 10, repeat: Infinity, times: [0, 0.65, 0.7, 0.9, 1] }}
                    className="flex items-center gap-2 text-[10px] bg-surface-1 p-2 rounded-lg border border-border"
                 >
                     <TrendingUp className="w-3 h-3 text-blue-500" />
                     <span className="text-foreground font-medium">Checkout link generated</span>
                 </motion.div>
             </div>
         </div>
      </div>
    </div>
  );
}
