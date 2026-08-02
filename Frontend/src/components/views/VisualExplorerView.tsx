"use client";

import { useAppStore } from '@/store/useAppStore';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '@/components/ui/card';

export function VisualExplorerView() {
  const { graphData } = useAppStore();

  return (
    <div className="w-full h-full flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Visual Explorer</h2>
          <p className="text-muted-foreground mt-1">Dependency graph representation of your parsed codebase.</p>
        </div>
      </div>
      
      <Card className="flex-1 overflow-hidden border-border/50 shadow-inner bg-card/50 relative rounded-2xl">
        {graphData ? (
          <ReactFlow 
            nodes={graphData.nodes}
            edges={graphData.edges}
            fitView
            className="bg-transparent"
          >
            <Background color="#f97316" gap={20} size={1} />
            <Controls className="bg-card border-border fill-foreground" />
            <MiniMap 
              className="bg-card border border-border rounded-lg overflow-hidden" 
              nodeColor="#f97316" 
              maskColor="oklch(0.18 0.01 270 / 50%)"
            />
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No graph data available. Run a crawl first.
          </div>
        )}
      </Card>
    </div>
  );
}
