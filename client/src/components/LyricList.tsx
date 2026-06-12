import React, { useEffect, useRef } from 'react';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricListProps {
  lines: LyricLine[];
  currentLineIndex: number;
  onLineClick: (timeSeconds: number) => void;
}

const LyricList: React.FC<LyricListProps> = ({ lines, currentLineIndex, onLineClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex]);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col gap-6 overflow-y-auto h-full py-40 px-4 scroll-smooth"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {lines.length === 0 ? (
        <div className="text-gray-500 text-center text-xl">Loading lyrics...</div>
      ) : (
        lines.map((line, index) => (
          <div
            key={`${line.time}-${index}`}
            ref={index === currentLineIndex ? activeLineRef : null}
            onClick={() => onLineClick(line.time / 1000)}
            className={`cursor-pointer transition-all duration-500 text-2xl md:text-4xl font-bold leading-tight ${
              index === currentLineIndex
                ? 'text-white opacity-100 scale-105'
                : 'text-zinc-700 opacity-40 hover:opacity-70 hover:text-zinc-400'
            }`}
          >
            {line.text}
          </div>
        ))
      )}
    </div>
  );
};

export default LyricList;
