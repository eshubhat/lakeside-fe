import { motion } from "motion/react";
import { Cloud } from "lucide-react";
import { useEffect, useState } from "react";

export default function Loading() {
    const [progress, setProgress] = useState(0);

    // Fake progress animation
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 8));
        }, 200);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-midnight text-white">

            {/* 🌌 Animated background */}
            <div className="fixed inset-0 -z-10">
                <motion.div
                    className="absolute top-[10%] right-[15%] w-96 h-96 bg-primary/10 rounded-full blur-[120px]"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 6, repeat: Infinity }}
                />
                <motion.div
                    className="absolute bottom-[5%] left-[10%] w-[500px] h-[500px] bg-primary-light/10 rounded-full blur-[150px]"
                    animate={{ scale: [1.1, 0.9, 1.1] }}
                    transition={{ duration: 8, repeat: Infinity }}
                />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">

                {/* 🔄 Pulsing + rotating loader */}
                <div className="relative mb-16 flex items-center justify-center">

                    {/* Outer rotating ring */}
                    <motion.div
                        className="absolute w-[140px] h-[140px] rounded-full border border-primary/20"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Inner spinning arc */}
                    <motion.div
                        className="absolute w-[120px] h-[120px] rounded-full border-2 border-transparent border-t-primary-light"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Logo pulse */}
                    <motion.div
                        className="bg-midnight p-6 rounded-full border border-white/10"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Cloud className="w-16 h-16 text-primary-light fill-primary-light" />
                    </motion.div>
                </div>

                {/* 🧠 Title */}
                <motion.h1
                    className="font-headline text-4xl md:text-5xl font-extrabold mb-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    Preparing Your Studio
                </motion.h1>

                <p className="text-white/60 mb-10 text-sm tracking-wide">
                    Initializing recording environment...
                </p>

                {/* 📊 Progress bar */}
                <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-linear-to-r from-primary to-primary-light"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="mt-4 text-xs text-white/50">
                    {Math.floor(progress)}%
                </div>
            </div>

            <div className="fixed bottom-10 text-[10px] tracking-[0.3em] uppercase text-white/20">
                Veridian Nocturne
            </div>
        </main>
    );
}