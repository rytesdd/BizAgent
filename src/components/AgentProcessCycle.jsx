import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Minimal cn utility if not present
function clsx(...inputs) {
    return inputs.filter(Boolean).join(" ");
}

export default function AgentProcessCycle({ onComplete }) {
    const [step, setStep] = useState(0);
    // 0: Loading (...) [2s]
    // 1: Text 1 [2s]
    // 2: Text 2 [2s]
    // 3: Text 3 [5.5s]

    // Use a ref to ensure we always call the latest onComplete without re-triggering effect
    const onCompleteRef = React.useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        // Timeline
        const times = [2000, 2000, 2000, 5500];
        let currentStep = 0;
        let timeoutId;

        const runStep = () => {
            if (currentStep >= 3) {
                // End of cycle
                timeoutId = setTimeout(() => {
                    if (onCompleteRef.current) onCompleteRef.current();
                }, times[3]);
                return;
            }

            timeoutId = setTimeout(() => {
                currentStep++;
                setStep(currentStep);
                runStep();
            }, times[currentStep]);
        };

        runStep();

        // Critical: Cleanup timeout to prevent ghost animations if component remounts/updates
        return () => clearTimeout(timeoutId);
    }, []);

    const getContent = () => {
        switch (step) {
            case 0:
                return (
                    <div className="flex items-center gap-1 px-1 h-5">
                        <motion.span
                            className="w-1.5 h-1.5 bg-orange-400 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                        />
                        <motion.span
                            className="w-1.5 h-1.5 bg-orange-400 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.span
                            className="w-1.5 h-1.5 bg-orange-400 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                        />
                    </div>
                );
            case 1: return <span className="whitespace-nowrap">正在读取评论列表</span>;
            case 2: return <span className="whitespace-nowrap">识别到甲方评论</span>;
            case 3: return <span className="whitespace-nowrap">正在生成回复，稍后请在评论区查看</span>;
            default: return null;
        }
    };

    return (
        <motion.div
            layout
            className="h-6 flex items-center bg-zinc-800/50 rounded-lg overflow-hidden relative"
            initial={{ opacity: 0, width: "auto" }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
            }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -20, opacity: 0, filter: "blur(4px)" }}
                    transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                        mass: 0.8
                    }}
                    className="px-2 text-[10px] text-orange-400 font-medium tracking-wide"
                >
                    {getContent()}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}
