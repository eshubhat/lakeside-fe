import { motion } from "motion/react";
import { useEffect, useState } from "react";

export default function Loading() {
    const [progress, setProgress] = useState(0);

    // Fake progress animation
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((p) => (p >= 100 ? 100 : p + Math.random() * 8));
        }, 200);
        return () => clearInterval(interval);
    }, []);

    return (
        <main style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface-container-lowest)',
            color: 'var(--primary)',
            overflow: 'hidden'
        }}>
            
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                maxWidth: '600px',
                width: '100%',
                padding: '0 24px'
            }}>
                
                {/* 🔄 Minimalist Spinning Indicator */}
                <div style={{ marginBottom: '40px', position: 'relative', width: '48px', height: '48px' }}>
                    <motion.div
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            border: '2px solid var(--border-subtle)',
                            borderTop: '2px solid var(--primary)',
                            borderRadius: '50%'
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                </div>

                {/* 🧠 Title */}
                <motion.h1
                    className="type-headline-lg"
                    style={{ marginBottom: '16px' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    Preparing Your Studio
                </motion.h1>

                <p className="type-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '48px' }}>
                    Initializing recording environment...
                </p>

                {/* 📊 Progress bar (Sharp borders, Vibrant Lime) */}
                <div style={{
                    width: '100%',
                    maxWidth: '320px',
                    height: '8px',
                    backgroundColor: 'var(--surface-gray)',
                    border: '1px solid var(--primary)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <motion.div
                        style={{
                            height: '100%',
                            backgroundColor: 'var(--vibrant-lime)',
                            borderRight: '1px solid var(--primary)'
                        }}
                        initial={{ width: '0%' }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ ease: "linear", duration: 0.2 }}
                    />
                </div>

                <div className="type-label-sm" style={{ marginTop: '16px', color: 'var(--on-surface-variant)' }}>
                    {Math.min(Math.floor(progress), 100)}%
                </div>
            </div>

            <div className="type-label-sm" style={{
                position: 'fixed',
                bottom: '40px',
                color: 'var(--on-surface-variant)'
            }}>
                LAKESIDE STUDIO
            </div>
        </main>
    );
}