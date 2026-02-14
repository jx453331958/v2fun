#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  V2Fun 一键管理脚本
#  用法: bash v2fun.sh [命令]
# ============================================================

REPO_URL="https://github.com/jx453331958/v2fun.git"
INSTALL_DIR="${V2FUN_DIR:-/opt/v2fun}"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
CONTAINER_NAME="v2fun"
DEFAULT_PORT=3210

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# ---- 前置检查 ----
check_docker() {
  command -v docker &>/dev/null || error "未检测到 Docker，请先安装: https://docs.docker.com/get-docker/"
  docker info &>/dev/null || error "Docker 未运行，请先启动 Docker"
}

check_compose() {
  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    error "未检测到 Docker Compose，请先安装"
  fi
}

check_git() {
  command -v git &>/dev/null || error "未检测到 Git，请先安装"
}

# ---- 命令实现 ----

do_install() {
  info "开始安装 V2Fun ..."
  check_docker
  check_compose
  check_git

  if [ -d "$INSTALL_DIR" ]; then
    warn "安装目录 $INSTALL_DIR 已存在"
    read -rp "是否覆盖？(y/N) " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
    rm -rf "$INSTALL_DIR"
  fi

  info "克隆仓库到 $INSTALL_DIR ..."
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"

  info "构建 Docker 镜像 ..."
  cd "$INSTALL_DIR"
  $COMPOSE_CMD build --no-cache

  info "启动服务 ..."
  $COMPOSE_CMD up -d

  echo ""
  success "安装完成！"
  echo -e "  访问地址: ${BOLD}http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${DEFAULT_PORT}${NC}"
  echo -e "  管理命令: ${BOLD}bash v2fun.sh [start|stop|restart|logs|status|update|uninstall]${NC}"
  echo ""
}

do_update() {
  info "开始更新 V2Fun ..."
  check_docker
  check_compose
  check_git

  [ -d "$INSTALL_DIR" ] || error "V2Fun 未安装，请先运行: bash v2fun.sh install"

  cd "$INSTALL_DIR"

  info "拉取最新代码 ..."
  git fetch origin
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master)

  if [ "$LOCAL" = "$REMOTE" ]; then
    success "已是最新版本，无需更新"
    return
  fi

  git reset --hard "$REMOTE"

  info "重新构建 Docker 镜像 ..."
  $COMPOSE_CMD build --no-cache

  info "重启服务 ..."
  $COMPOSE_CMD down
  $COMPOSE_CMD up -d

  # 清理旧镜像
  docker image prune -f &>/dev/null || true

  success "更新完成！"
}

do_start() {
  check_docker
  check_compose
  [ -d "$INSTALL_DIR" ] || error "V2Fun 未安装，请先运行: bash v2fun.sh install"
  cd "$INSTALL_DIR"
  $COMPOSE_CMD up -d
  success "V2Fun 已启动"
}

do_stop() {
  check_docker
  check_compose
  [ -d "$INSTALL_DIR" ] || error "V2Fun 未安装"
  cd "$INSTALL_DIR"
  $COMPOSE_CMD down
  success "V2Fun 已停止"
}

do_restart() {
  check_docker
  check_compose
  [ -d "$INSTALL_DIR" ] || error "V2Fun 未安装"
  cd "$INSTALL_DIR"
  $COMPOSE_CMD down
  $COMPOSE_CMD up -d
  success "V2Fun 已重启"
}

do_logs() {
  check_docker
  check_compose
  [ -d "$INSTALL_DIR" ] || error "V2Fun 未安装"
  cd "$INSTALL_DIR"
  $COMPOSE_CMD logs -f --tail=100
}

do_status() {
  check_docker
  check_compose
  [ -d "$INSTALL_DIR" ] || error "V2Fun 未安装"
  cd "$INSTALL_DIR"

  echo -e "${BOLD}V2Fun 服务状态${NC}"
  echo "─────────────────────────────────"
  $COMPOSE_CMD ps
  echo ""

  if $COMPOSE_CMD ps --format json 2>/dev/null | grep -q '"running"'; then
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    success "运行中 — http://${ip}:${DEFAULT_PORT}"
  else
    if $COMPOSE_CMD ps 2>/dev/null | grep -q "Up"; then
      local ip
      ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
      success "运行中 — http://${ip}:${DEFAULT_PORT}"
    else
      warn "服务未运行，使用 'bash v2fun.sh start' 启动"
    fi
  fi
}

do_uninstall() {
  check_docker
  check_compose

  warn "即将卸载 V2Fun 并删除所有数据！"
  read -rp "确认卸载？(输入 yes 确认) " confirm
  [ "$confirm" = "yes" ] || { info "已取消"; exit 0; }

  if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    $COMPOSE_CMD down --rmi all --volumes 2>/dev/null || true
    cd /
    rm -rf "$INSTALL_DIR"
  fi

  success "V2Fun 已完全卸载"
}

show_help() {
  echo ""
  echo -e "${BOLD}V2Fun 管理脚本${NC}"
  echo ""
  echo "用法: bash v2fun.sh <命令>"
  echo ""
  echo "命令:"
  echo -e "  ${GREEN}install${NC}     安装并启动 V2Fun"
  echo -e "  ${GREEN}update${NC}      拉取最新代码并重新部署"
  echo -e "  ${GREEN}start${NC}       启动服务"
  echo -e "  ${GREEN}stop${NC}        停止服务"
  echo -e "  ${GREEN}restart${NC}     重启服务"
  echo -e "  ${GREEN}logs${NC}        查看实时日志"
  echo -e "  ${GREEN}status${NC}      查看运行状态"
  echo -e "  ${RED}uninstall${NC}   卸载 V2Fun"
  echo ""
  echo "环境变量:"
  echo "  V2FUN_DIR   安装目录 (默认: /opt/v2fun)"
  echo ""
}

# ---- 入口 ----
# 无参数时默认 install（方便 curl | bash 一键安装）
CMD="${1:-install}"

case "$CMD" in
  install)    do_install ;;
  update)     do_update ;;
  start)      do_start ;;
  stop)       do_stop ;;
  restart)    do_restart ;;
  logs)       do_logs ;;
  status)     do_status ;;
  uninstall)  do_uninstall ;;
  help|--help|-h) show_help ;;
  *)
    error "未知命令: $CMD (使用 'bash v2fun.sh help' 查看帮助)"
    ;;
esac
