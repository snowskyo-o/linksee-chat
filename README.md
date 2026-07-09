# Linksee Chat

`Linksee Chat` 是从原始 `Linksee` 教学协作平台中抽离出来的纯聊天产品仓库。

当前目标：

- 只保留聊天相关能力
- 保留 Web 形态，后续可封装为桌面程序
- 继续使用服务端中心架构，而不是 P2P
- 运行环境升级为 `MySQL + Redis + MinIO + Docker`

## 当前 MVP 能力

- 登录
- 当前用户资料读取与修改
- 联系人列表
- 会话列表
- 新建私聊 / 新建群聊
- 历史消息
- 发送文本消息
- 回复消息
- 编辑 / 删除自己的消息
- 公告消息
- `@提及`
- 会话内消息搜索
- 已读标记
- 未读消息角标 / @ 提醒角标
- Socket.IO 实时刷新
- 文件消息上传 / 下载 / 过期处理
- Docker 正式环境接入 `MySQL + Redis + MinIO`
- 公开头像读取路由，避免浏览器 `img` 鉴权失败

## 目录

- `apps/api`：后端应用，按 `routes / services / realtime / server` 分层
- `apps/web`：Vue 3 + Vite 前端工程
- `apps/desktop`：Electron 桌面壳
- `infra`：环境配置、数据库、缓存、对象存储接入
- `prisma`：数据库结构与种子数据
- `docs`：架构与接口文档
- `scripts`：开发与校验脚本

## 启动

1. 安装依赖

```bash
npm install
```

2. 启动基础设施

```bash
docker compose up -d mysql redis minio minio-init
```

3. 按 `.env.example` 创建 `.env`

关键说明：

- `MINIO_ENDPOINT` 给后端容器内部访问用，比如 `minio`
- `MINIO_PUBLIC_ORIGIN` 给浏览器访问预签名链接用，本地可写 `http://127.0.0.1:9000`
- 如果部署到服务器，应该改成你的公网 IP 或文件域名，例如 `http://186.241.89.102:9000`

4. 初始化数据库并注入种子数据

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

5. 启动开发服务

```bash
npm run dev
```

6. 如需开发前端，单独启动 Vite

```bash
npm run dev:web
```

7. 构建前端静态产物

```bash
npm run build:web
```

8. 启动桌面壳

```bash
npm run dev:desktop
```

9. 打开页面

```text
http://localhost:3010/chat/login.html
```

## 当前架构

- 后端仍然是服务端中心模式，不走 P2P
- 实时通信用 `Socket.IO`
- 登录、资料、历史消息、搜索、已读等仍然走 `HTTP API`
- 当前前端已经升级为 `Vue 3 + Vite`
- 当前后端已改为 `Prisma + MySQL`，会话令牌使用 `Redis`
- 当前聊天文件走 `MinIO`
- 浏览器头像走应用层公开路由，避免 `img` 请求缺少 Bearer Token
- 浏览器文件上传可用 `MinIO` 预签名地址，地址需要通过 `MINIO_PUBLIC_ORIGIN` 暴露给外部
- 当前已接入最小 `Electron` 壳，后续也可以切 `Tauri`

## 结构说明

- `apps/api/src/server/index.mjs`：服务启动入口
- `apps/api/src/app.mjs`：Express 应用装配
- `apps/api/src/routes`：HTTP 路由
- `apps/api/src/services`：聊天数据与业务逻辑
- `apps/api/src/realtime`：Socket.IO 网关
- `apps/web/src`：Vue 页面、组件、共享逻辑
- `apps/web/dist`：Vite 构建产物，后端直接静态托管这里
- `apps/desktop/main.cjs`：Electron 主进程，负责拉起本地后端并打开窗口
- `apps/desktop/preload.cjs`：Electron 预加载桥接
- `infra/config`：运行参数
- `infra/db`：Prisma 客户端
- `infra/cache`：Redis 客户端
- `infra/storage`：MinIO 客户端
- `prisma/schema.prisma`：聊天正式数据库结构
- `prisma/seed.mjs`：默认演示账号与初始聊天数据
- `scripts/dev.mjs`：本地开发启动脚本
- `scripts/dev-desktop.mjs`：桌面开发启动脚本

## 默认测试账号

- `1000000001 / Chat1234`
- `1000000002 / Chat1234`
- `1000000003 / Chat1234`

## 后续方向

- 完善头像上传与裁剪
- 增加未读提醒和已读回执详情
- 已支持消息撤回 / 会话置顶 / 上传进度
- 增加草稿箱
- 增加 Electron 打包与发布配置
- 补正式 Prisma migration
- 补更完整的 Socket / 文件上传回归测试

## 打包与远程测试

如果你本地没有 Docker，推荐直接让桌面壳连接服务器：

1. 先把服务器部署好，确保能访问：

```text
http://你的服务器IP:3010/chat/login.html
```

2. 在仓库根目录新建 `desktop-config.json`，内容可参考 `desktop-config.example.json`：

```json
{
  "remoteOrigin": "http://186.241.89.102:3010"
}
```

3. 本地直接联调桌面壳：

```bash
npm run dev:desktop
```

4. 如需打便携包测试：

```bash
npm run pack:desktop
npm run dist:desktop
```

默认输出目录：

```text
release/
```