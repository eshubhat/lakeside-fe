import { useSubscription } from '../hooks/useSubscription';

export const UpgradeModal = () => {
    const {
        plan,
        subscriptionStatus,
        subscriptionEndsAt,
        startCheckout,
        cancelSubscription,
    } = useSubscription();

    return (
        <div>
            <h2>Upgrade Plan</h2>

            {['free', 'starter', 'pro'].map(p => (
                <div key={p}>
                    <h3>{p.toUpperCase()}</h3>

                    {plan === p && <span>Current Plan</span>}

                    {p !== 'free' && plan !== p && (
                        <button onClick={() => startCheckout(p as 'starter' | 'pro')}>
                            Upgrade
                        </button>
                    )}
                </div>
            ))}

            {plan !== 'free' && (
                <div>
                    {subscriptionEndsAt && (
                        <p>Expires: {new Date(subscriptionEndsAt).toLocaleDateString()}</p>
                    )}
                    <p>Status: {subscriptionStatus}</p>

                    <button onClick={cancelSubscription}>
                        Cancel Subscription
                    </button>
                </div>
            )}
        </div>
    );
};