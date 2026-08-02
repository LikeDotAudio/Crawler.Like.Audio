import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LogEntry {
  message: string;
  timestamp: string;
}

export interface FileExtension {
  ext: string;
  count: number;
  sizeMB: number;
  selected: boolean;
  emoji?: string;
}

export interface FileCategory {
  name: string;
  extensions: FileExtension[];
}

interface AppState {
  activeTab: 'crawler' | 'visualizer' | 'hardware' | 'network' | 'web-crawler' | 'pdf-to-md' | 'regenerator' | 'audit' | 'program-map' | 'csv-to-json' | 'json-to-csv' | 'json-converter' | 'json-pretty-print' | 'audio-converter';
  setActiveTab: (tab: 'crawler' | 'visualizer' | 'hardware' | 'network' | 'web-crawler' | 'pdf-to-md' | 'regenerator' | 'audit' | 'program-map' | 'csv-to-json' | 'json-to-csv' | 'json-converter' | 'json-pretty-print' | 'audio-converter') => void;
  
  // Crawler State
  selectedFolder: string | null;
  setSelectedFolder: (folder: string | null) => void;
  dirHandle: any | null;
  setDirHandle: (handle: any | null) => void;
  recentFolders: string[];
  addRecentFolder: (folder: string) => void;
  
  // File Discovery State
  fileCategories: FileCategory[];
  setFileCategories: (categories: FileCategory[]) => void;
  toggleExtension: (categoryName: string, ext: string) => void;
  toggleCategory: (categoryName: string, selectAll: boolean) => void;
  toggleAllCategories: (selectAll: boolean) => void;
  
  isCrawling: boolean;
  setIsCrawling: (isCrawling: boolean) => void;
  crawlLogs: LogEntry[];
  addCrawlLog: (message: string) => void;
  clearLogs: () => void;
  
  graphData: { nodes: any[]; edges: any[] } | null;
  setGraphData: (data: { nodes: any[]; edges: any[] } | null) => void;
  
  mapText: string;
  setMapText: (text: string) => void;
  scrapeText: string;
  setScrapeText: (text: string) => void;
}

export const extensionEmojiMap: Record<string, string> = {
  '.js': '📜',
  '.php': '🐘',
  '.py': '🐍',
  '.sh': '🐚',
  '.json': '📋',
  '.sql': '🗄️',
  '.toml': '⚙️',
  '.yaml': '⚙️',
  '.yml': '⚙️',
  '.css': '🎨',
  '.htm': '🌐',
  '.html': '🌐',
  '.svg': '🖼️',
  '.ts': '📘',
  '.tsx': '⚛️',
  '.md': '📝',
  '.pdf': '📕'
};

const mockFileCategories: FileCategory[] = [
  {
    name: 'PROGRAMMING',
    extensions: [
      { ext: '.js', count: 23, sizeMB: 0.21, selected: true, emoji: '📜' },
      { ext: '.php', count: 4, sizeMB: 0.09, selected: true, emoji: '🐘' },
      { ext: '.py', count: 58, sizeMB: 0.23, selected: true, emoji: '🐍' },
      { ext: '.sh', count: 2, sizeMB: 0.01, selected: true, emoji: '🐚' },
    ]
  },
  {
    name: 'DATA & CONFIG',
    extensions: [
      { ext: '.json', count: 50, sizeMB: 0.80, selected: true, emoji: '📋' },
      { ext: '.sql', count: 28, sizeMB: 0.15, selected: true, emoji: '🗄️' },
      { ext: '.toml', count: 47, sizeMB: 0.14, selected: true, emoji: '⚙️' },
      { ext: '.yaml', count: 21, sizeMB: 0.39, selected: true, emoji: '⚙️' },
      { ext: '.yml', count: 2, sizeMB: 0.03, selected: true, emoji: '⚙️' },
    ]
  },
  {
    name: 'WEB & MARKUP',
    extensions: [
      { ext: '.css', count: 5, sizeMB: 0.02, selected: true, emoji: '🎨' },
      { ext: '.htm', count: 8, sizeMB: 1.50, selected: true, emoji: '🌐' },
      { ext: '.html', count: 117, sizeMB: 3.71, selected: true, emoji: '🌐' },
      { ext: '.svg', count: 192, sizeMB: 0.38, selected: true, emoji: '🖼️' },
      { ext: '.ts', count: 699, sizeMB: 4.28, selected: true, emoji: '📘' },
      { ext: '.tsx', count: 442, sizeMB: 3.34, selected: true, emoji: '⚛️' },
    ]
  },
  {
    name: 'DOCS',
    extensions: [
      { ext: '.md', count: 202, sizeMB: 1.63, selected: true, emoji: '📝' },
      { ext: '.pdf', count: 14, sizeMB: 4.55, selected: true, emoji: '📕' },
    ]
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'crawler',
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      selectedFolder: null,
      setSelectedFolder: (folder) => set({ selectedFolder: folder }),
      
      dirHandle: null,
      setDirHandle: (handle) => set({ dirHandle: handle }),
      
      recentFolders: [],
      addRecentFolder: (folder) => set((state) => {
        const folders = new Set([folder, ...state.recentFolders]);
        return { recentFolders: Array.from(folders).slice(0, 10) };
      }),
      
      fileCategories: [],
      setFileCategories: (categories) => set({ fileCategories: categories }),
      toggleExtension: (categoryName, ext) => set((state) => ({
        fileCategories: state.fileCategories.map(cat => 
          cat.name === categoryName 
            ? { ...cat, extensions: cat.extensions.map(e => e.ext === ext ? { ...e, selected: !e.selected } : e) }
            : cat
        )
      })),
      toggleCategory: (categoryName, selectAll) => set((state) => ({
        fileCategories: state.fileCategories.map(cat =>
          cat.name === categoryName
            ? { ...cat, extensions: cat.extensions.map(e => ({ ...e, selected: selectAll })) }
            : cat
        )
      })),
      toggleAllCategories: (selectAll) => set((state) => ({
        fileCategories: state.fileCategories.map(cat => ({
          ...cat,
          extensions: cat.extensions.map(e => ({ ...e, selected: selectAll }))
        }))
      })),
      
      isCrawling: false,
      setIsCrawling: (isCrawling) => set({ isCrawling }),
      
      crawlLogs: [],
      addCrawlLog: (message) => set((state) => ({ 
        crawlLogs: [...state.crawlLogs, { message, timestamp: new Date().toLocaleTimeString() }] 
      })),
      clearLogs: () => set({ crawlLogs: [] }),
      
      graphData: {
        nodes: [
          { id: '1', position: { x: 250, y: 0 }, data: { label: 'main.py' } },
          { id: '2', position: { x: 100, y: 100 }, data: { label: 'crawler_module.py' } },
          { id: '3', position: { x: 400, y: 100 }, data: { label: 'usb_scanner.py' } },
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', animated: true },
          { id: 'e1-3', source: '1', target: '3', animated: true },
        ]
      },
      setGraphData: (data) => set({ graphData: data }),
      
      mapText: '',
      setMapText: (text) => set({ mapText: text }),
      scrapeText: '',
      setScrapeText: (text) => set({ scrapeText: text }),
    }),
    {
      name: 'crawler-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({
        // Only persist these fields to local storage
        activeTab: state.activeTab,
        selectedFolder: state.selectedFolder,
        recentFolders: state.recentFolders,
      }),
    }
  )
);
