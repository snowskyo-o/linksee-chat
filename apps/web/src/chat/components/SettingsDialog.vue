<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  settings: { type: Object, default: () => ({ notifications: {}, general: {} }) },
  desktopPreferences: { type: Object, default: () => ({}) },
  profileName: { type: String, default: "" },
  profileBio: { type: String, default: "" },
  profileHint: { type: String, default: "" },
  profileHintTone: { type: String, default: "" },
  meAvatarUrl: { type: String, default: "" },
  appInfo: { type: Object, default: () => ({}) },
});

const emit = defineEmits([
  "close",
  "update:settings",
  "update:profileName",
  "update:profileBio",
  "save-profile",
  "upload-avatar",
  "open-update",
  "update:desktopPreferences",
  "choose-download-dir",
  "open-download-dir",
]);

function patchSettings(section, key, value) {
  emit("update:settings", {
    ...props.settings,
    [section]: {
      ...(props.settings?.[section] || {}),
      [key]: value,
    },
  });
}

function patchDesktopPreferences(key, value) {
  emit("update:desktopPreferences", {
    ...(props.desktopPreferences || {}),
    [key]: value,
  });
}
</script>

<template>
  <div v-if="open" class="settings-backdrop" @click.self="$emit('close')">
    <section class="settings-dialog">
      <header class="settings-header">
        <div>
          <h2>设置</h2>
          <p class="muted">个人资料、通知偏好和软件信息统一在这里管理。</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <div class="settings-layout">
        <section class="settings-card">
          <div class="detail-card-head">
            <h3>个人资料</h3>
          </div>
          <form class="profile-form" @submit.prevent="$emit('save-profile')">
            <div class="profile-avatar-block desktop-profile-block">
              <div class="profile-avatar-large">
                <AvatarImage :src="meAvatarUrl" alt="">
                  <span>{{ (profileName || "ME").slice(0, 2).toUpperCase() }}</span>
                </AvatarImage>
              </div>
              <label class="ghost-btn profile-avatar-upload compact-btn">
                更换头像
                <input class="hidden" type="file" accept="image/*" @change="$emit('upload-avatar', $event)" />
              </label>
            </div>
            <label class="field field-quiet">
              <span>昵称</span>
              <input :value="profileName" placeholder="输入你的昵称" @input="$emit('update:profileName', $event.target.value)" />
            </label>
            <label class="field field-quiet">
              <span>个性签名</span>
              <textarea
                :value="profileBio"
                rows="4"
                placeholder="写一句你的状态"
                @input="$emit('update:profileBio', $event.target.value)"
              ></textarea>
            </label>
            <button class="secondary-btn" type="submit">保存资料</button>
            <div class="hint" :class="profileHint ? (profileHintTone === 'error' ? 'is-error' : 'is-success') : ''">
              {{ profileHint }}
            </div>
          </form>
        </section>

        <section class="settings-card">
          <div class="detail-card-head">
            <h3>通知与声音</h3>
          </div>
          <label class="settings-toggle">
            <div>
              <strong>桌面消息提醒</strong>
              <p class="muted">收到新消息时显示系统通知小窗。</p>
            </div>
            <input
              :checked="Boolean(settings?.notifications?.desktopEnabled)"
              type="checkbox"
              @change="patchSettings('notifications', 'desktopEnabled', $event.target.checked)"
            />
          </label>
          <label class="settings-toggle">
            <div>
              <strong>提示音</strong>
              <p class="muted">收到新消息时播放内置双音提示，不支持时回退为系统提示音。</p>
            </div>
            <input
              :checked="Boolean(settings?.notifications?.soundEnabled)"
              type="checkbox"
              @change="patchSettings('notifications', 'soundEnabled', $event.target.checked)"
            />
          </label>
          <label class="settings-toggle">
            <div>
              <strong>消息免打扰</strong>
              <p class="muted">同步托盘菜单状态，开启后不再弹系统通知。</p>
            </div>
            <input
              :checked="Boolean(desktopPreferences?.notificationsMuted)"
              type="checkbox"
              @change="patchDesktopPreferences('notificationsMuted', $event.target.checked)"
            />
          </label>
        </section>

        <section class="settings-card">
          <div class="detail-card-head">
            <h3>常用设置</h3>
          </div>
          <div class="settings-field-group">
            <span>发送快捷键</span>
            <div class="settings-choice-row">
              <label class="settings-choice">
                <input
                  :checked="(settings?.general?.sendShortcut || 'enter') === 'enter'"
                  type="radio"
                  name="send-shortcut"
                  @change="patchSettings('general', 'sendShortcut', 'enter')"
                />
                <span>Enter 发送</span>
              </label>
              <label class="settings-choice">
                <input
                  :checked="(settings?.general?.sendShortcut || 'enter') === 'ctrlEnter'"
                  type="radio"
                  name="send-shortcut"
                  @change="patchSettings('general', 'sendShortcut', 'ctrlEnter')"
                />
                <span>Ctrl+Enter 发送</span>
              </label>
            </div>
          </div>
          <label class="settings-toggle">
            <div>
              <strong>关闭窗口时最小化到托盘</strong>
              <p class="muted">保持桌面端常驻，类似常见聊天软件。</p>
            </div>
            <input
              :checked="desktopPreferences?.closeToTray !== false"
              type="checkbox"
              @change="patchDesktopPreferences('closeToTray', $event.target.checked)"
            />
          </label>
          <label class="settings-toggle">
            <div>
              <strong>外部打开链接</strong>
              <p class="muted">默认用系统浏览器打开外部网页。</p>
            </div>
            <input
              :checked="Boolean(settings?.general?.openLinksExternally)"
              type="checkbox"
              @change="patchSettings('general', 'openLinksExternally', $event.target.checked)"
            />
          </label>
          <label class="settings-toggle">
            <div>
              <strong>开机启动</strong>
              <p class="muted">系统登录后自动启动桌面客户端。</p>
            </div>
            <input
              :checked="Boolean(desktopPreferences?.launchOnStartup)"
              type="checkbox"
              @change="patchDesktopPreferences('launchOnStartup', $event.target.checked)"
            />
          </label>
        </section>

        <section class="settings-card">
          <div class="detail-card-head">
            <h3>软件信息</h3>
          </div>
          <div class="settings-meta-list">
            <div class="settings-meta-row"><span>产品名</span><strong>{{ appInfo.productName || "Linksee Chat" }}</strong></div>
            <div class="settings-meta-row"><span>版本号</span><strong>{{ appInfo.version || "-" }}</strong></div>
            <div v-if="appInfo.update?.hasUpdate" class="settings-update-card" :class="{ 'is-required': appInfo.update?.mandatory }">
              <div>
                <strong>发现新版本 {{ appInfo.update.latestVersion }}</strong>
                <p class="muted">{{ appInfo.update.mandatory ? "当前版本需要尽快更新" : "可在方便时更新客户端" }}</p>
              </div>
              <button class="secondary-btn compact-btn" type="button" @click="$emit('open-update')">立即更新</button>
            </div>
            <div v-else class="settings-meta-row"><span>更新状态</span><strong>已是最新</strong></div>
            <div class="settings-meta-row"><span>Electron</span><strong>{{ appInfo.electron || "-" }}</strong></div>
            <div class="settings-meta-row"><span>Chromium</span><strong>{{ appInfo.chrome || "-" }}</strong></div>
            <div class="settings-meta-row"><span>Node.js</span><strong>{{ appInfo.node || "-" }}</strong></div>
          </div>
        </section>

        <section class="settings-card">
          <div class="detail-card-head">
            <h3>本地数据目录</h3>
          </div>
          <div class="settings-meta-list">
            <div class="settings-meta-row settings-meta-row-wrap">
              <span>下载保存位置</span>
              <strong>{{ desktopPreferences?.downloadsDir || appInfo.storage?.exports || "-" }}</strong>
            </div>
            <div class="settings-inline-actions">
              <button class="secondary-btn compact-btn" type="button" @click="$emit('choose-download-dir')">更换目录</button>
              <button class="ghost-btn compact-btn" type="button" @click="$emit('open-download-dir')">打开目录</button>
            </div>
            <div class="settings-meta-row"><span>根目录</span><strong>{{ appInfo.storage?.root || "-" }}</strong></div>
            <div class="settings-meta-row"><span>表情包目录</span><strong>{{ appInfo.storage?.stickers || "-" }}</strong></div>
            <div class="settings-meta-row"><span>头像缓存</span><strong>{{ appInfo.storage?.avatars || "-" }}</strong></div>
            <div class="settings-meta-row"><span>聊天缓存</span><strong>{{ appInfo.storage?.chatCache || "-" }}</strong></div>
            <div class="settings-meta-row"><span>导出目录</span><strong>{{ appInfo.storage?.exports || "-" }}</strong></div>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
