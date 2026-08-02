"use client";

import { useAppStore } from '@/store/useAppStore';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { Layers } from 'lucide-react';

function FlowMap({ nodes, edges }: { nodes: any[], edges: any[] }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timeout = setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 50);
    return () => clearTimeout(timeout);
  }, [nodes, edges, fitView]);

  return (
    <div className="w-full h-full">
      <ReactFlow 
        nodes={nodes}
        edges={edges}
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
    </div>
  );
}

export function VisualExplorerView() {
  const { graphData } = useAppStore();
  const [maxDepth, setMaxDepth] = useState<number | 'all'>('all');

  const filteredGraphData = useMemo(() => {
    if (!graphData) return null;
    if (maxDepth === 'all') return graphData;

    const filteredNodes = graphData.nodes
      .filter((node: any) => node.data && node.data.depth <= maxDepth)
      .map((node: any, index: number) => ({
        ...node,
        position: {
          ...node.position,
          y: index * 80
        }
      }));
      
    const filteredNodeIds = new Set(filteredNodes.map((n: any) => n.id));
    
    const filteredEdges = graphData.edges.filter(
      (edge: any) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [graphData, maxDepth]);

  return (
    <div className="w-full flex-1 flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Visual Explorer</h2>
          <p className="text-muted-foreground mt-1">Dependency graph representation of your parsed codebase.</p>
        </div>
        
        {graphData && (
          <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-lg p-1.5 shadow-sm">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pl-2 pr-1 uppercase tracking-wider font-semibold">
              <Layers className="w-3 h-3" /> Depth:
            </div>
            {[1, 2, 3, 4, 5, 6].map((depth) => (
              <Button
                key={depth}
                variant={maxDepth === depth ? "default" : "ghost"}
                size="sm"
                className={`h-7 w-7 p-0 ${maxDepth === depth ? "shadow-sm shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMaxDepth(depth)}
              >
                {depth}
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant={maxDepth === 'all' ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-3 text-xs ${maxDepth === 'all' ? "shadow-sm shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMaxDepth('all')}
            >
              ALL
            </Button>
          </div>
        )}
      </div>
      
      <Card className="flex-1 overflow-hidden border-border/50 shadow-inner bg-card/50 relative rounded-2xl">
        {filteredGraphData ? (
          <ReactFlowProvider>
            <FlowMap nodes={filteredGraphData.nodes} edges={filteredGraphData.edges} />
          </ReactFlowProvider>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No graph data available. Run a crawl first.
          </div>
        )}
      </Card>
    </div>
  );
}
