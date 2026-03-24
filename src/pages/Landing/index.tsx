import {
    ArrowRight,
    PlayCircle,
    Mic,
    Video,
    AudioLines,
    Wand2,
    Quote,
    Globe,
    Share2,
    Mail,
    Send
} from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
    return (
        <div className="min-h-screen">
            {/* Navigation */}
            <header className="sticky top-0 w-full z-50 glass-header border-b border-midnight/5">
                <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
                    <div className="text-xl font-bold tracking-tight text-midnight font-headline">ArchitectSaaS</div>
                    <nav className="hidden md:flex items-center gap-8">
                        <a className="text-primary font-semibold border-b-2 border-primary pb-1 text-sm" href="#">Product</a>
                        <a className="text-on-surface-variant font-medium transition-colors hover:text-primary text-sm" href="#">Solutions</a>
                        <a className="text-on-surface-variant font-medium transition-colors hover:text-primary text-sm" href="#">Pricing</a>
                        <a className="text-on-surface-variant font-medium transition-colors hover:text-primary text-sm" href="#">Resources</a>
                    </nav>
                    <div className="flex items-center gap-4">
                        <button className="hidden md:block text-midnight font-semibold text-sm px-4 py-2 hover:text-primary transition-colors">Sign In</button>
                        <button className="emerald-gradient text-white font-bold text-sm px-6 py-2.5 rounded-lg active:scale-95 transition-all shadow-lg shadow-primary/20">
                            Start Building
                        </button>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative pt-20 pb-32 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                            className="z-10"
                        >
                            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs tracking-wider uppercase mb-6">
                                Studio-Quality Everywhere
                            </span>
                            <h1 className="font-headline text-6xl md:text-7xl font-extrabold text-midnight leading-[1.05] tracking-tight mb-8">
                                The Studio in Your <span className="text-primary italic">Browser</span>.
                            </h1>
                            <p className="text-on-surface-variant text-xl leading-relaxed max-w-xl mb-10">
                                Record studio-quality podcasts and video interviews from anywhere. Local recording ensures 4K video and crystal-clear audio, even with poor internet.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button className="emerald-gradient text-white font-bold px-8 py-4 rounded-xl text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                                    Get Started Free
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button className="bg-white border border-midnight/10 text-midnight font-bold px-8 py-4 rounded-xl text-lg flex items-center justify-center gap-2 hover:bg-surface-low transition-all">
                                    <PlayCircle className="w-5 h-5" />
                                    See How it Works
                                </button>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="relative"
                        >
                            <div className="absolute -inset-10 bg-primary/5 blur-[100px] rounded-full"></div>
                            <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-midnight/5">
                                <img
                                    className="w-full aspect-4/3 object-cover hero-mask"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZ1Am7nIR2eg4TsjppSTy87bude35KPoFMOKJnSF1N6lnoSK27W-CidKpoT6an6K8Uj0wKfvfF6dBz4yLb8lP6wfmA03XEI1auDrJpyVp930X6VJZx7dWnl4mO2IzJBSQP4F1Dwo4l-DpcHgN-CzRd-G-iKStufv_-M3uhQzOrjLM5SCdy9Tzv5eqEAxswDS4FqIgRbXCxiuTExp5v0Pm53cFC08i3uni2yHBSsM6SaSZgQIqAP6Us5ikwc0LIAZ105KYfyIiS81rs"
                                    alt="Professional studio setup"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/80 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-between shadow-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                                            <Mic className="w-6 h-6 text-white fill-current" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-midnight">Recording Session Live</div>
                                            <div className="text-xs text-on-surface-variant">Uncompressed 48kHz WAV Audio</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 items-end h-8">
                                        <motion.span animate={{ height: [12, 24, 12] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1.5 bg-primary rounded-full" />
                                        <motion.span animate={{ height: [16, 8, 16] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 bg-primary rounded-full" />
                                        <motion.span animate={{ height: [8, 32, 8] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 bg-primary rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Brand Social Proof */}
                <section className="py-12 bg-surface-low">
                    <div className="max-w-7xl mx-auto px-6">
                        <p className="text-center text-on-surface-variant font-bold text-sm tracking-widest uppercase mb-10">
                            Trusted by over 100,000 podcasters
                        </p>
                        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale">
                            <img alt="Amazon" className="h-8" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5ZyFs1qFgihOaMv7Jys5C0zUFd8246el7FMjqRdpfdaF86WavQQbzEy0TYHyQC3Pv4tSbZDmYjxoInYYp3yo37IMLeG8O7c21M1rAUxTK0iaONBcy3ezPmR_9o7cUQnJNrQinAlTQcfsUfqqlhkfiql1VQmoJWQpY8DbP6-nKHK6nvvfoxU2KO8z8OTzJkhAlCPjIpui4an_Fxk33EeY3XbLS6Qt8R-1mClR7bvGlQMOiRpdZ-QTk78PtlFe6WPVvr2j_ez3wwGyQ" referrerPolicy="no-referrer" />
                            <img alt="Netflix" className="h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJ_r4pVwpSuE-uxPFMHmzSycgKqHEnFppWl9Gy7qy-xbxYfnXjnnwY_BTIFHSVJfUX0IVVOouxayo1RwsRGKLp0vk8nS9u2piY7Dqxt4MJWUuwrL340076uvrQ8ddmocrhzOy4Hq02NAX8BexJUBNz3DMGky_qNes3tZIQhsFNj3aVkRiEuNhqw63iKM_exCPgmgj7yhDK2NpeJWuuFYbfiZXG97dPnCtENdfVNN1kmUhp8WfNFUFRTFQtGbxhoI55bKYLDm6DyozV" referrerPolicy="no-referrer" />
                            <img alt="Google" className="h-8" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEC5eBb61Qi6g0fxmk0Dm_FbTec70FhhLyaVJ55gZB68eTGys7UhaxYZ2-2eXKucfDrd5o48DdvAqBotDga8YQTuSyWFZKVplYKZJx_PAQUEg3ePH3i8TbGZObz43jSvYpAyb2hDvD_hL-LfbWIfVQdRzamEfJbRwj6P_VlhyhOen7aPkaRkO7GuBcGGN6S79yFWOWbR_6a2-f5rrUj6gLjUMuBRG3NOOI2Kc_C2Zjp1ZdfiT2LoV5aASTKsFIEJ_Yg_rvqVGm04kC" referrerPolicy="no-referrer" />
                            <img alt="IBM" className="h-8" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCw2xlemZB2l1DRXBlNLyN1X9C-oaiSEG7IcuYXw0Z2FeqKuLTxS-DD4u2FmNpU8-Pd1cODY2FTjmy3mixvUUnABQ3VZb0Zm6CRzfv9_Tx5PBOM_77KzyrPvn3m0ttAyROf2FIJDJfIlSCVH6sx30YJgSM3MmRX6w2HHGpfWBHygbOZSa6bsFlnp2fCBV8lwMN1OFaylaaH3l0Zbzq_j_ucDfRCmTapDzo9x948aDe6WUE431QxnisyI7KTAECcPeL_6BYOkixu4kff" referrerPolicy="no-referrer" />
                            <img alt="Apple" className="h-8" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuHdy4HIBFA2gZRj6KkuqSpMcCbsxJmd-CTRyFTwJIUGlSoYY_X7qjIgXGSQs7akF_yV4mPMo_RB5X3_v2tHntIOPe7hNFSBwPHKZIev_M3Q2Pt4pz1agZjw3McyP0Htk5gDbciTTQ913X_3Rsu4WJkbEH6woWCXP5vB_GIZRSlwJLeGIKVugP537-HJm5mYvxJR_C2BgfiC3JffM9kNs2uMPNRwnkegaeHzMq4vMFFKY12eJSQWeVgEzhwadGrHSWZ4ONWq0PcmMR" referrerPolicy="no-referrer" />
                        </div>
                    </div>
                </section>

                {/* Feature Bento Grid */}
                <section className="py-32 bg-surface">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                            <div className="max-w-2xl">
                                <h2 className="font-headline text-5xl font-extrabold text-midnight mb-6">
                                    Designed for creators who <span className="text-primary">refuse</span> to compromise.
                                </h2>
                                <p className="text-on-surface-variant text-lg">
                                    Every feature is architected to save you hours of post-production while delivering world-class quality.
                                </p>
                            </div>
                            <button className="text-primary font-bold text-lg flex items-center gap-2 group">
                                Explore all features
                                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            {/* High-Res Recording */}
                            <div className="md:col-span-8 bg-white rounded-3xl p-10 flex flex-col justify-between overflow-hidden relative group border border-midnight/5">
                                <div className="z-10">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                                        <Video className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="font-headline text-3xl font-bold mb-4">Local 4K Recording</h3>
                                    <p className="text-on-surface-variant text-lg max-w-md">
                                        Record video and audio locally on each participant's device. No more choppy video or audio dropouts from bad connections.
                                    </p>
                                </div>
                                <img
                                    className="absolute right-0 bottom-0 w-1/2 h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none"
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEvhrK57tWJJ4ZLfahJ8ZTAN_P9Ge6wHOKrype3rcNXzjmaTNwdYsv7uPcD-0qOiOoH8f3UZvBZ2uHeK4JkwKJOPSkOL8y5XYbYOd7Z7I7686WDVjMvrjB5o1CwxAyMAJlBWsPrSaEo4JhZKISp8-MFSemZca3dUk9R9eyHnW4M9V7v0YcBicU0FBSLCyuR0pybRAyhdB4fepJQTMvEOB_EtQdeawS8lw6eLqnKjkybn_jZniMVUdrDLZy3OzwKrb6ws98ZOQSDS8e"
                                    alt="Camera lens"
                                    referrerPolicy="no-referrer"
                                />
                            </div>

                            {/* Audio Separated */}
                            <div className="md:col-span-4 bg-midnight text-emerald-on-container rounded-3xl p-10 flex flex-col justify-center">
                                <AudioLines className="w-10 h-10 mb-6" />
                                <h3 className="font-headline text-2xl font-bold mb-4">Separate Tracks</h3>
                                <p className="text-emerald-on-container/80">
                                    Receive separate audio and video tracks for every participant, giving you total control in editing.
                                </p>
                            </div>

                            {/* AI Editor */}
                            <div className="md:col-span-4 bg-surface-low rounded-3xl p-10 border border-midnight/5">
                                <Wand2 className="w-10 h-10 text-primary mb-6" />
                                <h3 className="font-headline text-2xl font-bold mb-4">AI Magic Clips</h3>
                                <p className="text-on-surface-variant">
                                    Turn long-form recordings into viral social media shorts automatically with our AI detection.
                                </p>
                            </div>

                            {/* Transcription */}
                            <div className="md:col-span-8 bg-surface-low rounded-3xl p-10 flex flex-col md:flex-row gap-10 items-center overflow-hidden border border-midnight/5">
                                <div className="flex-1">
                                    <Quote className="w-10 h-10 text-primary mb-6" />
                                    <h3 className="font-headline text-3xl font-bold mb-4">Instant Transcription</h3>
                                    <p className="text-on-surface-variant text-lg">
                                        Get 99% accurate transcriptions in over 100 languages the moment you finish recording.
                                    </p>
                                </div>
                                <div className="flex-1 bg-white p-6 rounded-xl shadow-lg rotate-3 border border-midnight/5">
                                    <div className="space-y-3">
                                        <div className="h-2 w-3/4 bg-primary/20 rounded-full"></div>
                                        <div className="h-2 w-full bg-primary/10 rounded-full"></div>
                                        <div className="h-2 w-5/6 bg-primary/20 rounded-full"></div>
                                        <div className="h-2 w-2/3 bg-primary/10 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Testimonial Spotlight */}
                <section className="py-32">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="bg-midnight rounded-[2rem] p-12 md:p-24 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 opacity-5">
                                <Quote className="w-[200px] h-[200px] text-white fill-current" />
                            </div>
                            <div className="relative z-10 max-w-3xl">
                                <h2 className="text-emerald-on-container font-headline text-4xl md:text-5xl font-extrabold leading-tight mb-12">
                                    "ArchitectSaaS has completely revolutionized our workflow. The quality of remote recording is now indistinguishable from an in-person studio."
                                </h2>
                                <div className="flex items-center gap-6">
                                    <img
                                        className="w-20 h-20 rounded-full object-cover border-4 border-primary/20"
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD1yG4MpyZ-cnS65Ujqof95hHnWyq-nBygtDaWOEVHK8k5uNq81mytoZRaQCWe9OCEyEUHmZfj_qDOYf1GK5a4ayJbd4f-1ZATH61q9Pu5KXZ8-HrH9nYGo5DESKIAGQ7hVNFqtDU6A029cFYaylDpxzYTqH1hlugAk-zc6la_CHbmWdKKj-uNYxbQwIMO-gfLBJGRMKtlprIkZzaZ0QJKcQhXaN_-C1_55bZGpMbGABLNOKt8wBZx_r3jIbbw2dSHKLMmjdQ3eJjy"
                                        alt="Marcus Chen"
                                        referrerPolicy="no-referrer"
                                    />
                                    <div>
                                        <div className="text-white font-bold text-xl font-headline">Marcus Chen</div>
                                        <div className="text-emerald-on-container/70 font-medium">Head of Content, Global Tech Media</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-32 bg-surface">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <h2 className="font-headline text-5xl md:text-6xl font-extrabold text-midnight mb-8">
                            Ready to record like a <span className="text-primary">pro</span>?
                        </h2>
                        <p className="text-on-surface-variant text-xl mb-12">
                            Join thousands of creators who trust ArchitectSaaS for their most important conversations.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <button className="emerald-gradient text-white font-bold px-10 py-5 rounded-xl text-xl shadow-xl shadow-primary/30 hover:scale-105 transition-transform">
                                Start Your Free Trial
                            </button>
                            <button className="bg-surface-low text-midnight font-bold px-10 py-5 rounded-xl text-xl hover:bg-white border border-midnight/5 transition-colors">
                                Book a Demo
                            </button>
                        </div>
                        <p className="mt-8 text-on-surface-variant font-medium">No credit card required. Cancel anytime.</p>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-slate-950 w-full mt-24">
                <div className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-2 md:grid-cols-4 gap-12">
                    <div>
                        <div className="text-lg font-bold text-white mb-6 font-headline">ArchitectSaaS</div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            The premier platform for high-quality remote video and audio production.
                        </p>
                        <div className="flex gap-4">
                            <Globe className="w-5 h-5 text-slate-400 cursor-pointer hover:text-primary-light transition-colors" />
                            <Share2 className="w-5 h-5 text-slate-400 cursor-pointer hover:text-primary-light transition-colors" />
                            <Mail className="w-5 h-5 text-slate-400 cursor-pointer hover:text-primary-light transition-colors" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-2 font-headline">Product</h4>
                        <a className="text-slate-400 hover:text-primary-light transition-colors hover:translate-x-1 text-sm" href="#">Product</a>
                        <a className="text-slate-400 hover:text-primary-light transition-colors hover:translate-x-1 text-sm" href="#">Features</a>
                        <a className="text-slate-400 hover:text-primary-light transition-colors hover:translate-x-1 text-sm" href="#">Pricing</a>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-2 font-headline">Company</h4>
                        <a className="text-slate-400 hover:text-primary-light transition-colors hover:translate-x-1 text-sm" href="#">About</a>
                        <a className="text-slate-400 hover:text-primary-light transition-colors hover:translate-x-1 text-sm" href="#">Privacy</a>
                        <a className="text-slate-400 hover:text-primary-light transition-colors hover:translate-x-1 text-sm" href="#">Terms</a>
                    </div>
                    <div className="flex flex-col gap-4">
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-2 font-headline">Newsletter</h4>
                        <p className="text-slate-400 text-xs mb-4">Stay updated with the latest in remote production.</p>
                        <div className="flex">
                            <input
                                className="bg-slate-900 border-none rounded-l-lg px-4 py-2 text-white text-sm w-full focus:ring-1 focus:ring-primary"
                                placeholder="Email"
                                type="email"
                            />
                            <button className="bg-primary px-4 py-2 rounded-r-lg text-white hover:bg-primary-light transition-colors">
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-8 py-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-slate-500 text-xs">© 2024 ArchitectSaaS. Construction of digital authority.</p>
                    <div className="flex gap-6">
                        <a className="text-slate-500 hover:text-white text-xs transition-colors" href="#">Privacy Policy</a>
                        <a className="text-slate-500 hover:text-white text-xs transition-colors" href="#">Cookie Settings</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}