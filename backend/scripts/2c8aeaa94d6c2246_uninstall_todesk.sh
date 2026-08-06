#!/bin/bash
# ToDesk 企业主控版（Ubuntu）一键彻底卸载脚本
# 使用方法：sudo bash uninstall_todesk.sh

set -e  # 遇到错误即退出

# ---------- 颜色定义 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---------- 检查 root 权限 ----------
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 sudo 或以 root 用户运行此脚本。${NC}"
    exit 1
fi

# ---------- 确认卸载 ----------
echo -e "${YELLOW}即将彻底卸载 ToDesk 企业主控版及其所有配置文件。${NC}"
read -p "确认继续？(输入 y/Y 继续): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消操作。"
    exit 0
fi

# ---------- 自动检测包名 ----------
echo -e "${GREEN}正在检测已安装的 ToDesk 软件包...${NC}"
PACKAGE=$(dpkg -l | grep -E "todesk(client|)" | awk '{print $2}' | grep -v "^todesk$" | head -n1)
# 如果没找到，尝试更宽松的匹配
if [ -z "$PACKAGE" ]; then
    PACKAGE=$(dpkg -l | grep -i todesk | awk '{print $2}' | head -n1)
fi

if [ -z "$PACKAGE" ]; then
    echo -e "${RED}未找到任何 ToDesk 软件包，可能已经卸载。${NC}"
    echo "但会继续清理残留文件..."
else
    echo -e "${GREEN}检测到包名：$PACKAGE${NC}"
fi

# ---------- 停止服务 ----------
echo -e "${GREEN}停止相关服务...${NC}"
systemctl stop todesk_client.service 2>/dev/null || true
systemctl stop todeskd.service 2>/dev/null || true
systemctl stop todesk.service 2>/dev/null || true

# ---------- 卸载软件包 ----------
if [ -n "$PACKAGE" ]; then
    echo -e "${GREEN}开始卸载 $PACKAGE ...${NC}"
    # 尝试 purge，如果失败则用 remove
    if ! apt purge -y "$PACKAGE" 2>/dev/null; then
        echo -e "${YELLOW}purge 失败，尝试使用 remove...${NC}"
        apt remove -y "$PACKAGE"
    fi
else
    echo -e "${YELLOW}未发现已安装的包，跳过卸载步骤。${NC}"
fi

# ---------- 清理残留文件和目录 ----------
echo -e "${GREEN}清理残留文件和目录...${NC}"

# 常见目录列表
DIRS_TO_REMOVE=(
    "/opt/todesk_client"
    "/opt/todesk"
    "/etc/todesk"
    "/var/log/todesk_master"
    "/var/log/todesk"
    "/var/crash/*todesk*.crash"
    "/etc/systemd/system/todesk_client.service"
    "/etc/systemd/system/multi-user.target.wants/todesk_client.service"
    "/etc/systemd/system/todesk.service"
    "/etc/systemd/system/todeskd.service"
)

for item in "${DIRS_TO_REMOVE[@]}"; do
    if [ -e "$item" ]; then
        echo "  删除 $item"
        rm -rf "$item"
    fi
done

# 用户目录下的配置（需要使用实际用户，因为脚本以 root 运行）
if [ -n "$SUDO_USER" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    if [ -d "$USER_HOME" ]; then
        USER_DIRS=(
            "$USER_HOME/.local/share/todesk_client"
            "$USER_HOME/.config/autostart/todesk_client.desktop"
            "$USER_HOME/.config/todesk"
            "$USER_HOME/.todesk"
        )
        for dir in "${USER_DIRS[@]}"; do
            if [ -e "$dir" ]; then
                echo "  删除 $dir"
                rm -rf "$dir"
            fi
        done
    fi
else
    echo -e "${YELLOW}未检测到 SUDO_USER，跳过用户目录清理（请手动清理 ~/.config/todesk 等）。${NC}"
fi

# ---------- 重置 systemd ----------
echo -e "${GREEN}重置 systemd...${NC}"
systemctl daemon-reload

# ---------- 清理依赖 ----------
echo -e "${GREEN}清理不再需要的依赖包...${NC}"
apt autoremove -y

# ---------- 验证结果 ----------
echo -e "${GREEN}卸载完成！验证结果：${NC}"
if dpkg -l | grep -qi todesk; then
    echo -e "${RED}警告：仍发现 ToDesk 相关软件包，请手动检查。${NC}"
    dpkg -l | grep -i todesk
else
    echo -e "${GREEN}未发现任何 ToDesk 软件包。${NC}"
fi

echo -e "${GREEN}残余文件检查（若有输出则表示未清理干净）：${NC}"
find / -name "*todesk*" -type f 2>/dev/null | grep -v "^/proc" | head -20

echo -e "${GREEN}脚本执行完毕。建议重启系统以确保所有更改生效。${NC}"