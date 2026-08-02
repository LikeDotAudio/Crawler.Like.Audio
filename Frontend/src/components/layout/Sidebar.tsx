import { useAppStore } from '@/store/useAppStore';
import { Search, Network, Usb, Settings, Hexagon, Globe, FileType, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function Sidebar() {
  const { activeTab, setActiveTab } = useAppStore();

  const tabs = [
    { id: 'crawler', label: 'File Crawler', icon: Search },
    { id: 'visualizer', label: 'Visual Explorer', icon: Network },
    { id: 'usb', label: 'USB Scanner', icon: Usb },
    { id: 'web-crawler', label: 'Web Scraper', icon: Globe },
    { id: 'pdf-to-md', label: 'PDF to MD', icon: FileType },
    { id: 'regenerator', label: 'Regenerate', icon: RefreshCw },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full shadow-lg z-10">
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <div className="bg-primary/20 p-2 rounded-xl text-primary">
          <Hexagon className="w-6 h-6" />
        </div>
        <h1 className="font-bold text-xl tracking-tight">Crawler<span className="text-primary">.dev</span></h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'default' : 'ghost'}
              className={`w-full justify-start gap-3 relative transition-all duration-300 ${
                isActive ? 'shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground' : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab.id)}
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
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          System Analytics v2.0
        </div>
      </div>
    </div>
  );
}
