'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded-hf-container bg-hf-bg-surface p-1 text-hf-text-muted',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-7 items-center justify-center rounded-hf-control px-3 text-sm font-medium whitespace-nowrap transition-colors duration-(--hf-duration-fast) outline-none hover:text-hf-text-body focus-visible:ring-2 focus-visible:ring-hf-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-hf-bg-card data-[state=active]:text-hf-text-heading data-[state=active]:shadow-hf-card',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'mt-4 outline-none focus-visible:ring-2 focus-visible:ring-hf-ring',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
