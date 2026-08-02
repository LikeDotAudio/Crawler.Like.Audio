"use client";

import { Sidebar } from '@/components/layout/Sidebar';
import { CrawlerView } from '@/components/views/CrawlerView';
import { VisualExplorerView } from '@/components/views/VisualExplorerView';
import { UsbScannerView } from '@/components/views/UsbScannerView';
import { WebCrawlerView } from '@/components/views/WebCrawlerView';
import { PdfToMdView } from '@/components/views/PdfToMdView';
import { RegeneratorView } from '@/components/views/RegeneratorView';
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
        
        <div className="p-8 h-full max-w-7xl mx-auto">
          {activeTab === 'crawler' && <CrawlerView />}
          {activeTab === 'visualizer' && <VisualExplorerView />}
          {activeTab === 'usb' && <UsbScannerView />}
          {activeTab === 'web-crawler' && <WebCrawlerView />}
          {activeTab === 'pdf-to-md' && <PdfToMdView />}
          {activeTab === 'regenerator' && <RegeneratorView />}
          {activeTab === 'settings' && (
            <div className="flex items-center justify-center h-full text-muted-foreground animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold text-foreground">Settings</h2>
                <p>Configuration options will be available here.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
