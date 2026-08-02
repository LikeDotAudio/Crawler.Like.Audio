"use client";

import { Sidebar } from '@/components/layout/Sidebar';
import { CrawlerView } from '@/components/views/CrawlerView';
import { VisualExplorerView } from '@/components/views/VisualExplorerView';
import { HardwareAuditorView } from '@/components/views/HardwareAuditorView';
import { NetworkScannerView } from '@/components/views/NetworkScannerView';
import { WebCrawlerView } from '@/components/views/WebCrawlerView';
import { PdfToMdView } from '@/components/views/PdfToMdView';
import { RegeneratorView } from '@/components/views/RegeneratorView';
import { AuditView } from '@/components/views/AuditView';
import { useAppStore } from '@/store/useAppStore';

export default function Home() {
  const { activeTab } = useAppStore();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent -z-10 pointer-events-none" />
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
        
        <div className="p-8 min-h-full max-w-7xl mx-auto">
          {activeTab === 'crawler' && <CrawlerView />}
          {activeTab === 'visualizer' && <VisualExplorerView />}
          {activeTab === 'hardware' && <HardwareAuditorView />}
          {activeTab === 'network' && <NetworkScannerView />}
          {activeTab === 'web-crawler' && <WebCrawlerView />}
          {activeTab === 'pdf-to-md' && <PdfToMdView />}
          {activeTab === 'regenerator' && <RegeneratorView />}
          {activeTab === 'audit' && <AuditView />}
        </div>
      </main>
    </div>
  );
}
