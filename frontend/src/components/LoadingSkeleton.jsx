import React from 'react';

export const LoadingSkeleton = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Strip Skeleton */}
      <div className="h-16 rounded-card bg-card/60 border border-border" />

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-card bg-card/60 border border-border" />
        ))}
      </div>

      {/* Main Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 h-80 rounded-card bg-card/60 border border-border" />
        <div className="lg:col-span-4 h-80 rounded-card bg-card/60 border border-border" />
      </div>

      {/* Second Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 h-72 rounded-card bg-card/60 border border-border" />
        <div className="lg:col-span-5 h-72 rounded-card bg-card/60 border border-border" />
      </div>
    </div>
  );
};
