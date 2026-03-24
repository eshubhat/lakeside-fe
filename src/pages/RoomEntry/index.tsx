import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ArrowRight, Keyboard } from 'lucide-react';
import { motion } from 'motion/react';

export default function RoomEntry() {
    const [joinId, setJoinId] = useState('');
    const navigate = useNavigate();

    const handleCreateRoom = () => {
        const newRoom = Math.random().toString(36).substring(2, 10);
        navigate(`/room/${newRoom}`);
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinId.trim()) {
            navigate(`/room/${joinId.trim()}`);
        }
    };

    return (
        <div className="min-h-screen bg-surface">
            {/* Header Mirroring Landing Navbar */}
            <header className="sticky top-0 w-full z-50 glass-header border-b border-midnight/5 bg-white/80 backdrop-blur-md">
                <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
                    <div className="text-xl font-bold tracking-tight text-midnight font-headline cursor-pointer" onClick={() => navigate('/')}>
                        ArchitectSaaS
                    </div>
                </div>
            </header>

            <main className="flex items-center justify-center pt-24 px-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xl w-full"
                >
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs tracking-wider uppercase mb-6">
                            High-Fidelity Studio
                        </span>
                        <h1 className="font-headline text-5xl font-extrabold text-midnight leading-[1.1] tracking-tight mb-6">
                            Start a new <span className="text-primary italic">Session</span>.
                        </h1>
                        <p className="text-on-surface-variant text-lg">
                            Create a new room to record 4K local uncompressed video, or securely join an existing session below.
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-2xl border border-midnight/5 p-8 md:p-12 mb-8">
                        <button 
                            onClick={handleCreateRoom}
                            className="w-full emerald-gradient text-white font-bold px-8 py-5 rounded-xl text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 mb-8"
                        >
                            <Video className="w-6 h-6" />
                            Create Studio Room
                        </button>

                        <div className="relative flex items-center py-5">
                            <div className="grow border-t border-midnight/10"></div>
                            <span className="shrink-0 mx-4 text-on-surface-variant font-medium text-sm">or join existing</span>
                            <div className="grow border-t border-midnight/10"></div>
                        </div>

                        <form onSubmit={handleJoinRoom} className="flex gap-3">
                            <div className="relative flex-1">
                                <Keyboard className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
                                <input 
                                    type="text" 
                                    value={joinId}
                                    onChange={(e) => setJoinId(e.target.value)}
                                    placeholder="Enter Room Code" 
                                    className="w-full bg-surface border border-midnight/10 rounded-xl py-4 flex-1 pl-12 pr-4 text-midnight font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={!joinId.trim()}
                                className="bg-midnight hover:bg-slate-800 text-white font-bold px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                Join
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
