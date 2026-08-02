# src/tabs/usb_devices_tab.py

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import threading
import os
import platform
import webbrowser
from ..styles import *

try:
    import usb.core
    import usb.util
    PYUSB_AVAILABLE = True
except ImportError:
    PYUSB_AVAILABLE = False

class USBDevicesTab(ttk.Frame):
    # Common Vendor IDs for lookup when permissions fail
    COMMON_VENDORS = {
        0x1d6b: "Linux Foundation",
        0x046d: "Logitech, Inc.",
        0x413c: "Dell Computer Corp.",
        0x05e3: "Genesys Logic, Inc.",
        0x1a40: "Terminus Technology Inc.",
        0x1038: "SteelSeries ApS",
        0x0a5f: "Zebra",
        0x05ac: "Apple, Inc.",
        0x04f2: "Chicony Electronics Co., Ltd.",
        0x045e: "Microsoft Corp.",
        0x0bda: "Realtek Semiconductor Corp.",
        0x0424: "SMSC",
        0x0781: "SanDisk Corp.",
        0x0930: "Toshiba Corp.",
        0x13fe: "Kingston Technology Company Inc.",
        0x0951: "Kingston Technology",
        0x0480: "Toshiba",
        0x0bc2: "Seagate RSS LLC",
        0x174c: "ASMedia Technology Inc.",
        0x2109: "VIA Labs, Inc.",
        0x03f0: "HP, Inc.",
        0x04b3: "IBM Corp.",
        0x04f3: "Elan Microelectronics Corp.",
        0x0cf3: "Qualcomm Atheros Communications",
        0x8087: "Intel Corp.",
        0x0dba: "Digidesign"
    }

    def __init__(self, parent):
        super().__init__(parent)
        self.devices_data = []
        self._setup_ui()

    def _setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # --- Top Actions ---
        top_frame = ttk.Frame(self)
        top_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        
        self.scan_btn = ttk.Button(top_frame, text=" 🔍 SCAN USB DEVICES ", command=self._start_scan)
        self.scan_btn.pack(side="left", padx=5)
        
        self.export_btn = ttk.Button(top_frame, text=" 💾 EXPORT TO TEXT ", command=self._export_data, state="disabled")
        self.export_btn.pack(side="left", padx=5)

        self.online_btn = ttk.Button(top_frame, text=" 🌐 CHECK SELECTED ONLINE ", command=self._on_check_online, state="disabled")
        self.online_btn.pack(side="left", padx=5)

        self.status_label = ttk.Label(top_frame, text="Ready to scan.", foreground=COLOR_TEXT_MUTED)
        self.status_label.pack(side="left", padx=20)

        self.info_label = ttk.Label(top_frame, text="💡 Tip: On Linux, use 'sudo' or udev rules for full names.", font=("Segoe UI", 8, "italic"), foreground=COLOR_TEXT_MUTED)
        self.info_label.pack(side="right", padx=10)

        # --- Content Area ---
        self.paned = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        self.paned.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        # Left: Treeview
        self.tree_frame = ttk.Frame(self.paned)
        self.paned.add(self.tree_frame, weight=1)
        
        self.tree = ttk.Treeview(self.tree_frame, columns=("Value"), show="tree headings")
        self.tree.heading("#0", text=" Device / Property ", anchor="w")
        self.tree.heading("Value", text=" Value ", anchor="w")
        self.tree.column("Value", width=300)
        self.tree.pack(side="left", fill="both", expand=True)

        tree_vsb = ttk.Scrollbar(self.tree_frame, orient="vertical", command=self.tree.yview)
        tree_vsb.pack(side="right", fill="y")
        self.tree.configure(yscrollcommand=tree_vsb.set)
        
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        # Right: Detailed Text View
        self.details_frame = ttk.LabelFrame(self.paned, text=" 📝 FULL DEVICE SPECIFICATIONS ")
        self.paned.add(self.details_frame, weight=1)
        
        self.details_text = tk.Text(self.details_frame, wrap="none", font=("Consolas", 9),
                                    bg=COLOR_BG_SURFACE, fg=COLOR_TEXT_MAIN,
                                    bd=0, insertbackground=COLOR_TEXT_MAIN,
                                    highlightthickness=1, highlightbackground=COLOR_BORDER)
        self.details_text.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        
        details_vsb = ttk.Scrollbar(self.details_frame, orient="vertical", command=self.details_text.yview)
        details_vsb.pack(side="right", fill="y")
        details_hsb = ttk.Scrollbar(self.details_frame, orient="horizontal", command=self.details_text.xview)
        details_hsb.pack(side="bottom", fill="x")
        self.details_text.configure(yscrollcommand=details_vsb.set, xscrollcommand=details_hsb.set)
        self.details_text.config(state="disabled")

        if not PYUSB_AVAILABLE:
            self.status_label.config(text="Error: pyusb not installed.", foreground="#ff5555")
            self.scan_btn.config(state="disabled")

    def _start_scan(self):
        self.scan_btn.config(state="disabled")
        self.export_btn.config(state="disabled")
        self.online_btn.config(state="disabled")
        self.status_label.config(text="Scanning... (This may take a moment)")
        self.tree.delete(*self.tree.get_children())
        self.devices_data = []
        
        threading.Thread(target=self._scan_thread, daemon=True).start()

    def _get_sysfs_info(self, bus, address):
        """Linux-specific fallback to get names from sysfs without needing USB permissions."""
        if platform.system() != "Linux":
            return None, None, None
            
        try:
            base_path = "/sys/bus/usb/devices/"
            if not os.path.exists(base_path):
                return None, None, None
                
            for d in os.listdir(base_path):
                path = os.path.join(base_path, d)
                try:
                    with open(os.path.join(path, "busnum"), "r") as f:
                        b = int(f.read().strip())
                    with open(os.path.join(path, "devnum"), "r") as f:
                        a = int(f.read().strip())
                        
                    if b == bus and a == address:
                        m, p, s = "Unknown", "Unknown", "N/A"
                        if os.path.exists(os.path.join(path, "manufacturer")):
                            with open(os.path.join(path, "manufacturer"), "r") as f:
                                m = f.read().strip()
                        if os.path.exists(os.path.join(path, "product")):
                            with open(os.path.join(path, "product"), "r") as f:
                                p = f.read().strip()
                        if os.path.exists(os.path.join(path, "serial")):
                            with open(os.path.join(path, "serial"), "r") as f:
                                s = f.read().strip()
                        return m, p, s
                except:
                    continue
        except:
            pass
        return None, None, None

    def _resolve_common_ids(self, vid, pid):
        """Hardcoded resolution for very common IDs."""
        m = self.COMMON_VENDORS.get(vid)
        p = None
        if vid == 0x1d6b:
            if pid == 0x0001: p = "1.1 root hub"
            elif pid == 0x0002: p = "2.0 root hub"
            elif pid == 0x0003: p = "3.0 root hub"
        return m, p

    def _scan_thread(self):
        try:
            devices = usb.core.find(find_all=True)
            for dev in devices:
                vid_hex = hex(dev.idVendor)
                pid_hex = hex(dev.idProduct)
                
                manufacturer = "Unknown"
                product = "Unknown"
                serial = "N/A"
                source = "None"
                
                # 1. Try pyusb (requires permissions)
                try:
                    manufacturer = usb.util.get_string(dev, dev.iManufacturer)
                    product = usb.util.get_string(dev, dev.iProduct)
                    serial = usb.util.get_string(dev, dev.iSerialNumber)
                    source = "pyusb"
                except:
                    # 2. Try sysfs fallback on Linux
                    m_sys, p_sys, s_sys = self._get_sysfs_info(dev.bus, dev.address)
                    if m_sys and (m_sys != "Unknown" or p_sys != "Unknown"):
                        manufacturer, product, serial = m_sys, p_sys, s_sys
                        source = "sysfs"
                    
                    # 3. Try hardcoded common IDs lookup
                    m_id, p_id = self._resolve_common_ids(dev.idVendor, dev.idProduct)
                    if m_id:
                        if manufacturer == "Unknown": 
                            manufacturer = m_id
                            if source == "None": source = "Internal DB"
                        if product == "Unknown" and p_id: 
                            product = p_id
                            if source == "None": source = "Internal DB"

                dev_info = {
                    "idVendor": vid_hex,
                    "idProduct": pid_hex,
                    "manufacturer": str(manufacturer),
                    "product": str(product),
                    "serial": str(serial),
                    "bus": dev.bus,
                    "address": dev.address,
                    "source": source,
                    "full_str": str(dev)
                }
                self.devices_data.append(dev_info)
            
            self.after(0, self._update_tree)
        except Exception as e:
            self.after(0, lambda: self._handle_error(e))

    def _handle_error(self, e):
        self.status_label.config(text=f"Error: {str(e)}", foreground="#ff5555")
        self.scan_btn.config(state="normal")
        messagebox.showerror("Scan Error", f"Failed to scan USB devices:\n{e}")

    def _update_tree(self):
        for i, dev in enumerate(self.devices_data):
            dev_label = f"Device {i+1}: {dev['manufacturer']} {dev['product']}"
            parent = self.tree.insert("", "end", text=dev_label, values=("",), open=False)
            
            self.tree.insert(parent, "end", text="Manufacturer", values=(dev['manufacturer'],))
            self.tree.insert(parent, "end", text="Product", values=(dev['product'],))
            self.tree.insert(parent, "end", text="Vendor ID", values=(dev['idVendor'],))
            self.tree.insert(parent, "end", text="Product ID", values=(dev['idProduct'],))
            self.tree.insert(parent, "end", text="Serial Number", values=(dev['serial'],))
            self.tree.insert(parent, "end", text="Bus", values=(dev['bus'],))
            self.tree.insert(parent, "end", text="Address", values=(dev['address'],))
            self.tree.insert(parent, "end", text="Resolution Source", values=(dev['source'],))
            
            self.tree.item(parent, tags=(str(i),))

        self.status_label.config(text=f"Scan complete. Found {len(self.devices_data)} devices.", foreground=COLOR_PRIMARY)
        self.scan_btn.config(state="normal")
        if self.devices_data:
            self.export_btn.config(state="normal")

    def _on_tree_select(self, event):
        selected = self.tree.selection()
        if not selected:
            self.online_btn.config(state="disabled")
            return
        
        self.online_btn.config(state="normal")
        item = selected[0]
        tags = self.tree.item(item, "tags")
        
        if tags:
            idx = int(tags[0])
            full_details = self.devices_data[idx]['full_str']
            
            self.details_text.config(state="normal")
            self.details_text.delete("1.0", "end")
            self.details_text.insert("1.0", full_details)
            self.details_text.config(state="disabled")

    def _on_check_online(self):
        selected = self.tree.selection()
        if not selected: return
        item = selected[0]
        # Get the parent if we selected a child node
        while self.tree.parent(item):
            item = self.tree.parent(item)
            
        tags = self.tree.item(item, "tags")
        if not tags: return
        
        idx = int(tags[0])
        dev = self.devices_data[idx]
        vid = dev['idVendor'].replace('0x', '').zfill(4)
        pid = dev['idProduct'].replace('0x', '').zfill(4)
        
        url = f"https://devicehunt.com/view/type/usb/vendor/{vid}/device/{pid}"
        webbrowser.open(url)

    def _export_data(self):
        if not self.devices_data: return
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("JSON files", "*.json"), ("All files", "*.*")],
            title="Export USB Device Data"
        )
        
        if file_path:
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    if file_path.endswith(".json"):
                        json.dump(self.devices_data, f, indent=4)
                    else:
                        for i, dev in enumerate(self.devices_data):
                            f.write(f"=== DEVICE {i+1} ===\n")
                            f.write(f"Manufacturer: {dev['manufacturer']}\n")
                            f.write(f"Product:      {dev['product']}\n")
                            f.write(f"Vendor ID:    {dev['idVendor']}\n")
                            f.write(f"Product ID:   {dev['idProduct']}\n")
                            f.write(f"Serial:       {dev['serial']}\n")
                            f.write(f"Bus:          {dev['bus']}\n")
                            f.write(f"Address:      {dev['address']}\n")
                            f.write(f"Source:       {dev['source']}\n")
                            f.write("-" * 20 + "\n")
                            f.write(dev['full_str'])
                            f.write("\n\n" + "="*40 + "\n\n")
                messagebox.showinfo("Export Successful", f"Data exported to:\n{file_path}")
            except Exception as e:
                messagebox.showerror("Export Error", f"Failed to export data: {e}")
