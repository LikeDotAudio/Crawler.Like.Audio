import { useAppStore } from '@/store/useAppStore';
import { Search, Network as NetworkIcon, Settings, Globe, FileType, RefreshCw, ShieldAlert, Cpu, Wifi, FolderTree, Table, FileJson, CodeXml, Music } from 'lucide-react';
import { SpiderLogo } from './SpiderLogo';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore();

  const tabGroups = [
    {
      title: 'Local Folder and File Crawler',
      tabs: [
        { id: 'crawler', label: 'File Crawler', icon: Search },
        { id: 'visualizer', label: 'Visual Explorer', icon: NetworkIcon },
        { id: 'program-map', label: 'Program Map', icon: FolderTree },
        { id: 'audit', label: 'Project Audit', icon: ShieldAlert },
        { id: 'regenerator', label: 'Regenerate', icon: RefreshCw },
      ]
    },
    {
      title: 'Web & Generation',
      tabs: [
        { id: 'web-crawler', label: 'Web Scraper', icon: Globe },
      ]
    },
    {
      title: 'Physical',
      tabs: [
        { id: 'hardware', label: 'Hardware Auditor', icon: Cpu },
        { id: 'network', label: 'Network Sweeper', icon: Wifi },
      ]
    },
    {
      title: 'Data Conversion',
      tabs: [
        { id: 'pdf-to-md', label: 'PDF to MD', icon: FileType },
        { id: 'csv-to-json', label: 'CSV Importer & Shuffler', icon: Table },
        { id: 'json-to-csv', label: 'JSON Importer & Shuffler', icon: FileJson },
      ]
    },
    {
      title: 'Media Conversion',
      tabs: [
        { id: 'audio-converter', label: 'Audio Converter', icon: Music },
      ]
    }
  ] as const;

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full shadow-lg z-10">
      <a 
        href="https://github.com/LikeDotAudio/Crawler.Like.Audio" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="p-6 flex items-center gap-3 border-b border-border hover:bg-accent/30 transition-colors cursor-pointer group"
      >
        <div className="bg-primary/20 p-2 rounded-xl text-primary group-hover:scale-110 transition-transform">
          <SpiderLogo className="w-6 h-6" />
        </div>
        <h1 className="font-bold text-xl tracking-tight">Crawler<span className="text-primary">.like.audio</span></h1>
      </a>
      
      <nav className="flex-1 p-4 overflow-y-auto space-y-6">
        {tabGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? 'default' : 'ghost'}
                    className={`w-full justify-start gap-3 relative transition-all duration-300 font-medium ${
                      isActive ? 'shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-[#0a2540]' : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab(tab.id as any)}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-primary rounded-md -z-10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border">
        {/* Footer reserved space */}
      </div>
    </div>
  );
}
