<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useSearchStore } from './stores/searchStore'
import { categories, pinnedSites } from './sites'
import GitHubIcon from './assets/github.svg'
import OutlineIcon from './assets/outline.svg'

// 侧边栏状态
const sidebarOpen = ref(false)
const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}

// 搜索相关
const searchStore = useSearchStore()
const query = ref('')
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)
const suggestionLoading = ref(false)
const activeSuggestionIndex = ref(-1)

const currentEngine = computed(() => {
  return searchStore.currentEngine || searchStore.searchEngines[0]
})
const searchEngines = computed(() => searchStore.searchEngines)

const currentEngineIndex = computed({
  get: () => searchStore.currentEngineIndex,
  set: (value) => searchStore.setCurrentEngineIndex(value),
})

function selectEngine(index: number) {
  currentEngineIndex.value = index
}

// 清理脚本和回调的工具
function cleanupScript(scriptId: string, callbackName: string) {
  const script = document.getElementById(scriptId)
  if (script && script.parentNode) {
    script.parentNode.removeChild(script)
  }
  delete (window as any)[callbackName]
}

// 处理标签点击
function handleTagClick(event: Event) {
  const target = event.target as HTMLElement
  const link = target.closest('a')
  if (link) {
    link.click()
  }
}

async function fetchSuggestions() {
  const q = query.value.trim()
  if (!q) {
    resetSuggestions()
    return
  }

  suggestionLoading.value = true
  showSuggestions.value = false

  const engine = currentEngine.value
  if (!engine) return

  // 生成唯一回调名，防止冲突
  const timestamp = Date.now()
  const callbackName = `handle${engine.id.charAt(0).toUpperCase() + engine.id.slice(1)}Suggestion_${timestamp}`
  const scriptId = `script-${callbackName}`

  // 清理之前的脚本（防重复）
  cleanupScript(scriptId, callbackName)

  const script = document.createElement('script')
  script.id = scriptId
  script.type = 'text/javascript'

  // 错误处理
  script.onerror = () => {
    console.warn(`${engine.name} 搜索建议加载失败`)
    resetSuggestions()
    cleanupScript(scriptId, callbackName)
  }

  // 成功回调（通用结构提取）
  ;(window as any)[callbackName] = (data: any) => {
    try {
      let list: string[] = []
      if (Array.isArray(data)) {
        if (data.length > 1 && Array.isArray(data[1])) list = data[1]
        else list = data.filter((s) => typeof s === 'string' && s)
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.s)) list = data.s
        else if (Array.isArray(data.sug)) list = data.sug
        else if (Array.isArray(data.r)) list = data.r
      }
      suggestions.value = list.filter(Boolean)
      showSuggestions.value = suggestions.value.length > 0
    } catch (e) {
      console.error('解析建议失败:', e)
      suggestions.value = []
    } finally {
      suggestionLoading.value = false
      cleanupScript(scriptId, callbackName)
    }
  }

  // 设置不同引擎的 URL
  let src = ''
  if (engine.id === 'baidu') {
    src = `https://sp0.baidu.com/5a1Fazu8AA54nxGko9WTAnF6hhy/su?wd=${encodeURIComponent(q)}&cb=${callbackName}&t=${timestamp}`
  } else if (engine.id === 'google') {
    src = `https://www.google.com/complete/search?client=gws-wiz&xssi=t&hl=zh-CN&q=${encodeURIComponent(q)}&callback=${callbackName}`
  } else if (engine.id === 'bing') {
    src = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}&JsonType=callback&JsonCallback=${callbackName}`
  } else if (engine.id === 'sogou') {
    src = `https://www.sogou.com/suggnew/ajajjson?type=web&key=${encodeURIComponent(q)}&callback=${callbackName}`
  }

  if (src) {
    script.src = src
    document.head.appendChild(script)
  } else {
    // 未知引擎：模拟建议
    suggestions.value = [`在 ${engine.name} 中搜索 "${q}"`]
    showSuggestions.value = true
    suggestionLoading.value = false
  }
}

function resetSuggestions() {
  suggestions.value = []
  showSuggestions.value = false
  activeSuggestionIndex.value = -1
  suggestionLoading.value = false
}

function handleSearch() {
  const q = query.value.trim()
  if (!q || !currentEngine.value) return
  const url = currentEngine.value.url.replace('{query}', encodeURIComponent(q))
  window.open(url, '_blank')
  resetSuggestions()
}

function selectSuggestion(suggestion: string) {
  query.value = suggestion
  handleSearch()
}

function handleInput() {
  fetchSuggestions()
  activeSuggestionIndex.value = -1
}

function handleKeydown(e: KeyboardEvent) {
  if (!showSuggestions.value || suggestions.value.length === 0) {
    if (e.key === 'Enter') handleSearch()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeSuggestionIndex.value = Math.min(activeSuggestionIndex.value + 1, suggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeSuggestionIndex.value >= 0 && suggestions.value[activeSuggestionIndex.value]) {
      selectSuggestion(suggestions.value[activeSuggestionIndex.value]!)
    } else {
      handleSearch()
    }
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
  }
}

// 防止点击建议时因 blur 导致下拉关闭
function onSearchInputBlur() {
  setTimeout(() => {
    if (!document.activeElement?.closest('.suggestions-dropdown')) {
      showSuggestions.value = false
    }
  }, 150)
}

// 组件卸载时清理可能残留的脚本
onBeforeUnmount(() => {
  document.querySelectorAll('script[id^="script-handle"]').forEach(el => el.remove())
})
</script>

<template>
  <div class="app-container">
    <div class="bg-overlay" />

    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <button
          class="sidebar-toggle"
          title="切换侧边栏"
          aria-label="切换侧边栏"
          @click="toggleSidebar"
        >
          <img :src="OutlineIcon" alt="菜单图标" class="icon" />
        </button>
      </div>
      <div class="header-right">
        <a
          class="github-link"
          href="https://github.com/BingoEco/simple-navsite"
          target="_blank"
          rel="noreferrer"
          title="GitHub 项目"
          aria-label="访问 GitHub 项目"
        >
          <img :src="GitHubIcon" alt="GitHub 图标" class="icon" />
        </a>
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-closed': !sidebarOpen }">
      <div v-for="category in categories" :key="category.name" class="category-group">
        <h4>{{ category.name }}</h4>
        <div class="tags">
          <button
            v-for="site in category.sites"
            :key="site.url"
            class="tag"
            @click="handleTagClick"
          >
            <a :href="site.url" target="_blank" rel="noreferrer" class="tag-link">
              {{ site.name }}
            </a>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Search Bar -->
      <div class="search-bar">
        <div class="search-tabs">
          <button
            v-for="(engine, index) in searchEngines"
            :key="engine.id"
            class="tab"
            :class="{ active: index === currentEngineIndex }"
            @click="selectEngine(index)"
            :aria-pressed="index === currentEngineIndex"
            :aria-label="`切换到 ${engine.name} 搜索`"
          >
            {{ engine.name }}
          </button>
        </div>

        <form @submit.prevent="handleSearch">
          <div class="search-input-container">
            <input
              v-model="query"
              type="text"
              placeholder="输入关键词搜索..."
              class="search-input"
              autofocus
              autocomplete="off"
              spellcheck="false"
              @input="handleInput"
              @focus="showSuggestions = suggestions.length > 0"
              @blur="onSearchInputBlur"
              @keydown="handleKeydown"
              aria-label="搜索框"
            />
            <div v-if="suggestionLoading" class="loading-indicator">加载中...</div>
            <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-dropdown">
              <div
                v-for="(suggestion, idx) in suggestions"
                :key="idx"
                class="suggestion-item"
                :class="{ active: idx === activeSuggestionIndex }"
                @mousedown.prevent="selectSuggestion(suggestion)"
                @mouseenter="activeSuggestionIndex = idx"
              >
                {{ suggestion }}
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Pinned Sites -->
      <div class="card-grid">
        <a
          v-for="site in pinnedSites"
          :key="site.url"
          :href="site.url"
          target="_blank"
          rel="noreferrer"
          class="card"
        >
          {{ site.name }}
        </a>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  position: relative;
  background-image: url('./assets/dark.jpeg');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  color: #333;
}

.bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  z-index: -1;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0rem 1.5rem;
  background-color: rgba(255, 255, 255, 0);
  box-shadow: none;
  position: sticky;
  top: 0;
  z-index: 100;
  border: none;
  backdrop-filter: none;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sidebar-toggle {
  font-size: 1.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #fff;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.sidebar-toggle:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

.github-link {
  font-size: 1.2rem;
  color: #fff;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.github-link:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.icon {
  width: 24px;
  height: 24px;
  filter: invert(1); /* 反转颜色，将白色变为黑色 */
  /* 或者使用 */
  /* -webkit-filter: invert(100%); */
}

/* 更好的方式：设置混合模式 */
.icon {
  width: 24px;
  height: 24px;
  mix-blend-mode: difference; /* 混合模式，使其适应背景 */
}

.sidebar {
  width: 250px;
  height: calc(100vh - 70px);
  background-color: black;
  padding: 1rem;
  transition: transform 0.3s ease;
  position: fixed;
  top: 70px;
  left: 0;
  z-index: 90;
  overflow-y: auto;
  backdrop-filter: none;
  box-shadow: 3px 0 10px rgba(0, 0, 0, 0.2);
}

.categories-container {
  display: flex;
  flex-wrap: wrap;
}

.category-column {
  width: 50%;
  padding-right: 0.5rem;
  box-sizing: border-box;
}

.category-column.second-column {
  padding-left: 0.5rem;
  padding-right: 0;
}

/* Webkit浏览器滚动条样式 */
.sidebar::-webkit-scrollbar {
  display: none;
}

.sidebar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb {
  background: #4a90e2;
  border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #5fa0f3;
}

.sidebar-closed {
  transform: translateX(-100%);
}

.category-group {
  margin-bottom: 1.2rem;
}

.category-group h4 {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
  color: #ffffff;
  font-weight: 600;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.7);
}

.tags {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tag {
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.15);
  color: white;
  border-radius: 15px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  text-align: center;
}

.tag:hover {
  background-color: #4a90e2;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  border-color: white;
}

.tag-link {
  color: inherit;
  text-decoration: none;
  display: block;
}

.main-content {
  padding: 2.5rem;
  max-width: 1200px;
  margin: 0 auto;
  margin-top: 70px;
  background-color: rgba(255, 255, 255, 0);
  border-radius: 12px;
  box-shadow: none;
  backdrop-filter: none;
  position: relative;
}

.search-bar {
  text-align: center;
  margin-bottom: 2.5rem;
  position: relative;
}

.search-tabs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.tab {
  padding: 0.6rem 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  color: white;
}

.tab.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 123, 255, 0.3);
}

.tab:hover:not(.active) {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

form {
  display: flex;
  justify-content: center;
  position: relative;
}

.search-input-container {
  position: relative;
  width: 100%;
  max-width: 600px;
  margin: 0 auto; /* 居中对齐 */
}

.search-input {
  width: 100%;
  padding: 1rem 1.5rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 30px;
  font-size: 1rem;
  outline: none;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  position: relative;
  z-index: 2;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.search-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}

.loading-indicator {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.7);
  z-index: 3;
}

.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0; /* 自动撑满容器宽度 */
  z-index: 1000;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.suggestion-item {
  padding: 12px 20px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  text-align: left;
  color: #333;
  transition: background-color 0.2s;
}

.suggestion-item:hover {
  background-color: #f5f5f5;
}

.suggestion-item.active {
  background-color: #007bff;
  color: white;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1.2rem;
  margin-top: 2rem;
}

.card {
  padding: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  text-align: center;
  background-color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  font-size: 0.95rem;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.card:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

@media (max-width: 768px) {
  .main-content {
    padding: 1.5rem 1rem;
    margin: 0 auto;
    margin-top: 70px;
    border-radius: 0;
  }

  .header {
    padding: 1rem 1rem;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
  }

  .sidebar {
    width: 250px;
    padding: 1rem;
    height: calc(100vh - 70px);
    top: 70px;
    background-color: rgba(0, 0, 0, 0.9);
    border-right: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 3px 0 15px rgba(0, 0, 0, 0.5);
    z-index: 100;
    /* 隐藏滚动条 */
    -ms-overflow-style: none;  /* IE 和 Edge */
    scrollbar-width: none;  /* Firefox */
  }

  /* 隐藏滚动条 - Chrome, Safari, Opera */
  .sidebar::-webkit-scrollbar {
    display: none;
  }

  .category-group {
    margin-bottom: 1.5rem;
  }

  .category-group h4 {
    margin: 0 0 0.8rem;
    font-size: 1rem;
    color: #ffffff;
    font-weight: 600;
    padding-bottom: 0.3rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  }

  .tags {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .tag {
    padding: 0.5rem 0.7rem;
    font-size: 0.8rem;
    border-radius: 12px;
  }

  .search-bar {
    margin-bottom: 2rem;
  }

  .search-tabs {
    gap: 0.4rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .tab {
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    border-radius: 18px;
    flex: 1;
    min-width: 80px;
    max-width: 120px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .search-input-container {
    width: 100%;
    max-width: 100%; /* 在小屏幕上使用全宽 */
    margin: 0 auto;
  }

  .search-input {
    width: 100%;
    padding: 0.9rem 1.2rem;
    font-size: 1rem;
    border-radius: 25px;
    max-width: 100%;
  }

  .suggestions-dropdown {
    width: 100% !important;
    max-width: 100% !important;
    left: 0 !important;
    top: calc(100% + 5px);
    transform: none !important;
  }

  .card-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }

  .card {
    padding: 0.8rem;
    border-radius: 10px;
    font-size: 0.9rem;
  }
}

@media (max-width: 600px) {
  .main-content {
    padding: 1.2rem 0.8rem;
    margin-top: 60px;
  }

  .header {
    padding: 0.8rem;
  }

  .sidebar {
    width: 220px;
    padding: 0.8rem;
    height: calc(100vh - 60px);
    top: 60px;
    /* 隐藏滚动条 */
    -ms-overflow-style: none;  /* IE 和 Edge */
    scrollbar-width: none;  /* Firefox */
  }

  /* 隐藏滚动条 - Chrome, Safari, Opera */
  .sidebar::-webkit-scrollbar {
    display: none;
  }

  .tags {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .tag {
    padding: 0.6rem 0.8rem;
    font-size: 0.85rem;
  }

  .search-tabs {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 1rem;
    justify-content: center;
  }

  .tab {
    width: auto;
    min-width: 70px;
    max-width: 100px;
    padding: 0.5rem 0.8rem;
    font-size: 0.85rem;
    flex: 0 1 auto;
  }

  .search-input-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
  }

  .search-input {
    width: 100%;
    padding: 0.8rem 1rem;
    font-size: 0.95rem;
    border-radius: 20px;
  }

  .suggestions-dropdown {
    width: 100% !important;
    max-width: 100% !important;
    left: 0 !important;
    top: calc(100% + 5px);
    transform: none !important;
  }

  .card-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.8rem;
    margin-top: 1.5rem;
  }

  .card {
    padding: 0.7rem;
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 1rem 0.6rem;
    margin-top: 55px;
  }

  .header {
    padding: 0.7rem 0.8rem;
  }

  .sidebar {
    width: 200px;
    padding: 0.6rem;
    height: calc(100vh - 55px);
    top: 55px;
    /* 隐藏滚动条 */
    -ms-overflow-style: none;  /* IE 和 Edge */
    scrollbar-width: none;  /* Firefox */
  }

  /* 隐藏滚动条 - Chrome, Safari, Opera */
  .sidebar::-webkit-scrollbar {
    display: none;
  }

  .category-group {
    margin-bottom: 1.2rem;
  }

  .category-group h4 {
    font-size: 0.9rem;
    margin: 0 0 0.6rem;
  }

  .tag {
    padding: 0.5rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 10px;
  }

  .search-tabs {
    gap: 0.3rem;
    margin-bottom: 0.8rem;
    flex-wrap: wrap;
  }

  .tab {
    min-width: 65px;
    max-width: 90px;
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
    flex: 0 1 auto;
  }

  .search-input-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
  }

  .search-input {
    width: 100%;
    padding: 0.7rem 0.9rem;
    font-size: 0.9rem;
    border-radius: 18px;
  }

  .suggestions-dropdown {
    width: 100% !important;
    max-width: 100% !important;
    left: 0 !important;
    top: calc(100% + 5px);
    transform: none !important;
  }

  .card-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.7rem;
    margin-top: 1.2rem;
  }

  .card {
    padding: 0.6rem;
    border-radius: 8px;
    font-size: 0.8rem;
  }
}

@media (max-width: 360px) {
  .main-content {
    padding: 0.8rem 0.5rem;
    margin-top: 50px;
  }

  .header {
    padding: 0.6rem 0.7rem;
  }

  .sidebar {
    width: 180px;
    padding: 0.5rem;
    height: calc(100vh - 50px);
    top: 50px;
    /* 隐藏滚动条 */
    -ms-overflow-style: none;  /* IE 和 Edge */
    scrollbar-width: none;  /* Firefox */
  }

  /* 隐藏滚动条 - Chrome, Safari, Opera */
  .sidebar::-webkit-scrollbar {
    display: none;
  }

  .category-group {
    margin-bottom: 1.2rem;
  }

  .category-group h4 {
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
  }

  .tag {
    padding: 0.4rem 0.5rem;
    font-size: 0.75rem;
  }

  .search-tabs {
    gap: 0.25rem;
    margin-bottom: 0.7rem;
  }

  .tab {
    min-width: 60px;
    max-width: 80px;
    padding: 0.35rem 0.5rem;
    font-size: 0.75rem;
    flex: 0 1 auto;
  }

  .search-input-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
  }

  .search-input {
    width: 100%;
    padding: 0.6rem 0.8rem;
    font-size: 0.85rem;
    border-radius: 16px;
  }

  .suggestions-dropdown {
    width: 100% !important;
    max-width: 100% !important;
    left: 0 !important;
    top: calc(100% + 5px);
    transform: none !important;
  }

  .card-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
    margin-top: 1rem;
  }

  .card {
    padding: 0.5rem;
    font-size: 0.75rem;
  }

  .tab {
    padding: 0.35rem 0.5rem;
    font-size: 0.75rem;
  }
}

/* 添加过渡动画以改善用户体验 */
.sidebar, .search-input, .card, .tab, .tag {
  transition: all 0.3s ease;
}

/* 改进触摸设备上的交互反馈 */
@media (hover: none) and (pointer: coarse) {
  .card, .tag, .tab {
    touch-action: manipulation;
  }
  
  .card:active, .tag:active, .tab:active {
    transform: scale(0.98);
  }
}
</style>