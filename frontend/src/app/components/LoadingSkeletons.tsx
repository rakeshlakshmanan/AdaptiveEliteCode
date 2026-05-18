import React from 'react';
import { motion } from 'motion/react';

// Shimmer effect base component
function ShimmerBox({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-muted rounded-lg overflow-hidden relative ${className || ''}`} style={style}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

// Dashboard Loading Skeleton
export function DashboardSkeleton() {
  return (
    <div className="pt-16 px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <ShimmerBox className="h-10 w-64" />
          <ShimmerBox className="h-5 w-96" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recommended Problem Card */}
            <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
              <ShimmerBox className="h-6 w-48" />
              <ShimmerBox className="h-8 w-full" />
              <div className="flex gap-3">
                <ShimmerBox className="h-8 w-24" />
                <ShimmerBox className="h-8 w-32" />
                <ShimmerBox className="h-8 w-28" />
              </div>
              <ShimmerBox className="h-20 w-full" />
              <ShimmerBox className="h-12 w-40" />
            </div>

            {/* Recent Activity */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <ShimmerBox className="h-6 w-32" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1">
                    <ShimmerBox className="h-5 w-5 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <ShimmerBox className="h-4 w-48" />
                      <ShimmerBox className="h-3 w-32" />
                    </div>
                  </div>
                  <ShimmerBox className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Skill Radar */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <ShimmerBox className="h-6 w-32 mb-4" />
              <ShimmerBox className="h-64 w-full" />
              <div className="text-center mt-4 space-y-2">
                <ShimmerBox className="h-10 w-20 mx-auto" />
                <ShimmerBox className="h-4 w-32 mx-auto" />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <ShimmerBox className="h-10 w-10 rounded-lg mb-3" />
                  <ShimmerBox className="h-8 w-16 mb-1" />
                  <ShimmerBox className="h-3 w-20" />
                </div>
              ))}
            </div>

            {/* Focus Areas */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <ShimmerBox className="h-6 w-28" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <ShimmerBox className="h-4 w-40" />
                    <ShimmerBox className="h-4 w-12" />
                  </div>
                  <ShimmerBox className="h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Problems List Loading Skeleton
export function ProblemsListSkeleton() {
  return (
    <div className="pt-6 px-4 sm:px-6 lg:px-8 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left w-16"><ShimmerBox className="h-4 w-12" /></th>
                  <th className="px-4 py-3 text-left"><ShimmerBox className="h-4 w-20" /></th>
                  <th className="px-4 py-3 text-left w-24"><ShimmerBox className="h-4 w-16" /></th>
                  <th className="px-4 py-3 text-left"><ShimmerBox className="h-4 w-16" /></th>
                  <th className="px-4 py-3 text-left"><ShimmerBox className="h-4 w-20" /></th>
                  <th className="px-4 py-3 text-left w-32"><ShimmerBox className="h-4 w-16" /></th>
                  <th className="px-4 py-3 text-left w-20"><ShimmerBox className="h-4 w-12" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...Array(10)].map((_, index) => (
                  <tr key={index} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <ShimmerBox className="h-5 w-5 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <ShimmerBox className="h-5 w-48" />
                    </td>
                    <td className="px-4 py-3">
                      <ShimmerBox className="h-6 w-16 rounded-md" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <ShimmerBox className="h-5 w-20 rounded-md" />
                        <ShimmerBox className="h-5 w-24 rounded-md" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <ShimmerBox className="h-5 w-20 rounded-md" />
                        <ShimmerBox className="h-5 w-20 rounded-md" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ShimmerBox className="h-1.5 w-16 rounded-full" />
                        <ShimmerBox className="h-4 w-10" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ShimmerBox className="h-4 w-12" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Problem Page Loading Skeleton
export function ProblemPageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav Bar */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <ShimmerBox className="h-5 w-5" />
        <ShimmerBox className="h-5 w-32" />
        <ShimmerBox className="h-8 w-24 rounded-lg" />
      </div>

      {/* Split Panes Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Problem Description */}
        <div className="w-2/5 border-r border-border p-6 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ShimmerBox className="h-8 w-48" />
              <ShimmerBox className="h-6 w-16 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <ShimmerBox className="h-7 w-20 rounded-full" />
              <ShimmerBox className="h-7 w-24 rounded-full" />
            </div>
          </div>

          <ShimmerBox className="h-20 w-full rounded-xl" />

          <div className="space-y-2">
            <ShimmerBox className="h-4 w-full" />
            <ShimmerBox className="h-4 w-full" />
            <ShimmerBox className="h-4 w-3/4" />
          </div>

          <div className="space-y-4">
            <ShimmerBox className="h-6 w-24" />
            <ShimmerBox className="h-32 w-full rounded-xl" />
            <ShimmerBox className="h-32 w-full rounded-xl" />
          </div>

          <ShimmerBox className="h-24 w-full rounded-xl" />
        </div>

        {/* Right Pane - Code Editor */}
        <div className="flex-1 flex flex-col">
          {/* Editor Header */}
          <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
            <ShimmerBox className="h-8 w-32 rounded-lg" />
            <div className="flex gap-2">
              <ShimmerBox className="h-8 w-8 rounded-lg" />
              <ShimmerBox className="h-8 w-8 rounded-lg" />
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 bg-[#1E1E1E] p-4">
            <div className="space-y-2">
              {[...Array(15)].map((_, i) => (
                <ShimmerBox key={i} className="h-6 w-full" style={{ width: `${Math.random() * 40 + 60}%` }} />
              ))}
            </div>
          </div>

          {/* Bottom Tabs */}
          <div className="border-t border-border bg-card">
            <div className="flex gap-4 px-4 border-b border-border">
              <ShimmerBox className="h-10 w-24" />
              <ShimmerBox className="h-10 w-20" />
              <ShimmerBox className="h-10 w-20" />
            </div>
            <div className="p-4">
              <ShimmerBox className="h-32 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
