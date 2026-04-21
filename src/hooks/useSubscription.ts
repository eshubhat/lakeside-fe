import { useEffect, useState } from 'react';
import { api } from '../services/api';

export const useSubscription = () => {
    const [plan, setPlan] = useState('free');
    const [subscriptionStatus, setStatus] = useState<string | null>(null);
    const [subscriptionEndsAt, setEndsAt] = useState<string | null>(null);
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/razorpay/status', { withCredentials: true })
            .then(res => {
                setPlan(res.data.plan);
                setStatus(res.data.subscriptionStatus);
                setEndsAt(res.data.subscriptionEndsAt);
            })
            .catch(() => {
                // Not authenticated or subscription fetch failed — stay on free
            })
            .finally(() => setLoading(false));
    }, []);

    const startCheckout = async (selectedPlan: 'starter' | 'pro') => {
        const res = await api.post('/razorpay/create-subscription', { plan: selectedPlan });

        const { subscriptionId, key } = res.data;

        // Open Razorpay checkout
        const options = {
            key,
            subscription_id: subscriptionId,
            name: 'ArchitectSaaS',
            description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan`,
            handler: async (response: any) => {
                // Verify payment on backend
                await api.post('/razorpay/verify', {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_subscription_id: response.razorpay_subscription_id,
                    razorpay_signature: response.razorpay_signature,
                    plan: selectedPlan,
                });
                // Refresh subscription status
                setLoading(true);
                const status = await api.get('/razorpay/status');
                setPlan(status.data.plan);
                setStatus(status.data.subscriptionStatus);
                setEndsAt(status.data.subscriptionEndsAt);
                setLoading(false);
            },
        };

        // @ts-ignore — Razorpay global injected by script tag
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
    };

    const cancelSubscription = async () => {
        await api.post('/razorpay/cancel');
        setPlan('free');
        setStatus('cancelled');
    };

    return {
        plan,
        subscriptionStatus,
        subscriptionEndsAt,
        isLoading,
        startCheckout,
        cancelSubscription,
    };
};