import re

with open('src/app/[locale]/dashboard/billing/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State changes
code = re.sub(
    r'const \[showPaymentModal, setShowPaymentModal\] = useState\(false\);\n\s*const \[showCancelModal, setShowCancelModal\] = useState\(false\);\n\s*const \[paymentMethod, setPaymentMethod\] = useState\(\'Not connected\'\);',
    "const [showUpgradeModal, setShowUpgradeModal] = useState(false);\n    const [showDowngradeModal, setShowDowngradeModal] = useState(false);\n    const [showCancelModal, setShowCancelModal] = useState(false);\n    const [targetPlan, setTargetPlan] = useState<{name: string, price: number} | null>(null);",
    code
)

# 2. Function replacements
funcs_replacement = """    const handlePlanChange = async (planName: string, planPrice: number) => {
        const currentPrice = currentPlanData?.price || 0;
        setTargetPlan({ name: planName, price: planPrice });

        if (planName === 'Starter') {
            setShowCancelModal(true);
        } else if (planPrice > currentPrice) {
            setShowUpgradeModal(true);
        } else if (planPrice < currentPrice) {
            setShowDowngradeModal(true);
        }
    };

    const handleUpgradeProceed = async () => {
        if (!targetPlan) return;
        setIsUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const res = await fetch('/api/checkout/whish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: targetPlan.price,
                    user_id: user.id,
                    plan_name: targetPlan.name
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Checkout failed');
            }

            const data = await res.json();
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error: any) {
            console.error('Plan change error:', error);
            toast.error('Failed to upgrade: ' + (error.message || 'Unknown error'));
            setIsUpdating(false);
        }
    };

    const handleDowngradeProceed = async () => {
        if (!targetPlan) return;
        setIsUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let dbTier = 'pro';
            if (targetPlan.name === 'Starter') dbTier = 'starter';

            const { error } = await supabase
                .from('users')
                .update({ cancel_at_period_end: true, next_plan_tier: dbTier })
                .eq('id', user.id);

            if (error) throw error;

            setShowDowngradeModal(false);
            toast.info(`Downgrade scheduled. You will move to ${targetPlan.name} at the end of your billing cycle.`);
            setPlanDetails(prev => ({ ...prev, cancel_at_period_end: true }));
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to schedule downgrade.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancelSubscription = async () => {
        setIsUpdating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('users')
                .update({ cancel_at_period_end: true, next_plan_tier: 'starter' })
                .eq('id', user.id);

            if (error) throw error;

            setShowCancelModal(false);
            toast.info('Subscription cancelled. You will move to Starter at the end of the billing cycle.');
            setPlanDetails(prev => ({ ...prev, cancel_at_period_end: true }));
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to cancel subscription.');
        } finally {
            setIsUpdating(false);
        }
    };"""

code = re.sub(
    r'const handlePlanChange = async.*?const handleCancelSubscription = async \(\) => \{.*?setIsUpdating\(false\);\n        \}\n    \};',
    funcs_replacement,
    code,
    flags=re.DOTALL
)

# 3. UI - Payment Method Grid removal
code = re.sub(
    r'<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">.*?<div className="flex items-center gap-3 p-4 rounded-xl bg-surface-2 ">.*?<Calendar.*?</div>.*?<div className="flex items-center gap-3 p-4 rounded-xl bg-surface-2 ">.*?<CreditCard.*?</div>.*?</div>',
    """<div className="mb-6">
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-2 max-w-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {planDetails.tier === 'free_trial' ? 'Trial Ends' : 'Next Billing'}
                                </p>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {planDetails.period_end || planDetails.trial_ends_at
                                        ? new Date(planDetails.period_end || planDetails.trial_ends_at!).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })
                                        : 'Account verify pending'}
                                </p>
                            </div>
                        </div>
                    </div>""",
    code,
    flags=re.DOTALL
)

# 4. UI - Update Payment Button removal
code = re.sub(
    r'<button\s*onClick=\{\(\) => setShowPaymentModal\(true\)\}\s*className="px-5 py-2.5 bg-surface-2 border border-border rounded-xl hover:bg-surface-3 transition-all text-sm font-medium text-muted-foreground hover:text-muted-foreground"\s*>\s*Update Payment\s*</button>',
    '',
    code
)

# 5. UI - Payment Modal -> Upgrade/Downgrade Modals
modals_ui = """            {/* ═══ UPGRADE MODAL ═══ */}
            <AnimatePresence>
                {showUpgradeModal && targetPlan && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowUpgradeModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md glass-dark rounded-2xl p-8 border border-border"
                            >
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-surface-2 hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>

                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 rounded-xl bg-primary/10">
                                        <TrendingUp className="w-5 h-5 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">Upgrade to {targetPlan.name}</h3>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="p-4 rounded-xl bg-surface-2 border border-border flex items-center gap-4">
                                        <Calendar className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">New Billing Cycle</p>
                                            <p className="text-sm font-semibold text-foreground">
                                                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} 
                                                {' '}–{' '} 
                                                {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 rounded-xl bg-surface-2 border border-border">
                                        <span className="text-sm font-medium text-muted-foreground">Total due today</span>
                                        <span className="text-xl font-bold text-foreground">${targetPlan.price}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpgradeProceed}
                                    disabled={isUpdating}
                                    className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? 'Redirecting...' : 'Proceed with Whish Money'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ DOWNGRADE MODAL ═══ */}
            <AnimatePresence>
                {showDowngradeModal && targetPlan && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDowngradeModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md glass-dark rounded-2xl p-8 border border-border"
                            >
                                <button
                                    onClick={() => setShowDowngradeModal(false)}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-surface-2 hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>

                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2.5 rounded-xl bg-surface-2">
                                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">Schedule Downgrade</h3>
                                </div>

                                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                                    You are moving to the <span className="font-medium text-foreground">{targetPlan.name}</span> plan. 
                                    You will keep your current <span className="text-primary font-medium">{currentPlan}</span> features until the end of your billing cycle on{' '}
                                    <span className="font-medium text-foreground">
                                        {planDetails.period_end ? new Date(planDetails.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of your cycle'}
                                    </span>.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDowngradeModal(false)}
                                        className="flex-1 py-3 bg-surface-2 border border-border rounded-xl hover:bg-surface-3 transition-all font-medium text-sm text-muted-foreground"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDowngradeProceed}
                                        disabled={isUpdating}
                                        className="flex-1 py-3 bg-surface-2 border border-border text-foreground rounded-xl hover:bg-surface-3 transition-all font-medium text-sm disabled:opacity-50"
                                    >
                                        {isUpdating ? 'Scheduling...' : 'Confirm Downgrade'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>"""

code = re.sub(
    r'\{\/\*\s*═══ PAYMENT MODAL ═══\s*\*\/\}.*?\{\/\*\s*═══ CANCEL MODAL ═══\s*\*\/\}',
    modals_ui + '\n\n            {/* ═══ CANCEL MODAL ═══ */}',
    code,
    flags=re.DOTALL
)

# Fix "Cancel Subscription?" to "Downgrade to Starter?"
code = re.sub(
    r'<h3 className="text-xl font-bold text-foreground">Cancel Subscription\?</h3>',
    '<h3 className="text-xl font-bold text-foreground">Downgrade to Starter?</h3>',
    code
)

with open('src/app/[locale]/dashboard/billing/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

