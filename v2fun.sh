#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  V2Fun 一键管理脚本
# ============================================================

REPO_URL="https://github.com/jx453331958/v2fun.git"
CONF_FILE=""        # 安装后指向 $INSTALL_DIR/.v2fun.conf
INSTALL_DIR=""      # 从 conf 或交互获取
COMPOSE_CMD=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()     { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# ── 工具函数 ──────────────────────────────────────────────

get_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"
}

# 从已有安装目录加载配置
load_conf() {
  local dir="${V2FUN_DIR:-$(pwd)}"
  if [ -f "$dir/.v2fun.conf" ]; then
    # shellcheck source=/dev/null
    source "$dir/.v2fun.conf"
    INSTALL_DIR="$dir"
    CONF_FILE="$dir/.v2fun.conf"
    return 0
  fi
  return 1
}

# 读取已保存的端口（用于 status 显示等）
get_port() {
  if [ -n "$CONF_FILE" ] && [ -f "$CONF_FILE" ]; then
    # shellcheck source=/dev/null
    source "$CONF_FILE"
    echo "${V2FUN_PORT:-3210}"
  else
    echo "3210"
  fi
}

# ── 前置检查 ──────────────────────────────────────────────

check_docker() {
  command -v docker &>/dev/null || err "未检测到 Docker，请先安装: https://docs.docker.com/get-docker/"
  docker info &>/dev/null 2>&1  || err "Docker 未运行，请先启动 Docker"
}

check_compose() {
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    err "未检测到 Docker Compose，请先安装"
  fi
}

check_git() {
  command -v git &>/dev/null || err "未检测到 Git，请先安装"
}

require_installed() {
  load_conf || err "V2Fun 尚未安装，请先选择「安装」"
  check_docker
  check_compose
}

# ── 生成 docker-compose.yml ──────────────────────────────

generate_compose() {
  local port="$1"
  cat > "$INSTALL_DIR/docker-compose.yml" <<YAML
services:
  v2fun:
    build: .
    ports:
      - "${port}:3210"
    environment:
      - NODE_ENV=production
      - PORT=3210
    restart: unless-stopped
YAML
}

# 保存配置
save_conf() {
  local port="$1"
  cat > "$INSTALL_DIR/.v2fun.conf" <<CONF
# V2Fun 配置 — 由安装脚本自动生成，请勿手动修改
V2FUN_PORT=${port}
CONF
  CONF_FILE="$INSTALL_DIR/.v2fun.conf"
}

# ── 交互式安装 ────────────────────────────────────────────

do_install() {
  echo ""
  echo -e "${BOLD}────────────────────────────────────${NC}"
  echo -e "${BOLD}  V2Fun 安装向导${NC}"
  echo -e "${BOLD}────────────────────────────────────${NC}"
  echo ""

  check_docker
  check_compose
  check_git

  # 1) 安装目录
  local default_dir="$(pwd)/v2fun"
  read -rp "$(echo -e "${CYAN}安装目录${NC} [${DIM}${default_dir}${NC}]: ")" input_dir
  INSTALL_DIR="${input_dir:-$default_dir}"

  if [ -d "$INSTALL_DIR" ]; then
    echo ""
    warn "目录 $INSTALL_DIR 已存在"
    read -rp "$(echo -e "覆盖安装？${DIM}(y/N)${NC} ")" confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { info "已取消"; exit 0; }
    # 停掉旧服务
    if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
      cd "$INSTALL_DIR"
      $COMPOSE_CMD down 2>/dev/null || true
      cd /
    fi
    rm -rf "$INSTALL_DIR"
  fi

  # 2) 端口
  local default_port=3210
  read -rp "$(echo -e "${CYAN}服务端口${NC} [${DIM}${default_port}${NC}]: ")" input_port
  local port="${input_port:-$default_port}"

  # 校验端口
  if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    err "无效端口: $port（范围 1-65535）"
  fi

  # 3) 确认
  echo ""
  echo -e "${BOLD}安装配置确认${NC}"
  echo "─────────────────────────────"
  echo -e "  安装目录:  ${BOLD}${INSTALL_DIR}${NC}"
  echo -e "  服务端口:  ${BOLD}${port}${NC}"
  echo -e "  访问地址:  ${BOLD}http://$(get_ip):${port}${NC}"
  echo "─────────────────────────────"
  echo ""
  read -rp "$(echo -e "确认开始安装？${DIM}(Y/n)${NC} ")" go
  [[ "$go" =~ ^[Nn]$ ]] && { info "已取消"; exit 0; }

  # 4) 执行安装
  echo ""
  info "克隆仓库 ..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"

  info "生成配置 ..."
  generate_compose "$port"
  save_conf "$port"

  info "构建 Docker 镜像（首次较慢，请耐心等待）..."
  cd "$INSTALL_DIR"
  $COMPOSE_CMD build --no-cache

  info "启动服务 ..."
  $COMPOSE_CMD up -d

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  success "安装完成！"
  echo ""
  echo -e "  访问地址:  ${BOLD}http://$(get_ip):${port}${NC}"
  echo -e "  管理脚本:  ${BOLD}cd ${INSTALL_DIR} && bash v2fun.sh${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# ── 交互式修改配置 ────────────────────────────────────────

do_config() {
  require_installed
  cd "$INSTALL_DIR"

  local current_port
  current_port="$(get_port)"

  echo ""
  echo -e "${BOLD}当前配置${NC}"
  echo "─────────────────────────────"
  echo -e "  安装目录:  ${INSTALL_DIR}"
  echo -e "  服务端口:  ${current_port}"
  echo "─────────────────────────────"
  echo ""

  read -rp "$(echo -e "${CYAN}新端口${NC} [${DIM}${current_port}${NC}，回车跳过]: ")" new_port

  if [ -z "$new_port" ]; then
    info "配置未修改"
    return
  fi

  if ! [[ "$new_port" =~ ^[0-9]+$ ]] || [ "$new_port" -lt 1 ] || [ "$new_port" -gt 65535 ]; then
    err "无效端口: $new_port（范围 1-65535）"
  fi

  info "更新配置 ..."
  generate_compose "$new_port"
  save_conf "$new_port"

  info "重启服务 ..."
  $COMPOSE_CMD down
  $COMPOSE_CMD up -d

  echo ""
  success "配置已更新，新地址: http://$(get_ip):${new_port}"
}

# ── 更新 ──────────────────────────────────────────────────

do_update() {
  require_installed
  check_git
  cd "$INSTALL_DIR"

  local port
  port="$(get_port)"

  info "检查更新 ..."
  git fetch origin
  local LOCAL REMOTE
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master)

  if [ "$LOCAL" = "$REMOTE" ]; then
    success "已是最新版本"
    return
  fi

  info "拉取新版本 ..."
  git reset --hard "$REMOTE"

  # 保留用户配置
  generate_compose "$port"

  info "重新构建镜像 ..."
  $COMPOSE_CMD build --no-cache

  info "重启服务 ..."
  $COMPOSE_CMD down
  $COMPOSE_CMD up -d

  docker image prune -f &>/dev/null || true

  success "更新完成！"
}

# ── 启停 ──────────────────────────────────────────────────

do_start() {
  require_installed
  cd "$INSTALL_DIR"
  $COMPOSE_CMD up -d
  success "V2Fun 已启动 — http://$(get_ip):$(get_port)"
}

do_stop() {
  require_installed
  cd "$INSTALL_DIR"
  $COMPOSE_CMD down
  success "V2Fun 已停止"
}

do_restart() {
  require_installed
  cd "$INSTALL_DIR"
  $COMPOSE_CMD down
  $COMPOSE_CMD up -d
  success "V2Fun 已重启 — http://$(get_ip):$(get_port)"
}

do_logs() {
  require_installed
  cd "$INSTALL_DIR"
  $COMPOSE_CMD logs -f --tail=100
}

do_status() {
  require_installed
  cd "$INSTALL_DIR"

  local port
  port="$(get_port)"

  echo ""
  echo -e "${BOLD}V2Fun 服务状态${NC}"
  echo "─────────────────────────────────"
  $COMPOSE_CMD ps
  echo "─────────────────────────────────"

  if $COMPOSE_CMD ps 2>/dev/null | grep -q "Up\|running"; then
    success "运行中 — http://$(get_ip):${port}"
  else
    warn "服务未运行"
  fi
  echo ""
}

# ── 卸载 ──────────────────────────────────────────────────

do_uninstall() {
  require_installed
  cd "$INSTALL_DIR"

  echo ""
  warn "即将卸载 V2Fun 并删除 ${INSTALL_DIR} 下的所有文件！"
  read -rp "$(echo -e "输入 ${RED}yes${NC} 确认卸载: ")" confirm
  [ "$confirm" = "yes" ] || { info "已取消"; exit 0; }

  $COMPOSE_CMD down --rmi all --volumes 2>/dev/null || true
  cd /
  rm -rf "$INSTALL_DIR"

  success "V2Fun 已完全卸载"
}

# ── 交互式菜单 ────────────────────────────────────────────

show_menu() {
  local installed=false
  load_conf 2>/dev/null && installed=true

  echo ""
  echo -e "${BOLD}╔══════════════════════════════════╗${NC}"
  echo -e "${BOLD}║          V2Fun 管理面板          ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════╝${NC}"
  echo ""

  if $installed; then
    local port
    port="$(get_port)"
    local status_text="${DIM}(检测中...)${NC}"
    if check_docker 2>/dev/null && check_compose 2>/dev/null; then
      cd "$INSTALL_DIR" 2>/dev/null
      if $COMPOSE_CMD ps 2>/dev/null | grep -q "Up\|running"; then
        status_text="${GREEN}运行中${NC} — http://$(get_ip):${port}"
      else
        status_text="${YELLOW}已停止${NC}"
      fi
    fi
    echo -e "  状态: ${status_text}"
    echo -e "  目录: ${DIM}${INSTALL_DIR}${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC}) 启动服务"
    echo -e "  ${GREEN}2${NC}) 停止服务"
    echo -e "  ${GREEN}3${NC}) 重启服务"
    echo -e "  ${GREEN}4${NC}) 查看日志"
    echo -e "  ${GREEN}5${NC}) 检查更新"
    echo -e "  ${GREEN}6${NC}) 修改配置"
    echo -e "  ${GREEN}7${NC}) 查看状态"
    echo -e "  ${RED}8${NC}) 卸载"
    echo -e "  ${DIM}0${NC}) 退出"
  else
    echo -e "  状态: ${YELLOW}未安装${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC}) 安装 V2Fun"
    echo -e "  ${DIM}0${NC}) 退出"
  fi

  echo ""
  read -rp "$(echo -e "请选择 ${DIM}[0]${NC}: ")" choice
  choice="${choice:-0}"

  if $installed; then
    case "$choice" in
      1) do_start ;;
      2) do_stop ;;
      3) do_restart ;;
      4) do_logs ;;
      5) do_update ;;
      6) do_config ;;
      7) do_status ;;
      8) do_uninstall ;;
      0) exit 0 ;;
      *) warn "无效选项"; show_menu ;;
    esac
  else
    case "$choice" in
      1) do_install ;;
      0) exit 0 ;;
      *) warn "无效选项"; show_menu ;;
    esac
  fi
}

# ── 帮助 ──────────────────────────────────────────────────

show_help() {
  echo ""
  echo -e "${BOLD}V2Fun 管理脚本${NC}"
  echo ""
  echo "用法: bash v2fun.sh [命令]"
  echo ""
  echo "不带参数运行将进入交互式管理面板。"
  echo ""
  echo "命令:"
  echo -e "  ${GREEN}install${NC}     交互式安装"
  echo -e "  ${GREEN}update${NC}      检查并更新"
  echo -e "  ${GREEN}start${NC}       启动服务"
  echo -e "  ${GREEN}stop${NC}        停止服务"
  echo -e "  ${GREEN}restart${NC}     重启服务"
  echo -e "  ${GREEN}logs${NC}        查看实时日志"
  echo -e "  ${GREEN}status${NC}      查看运行状态"
  echo -e "  ${GREEN}config${NC}      修改配置"
  echo -e "  ${RED}uninstall${NC}   卸载"
  echo ""
}

# ── 入口 ──────────────────────────────────────────────────

case "${1:-}" in
  install)    do_install ;;
  update)     do_update ;;
  start)      do_start ;;
  stop)       do_stop ;;
  restart)    do_restart ;;
  logs)       do_logs ;;
  status)     do_status ;;
  config)     do_config ;;
  uninstall)  do_uninstall ;;
  help|--help|-h) show_help ;;
  "") show_menu ;;
  *)  err "未知命令: $1（使用 bash v2fun.sh help 查看帮助）" ;;
esac
