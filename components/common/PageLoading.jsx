'use client';

export default function PageLoading({ message = 'Loading...', compact = false }) {
  return (
    <div className={`flex items-center justify-center ${compact ? 'py-12' : 'py-20'}`}>
      <div className="text-center">
        <img
          src="/indusiaai-logo.png"
          alt="Loading"
          className={`object-contain animate-pulse-glow mx-auto mb-4 ${compact ? 'w-36 h-36' : 'w-48 h-48'}`}
        />
        <div className="font-mono text-xs text-text-tertiary tracking-wider">
          {message}
        </div>
      </div>
    </div>
  );
}
