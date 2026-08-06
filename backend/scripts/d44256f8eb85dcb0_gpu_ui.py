#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
from threading import Thread
import re
import os
import sys
import time

class GPUPowerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("NVIDIA GPU 性能模式切换工具（修复版）")
        self.root.geometry("680x520")
        self.root.minsize(600, 450)

        # 检查 root 权限，若没有则通过 pkexec 提权（安全）
        if os.geteuid() != 0:
            self.auto_elevate()
            return

        self.style = ttk.Style()
        self.style.configure("Title.TLabel", font=("Microsoft YaHei", 12, "bold"))
        self.style.configure("Status.TLabel", font=("Consolas", 9))

        self.current_mode = tk.StringVar(value="unknown")
        self.gpu_info = {}
        self.max_power = None
        self.default_power = None
        self.min_power = None
        self.max_mem_clock = None
        self.max_gfx_clock = None

        self.get_gpu_capabilities()
        self.create_widgets()
        self.refresh_status()

    def auto_elevate(self):
        script = os.path.abspath(sys.argv[0])
        display = os.environ.get("DISPLAY", ":0")
        cmd = ["pkexec", "env", f"DISPLAY={display}", "python3", script]
        subprocess.Popen(cmd)
        self.root.destroy()
        sys.exit(0)

    def get_gpu_capabilities(self):
        # 功耗限制
        cmd = ["nvidia-smi", "--query-gpu=power.min_limit,power.default_limit,power.max_limit", "--format=csv,noheader"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            parts = result.stdout.strip().split(", ")
            self.min_power = float(parts[0].split()[0])
            self.default_power = float(parts[1].split()[0])
            self.max_power = float(parts[2].split()[0])
        else:
            self.min_power = 100.0
            self.default_power = 250.0
            self.max_power = 350.0

        # 最高时钟
        cmd = ["nvidia-smi", "-q", "-d", "SUPPORTED_CLOCKS"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            mem_matches = re.findall(r"Memory\s*:\s*(\d+)\s*MHz", result.stdout)
            if mem_matches:
                self.max_mem_clock = int(max(mem_matches, key=int))
            gfx_matches = re.findall(r"Graphics\s*:\s*(\d+)\s*MHz", result.stdout)
            if gfx_matches:
                self.max_gfx_clock = int(max(gfx_matches, key=int))
        if self.max_mem_clock is None:
            self.max_mem_clock = 12001
        if self.max_gfx_clock is None:
            self.max_gfx_clock = 3090

    def run_cmd(self, cmd, check=False):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            ok = result.returncode == 0
            if check and not ok:
                raise RuntimeError(f"命令失败: {' '.join(cmd)}\n{result.stderr}")
            return ok, result.stdout.strip(), result.stderr.strip()
        except Exception as e:
            return False, "", str(e)

    def set_powermizer_mode(self, mode_value):
        """尝试设置 PowerMizer，重试机制"""
        display = os.environ.get("DISPLAY", "")
        if not display:
            display = ":0"
        for attempt in range(5):
            cmd = ["nvidia-settings", "-c", display, "-a", f"[gpu:0]/GPUPowerMizerMode={mode_value}"]
            ok, _, err = self.run_cmd(cmd)
            if ok:
                return True
            time.sleep(1)  # 等待 X 就绪
        return False

    def create_widgets(self):
        # 标题
        ttk.Label(self.root, text="NVIDIA GPU 性能模式控制器（修复版）", style="Title.TLabel").pack(pady=10)

        # 信息显示
        info_frame = ttk.LabelFrame(self.root, text="GPU 当前状态", padding=10)
        info_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=5)
        text_frame = ttk.Frame(info_frame)
        text_frame.pack(fill=tk.BOTH, expand=True)
        self.info_text = tk.Text(text_frame, height=12, font=("Consolas", 9), wrap=tk.WORD)
        scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.info_text.yview)
        self.info_text.configure(yscrollcommand=scrollbar.set)
        self.info_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.info_text.config(state=tk.DISABLED)

        # 模式按钮
        mode_frame = ttk.LabelFrame(self.root, text="选择性能模式", padding=10)
        mode_frame.pack(fill=tk.X, padx=20, pady=5)
        btn_frame = ttk.Frame(mode_frame)
        btn_frame.pack()
        self.btn_max = ttk.Button(btn_frame, text="🚀 最大性能模式 (P0)", command=lambda: self.set_mode("maxperf"), width=22)
        self.btn_max.grid(row=0, column=0, padx=10, pady=5)
        self.btn_auto = ttk.Button(btn_frame, text="⚖️ 自动平衡模式", command=lambda: self.set_mode("auto"), width=22)
        self.btn_auto.grid(row=0, column=1, padx=10, pady=5)
        self.btn_low = ttk.Button(btn_frame, text="💚 低功耗模式 (P2)", command=lambda: self.set_mode("lowpower"), width=22)
        self.btn_low.grid(row=0, column=2, padx=10, pady=5)

        # 底部按钮
        bottom_frame = ttk.Frame(self.root)
        bottom_frame.pack(fill=tk.X, padx=20, pady=10)
        ttk.Button(bottom_frame, text="🔄 刷新状态", command=self.refresh_status).pack(side=tk.LEFT, padx=5)
        ttk.Button(bottom_frame, text="⚙️ 设置开机自启 (当前模式)", command=self.set_startup).pack(side=tk.LEFT, padx=5)
        ttk.Button(bottom_frame, text="❌ 取消开机自启", command=self.remove_startup).pack(side=tk.LEFT, padx=5)

        # 状态栏
        self.status_var = tk.StringVar(value="就绪")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(fill=tk.X, side=tk.BOTTOM, ipady=2)

    def refresh_status(self):
        self.status_var.set("正在获取 GPU 状态...")
        Thread(target=self._do_refresh, daemon=True).start()

    def _do_refresh(self):
        # 获取基本信息
        ok, output, _ = self.run_cmd([
            "nvidia-smi", "--query-gpu=name,driver_version,power.limit,clocks.current.graphics,clocks.current.memory",
            "--format=csv,noheader"
        ])
        if not ok or not output:
            self.root.after(0, lambda: messagebox.showerror("错误", "无法获取 GPU 信息，请检查驱动。"))
            self.root.after(0, lambda: self.status_var.set("获取失败"))
            return

        parts = [p.strip() for p in output.split(", ")]
        gpu_name = parts[0]
        driver_ver = parts[1]
        current_power = float(parts[2].split()[0]) if parts[2] != "[N/A]" else 0.0
        gfx_clock = parts[3]
        mem_clock = parts[4]

        # 获取更多状态
        _, q_out, _ = self.run_cmd(["nvidia-smi", "-q", "-d", "PERSISTENCE,PERFORMANCE,CLOCK"])
        pm_match = re.search(r"Persistence Mode\s*:\s*(\S+)", q_out)
        pm_str = pm_match.group(1) if pm_match else "Unknown"
        pstate_match = re.search(r"Performance State\s*:\s*(\S+)", q_out)
        pstate = pstate_match.group(1) if pstate_match else "Unknown"

        # 判断是否锁定
        has_app_clocks = "Applications Clocks" in q_out
        locked = has_app_clocks
        app_mem = app_gfx = None
        if has_app_clocks:
            mem_match = re.search(r"Memory\s*:\s*(\d+)\s*MHz", q_out)
            gfx_match = re.search(r"Graphics\s*:\s*(\d+)\s*MHz", q_out)
            if mem_match:
                app_mem = int(mem_match.group(1))
            if gfx_match:
                app_gfx = int(gfx_match.group(1))

        # 模式识别（增强）
        is_maxperf = (pstate == "P0" and locked and
                      app_mem == self.max_mem_clock and app_gfx == self.max_gfx_clock)
        is_lowpower = (pstate == "P2" and not locked)
        is_auto = (not is_maxperf and not is_lowpower)

        mode = "maxperf" if is_maxperf else ("lowpower" if is_lowpower else "auto")

        info_text = f"""GPU 型号: {gpu_name}
驱动版本: {driver_ver}
持久化模式: {pm_str}
当前性能状态: {pstate}
当前功耗限制: {current_power:.2f} W  (最大支持: {self.max_power:.0f} W)
当前核心频率: {gfx_clock}
当前显存频率: {mem_clock}
频率锁定状态: {'已锁定' if locked else '自动调节'}
"""
        if has_app_clocks and app_mem and app_gfx:
            info_text += f"锁定时钟值:   {app_mem} MHz (显存) / {app_gfx} MHz (核心)\n"
        self.root.after(0, lambda: self._update_info_text(info_text))
        self.root.after(0, lambda: self._update_buttons_state(mode))
        self.root.after(0, lambda: self.status_var.set("状态已更新"))

    def _update_info_text(self, text):
        self.info_text.config(state=tk.NORMAL)
        self.info_text.delete(1.0, tk.END)
        self.info_text.insert(tk.END, text)
        self.info_text.config(state=tk.DISABLED)

    def _update_buttons_state(self, mode):
        self.btn_max.config(state=tk.NORMAL)
        self.btn_auto.config(state=tk.NORMAL)
        self.btn_low.config(state=tk.NORMAL)
        if mode == "maxperf":
            self.btn_max.config(state=tk.DISABLED)
        elif mode == "lowpower":
            self.btn_low.config(state=tk.DISABLED)
        else:
            self.btn_auto.config(state=tk.DISABLED)

    def set_mode(self, mode):
        self.status_var.set(f"正在切换到 {mode} 模式...")
        self.btn_max.config(state=tk.DISABLED)
        self.btn_auto.config(state=tk.DISABLED)
        self.btn_low.config(state=tk.DISABLED)
        Thread(target=self._do_set_mode, args=(mode,), daemon=True).start()

    def _do_set_mode(self, mode):
        # 开启持久化
        ok, _, err = self.run_cmd(["nvidia-smi", "-pm", "1"])
        if not ok:
            self.root.after(0, lambda: messagebox.showerror("错误", f"开启持久化模式失败：{err}"))
            self.root.after(0, self.refresh_status)
            return

        if mode == "maxperf":
            self.run_cmd(["nvidia-smi", "-pl", str(int(self.max_power))])
            self.run_cmd(["nvidia-smi", "-ac", f"{self.max_mem_clock},{self.max_gfx_clock}"])
            self.set_powermizer_mode(1)
            msg = "已切换到最大性能模式 (P0 + PowerMizer最高性能)。"
        elif mode == "lowpower":
            low_power = self.min_power + 10
            self.run_cmd(["nvidia-smi", "-pl", f"{low_power:.1f}"])
            self.run_cmd(["nvidia-smi", "-rac"])
            self.set_powermizer_mode(2)
            msg = "已切换到低功耗模式 (P2 + PowerMizer低功耗)。"
        else:
            self.run_cmd(["nvidia-smi", "-pl", str(int(self.default_power))])
            self.run_cmd(["nvidia-smi", "-rac"])
            self.set_powermizer_mode(0)
            msg = "已切换到自动平衡模式 (PowerMizer自适应)。"

        self.root.after(0, lambda: messagebox.showinfo("成功", msg))
        self.root.after(500, self.refresh_status)

    def set_startup(self):
        """生成并启用 systemd 服务"""
        # 判断当前模式
        if self.btn_max.instate(['disabled']):
            mode = "maxperf"
        elif self.btn_low.instate(['disabled']):
            mode = "lowpower"
        else:
            mode = "auto"

        if mode == "maxperf":
            pl_val = str(int(self.max_power))
            ac_cmd = f"nvidia-smi -ac {self.max_mem_clock},{self.max_gfx_clock}"
            pm_mode = 1
        elif mode == "lowpower":
            pl_val = f"{self.min_power + 10:.1f}"
            ac_cmd = "nvidia-smi -rac"
            pm_mode = 2
        else:
            pl_val = str(int(self.default_power))
            ac_cmd = "nvidia-smi -rac"
            pm_mode = 0

        service_content = f"""[Unit]
Description=Set GPU to {mode} mode on boot
After=graphical.target nvidia-persistenced.service
Requires=graphical.target
Wants=nvidia-persistenced.service

[Service]
Type=oneshot
ExecStartPre=/usr/bin/nvidia-smi -pm 1
ExecStart=/usr/bin/nvidia-smi -pl {pl_val}
ExecStart=/usr/bin/nvidia-smi -pm 1
ExecStart=/bin/bash -c "{ac_cmd}"
ExecStartPost=/bin/bash -c "
  for i in {{1..10}}; do
    DISPLAY=:0 /usr/bin/nvidia-settings -c :0 -a '[gpu:0]/GPUPowerMizerMode={pm_mode}' && exit 0
    sleep 2
  done
  exit 1
"
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
"""
        service_path = "/etc/systemd/system/gpu-perf.service"
        try:
            with open(service_path, "w") as f:
                f.write(service_content)
        except Exception as e:
            messagebox.showerror("错误", f"写入服务文件失败：{e}")
            return

        ok, out, err = self.run_cmd(["systemctl", "enable", "gpu-perf.service"])
        if not ok:
            messagebox.showerror("错误", f"启用服务失败：{err}")
            return
        ok, out, err = self.run_cmd(["systemctl", "start", "gpu-perf.service"])
        if not ok:
            messagebox.showwarning("警告", f"立即启动服务失败（可能已存在）：{err}")

        messagebox.showinfo("成功", f"已设置开机自动切换到 {mode} 模式。\n下次重启后生效。")

    def remove_startup(self):
        """取消开机自启"""
        ok, _, err = self.run_cmd(["systemctl", "disable", "gpu-perf.service"])
        if not ok:
            messagebox.showerror("错误", f"禁用服务失败：{err}")
            return
        try:
            os.remove("/etc/systemd/system/gpu-perf.service")
        except:
            pass
        self.run_cmd(["systemctl", "daemon-reload"])
        messagebox.showinfo("成功", "已取消开机自启。")

if __name__ == "__main__":
    root = tk.Tk()
    app = GPUPowerGUI(root)
    root.mainloop()