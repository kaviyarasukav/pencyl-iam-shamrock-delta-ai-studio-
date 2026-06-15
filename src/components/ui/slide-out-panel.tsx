import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface SlideOutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export function SlideOutPanel({ 
  isOpen, 
  onClose, 
  title = "Panel", 
  children,
  side = 'right',
  className
}: SlideOutPanelProps) {
  const isRight = side === 'right';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[90]"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: isRight ? '100%' : '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRight ? '100%' : '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed top-0 bottom-0 w-80 md:w-96 bg-card border-x border-border/50 z-[100] p-6 flex flex-col shadow-2xl",
              isRight ? "right-0 border-l" : "left-0 border-r",
              className
            )}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/30">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                {title}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-muted rounded-full">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
