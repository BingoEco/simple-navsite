<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSearchStore } from '../composables/searchStore'
import { categories, pinnedSites } from '../config/sites'

// 侧边栏状态（默认隐藏）
const sidebarOpen = ref(false)
function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// 使用Pinia store管理搜索引擎
const searchStore = useSearchStore()

const query = ref('')
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)
const suggestionLoading = ref(false)
const activeSuggestionIndex = ref(-1) // 添加激活建议索引

const currentEngine = computed(() => searchStore.currentEngine)
const searchEngines = computed(() => searchStore.searchEngines)
const currentEngineIndex = computed({
  get: () => searchStore.currentEngineIndex,
  set: value => searchStore.setCurrentEngineIndex(value),
})

// 获取搜索建议
async function fetchSuggestions() {
  if (!query.value.trim()) {
    suggestions.value = []
    showSuggestions.value = false
    activeSuggestionIndex.value = -1 // 重置激活索引
    return
  }

  suggestionLoading.value = true
  try {
    // 根据当前搜索引擎获取建议
    if (currentEngine.value.id === 'baidu') {
      // 使用百度搜索建议API
      const script = document.createElement('script')
      const callbackName: string = 'handleBaiduSuggestion'

      // 设置回调函数 - 在添加到DOM前定义
      ;(window as any)[callbackName] = (data: any) => {
        try {
          // 百度的建议数据结构处理
          let suggestionsData: string[] = []

          // 处理各种可能的数据格式
          if (Array.isArray(data)) {
            // 格式1: ["query", ["suggestion1", "suggestion2", ...], {...}]
            if (data.length > 1 && Array.isArray(data[1])) {
              suggestionsData = data[1]
            }
            // 格式2: ["suggestion1", "suggestion2", ...]
            else {
              suggestionsData = data.filter(item => typeof item === 'string')
            }
          }
          else if (data && typeof data === 'object') {
            // 格式3: {q: "query", s: ["suggestion1", "suggestion2", ...], ...}
            if (Array.isArray(data.s)) {
              suggestionsData = data.s
            }
            // 格式4: {query: "query", sug: ["suggestion1", "suggestion2", ...], ...}
            else if (Array.isArray(data.sug)) {
              suggestionsData = data.sug
            }
            // 格式5: {r: ["suggestion1", "suggestion2", ...]}
            else if (Array.isArray(data.r)) {
              suggestionsData = data.r
            }
          }

          // 确保结果是字符串数组并过滤空值
          suggestions.value = Array.isArray(suggestionsData)
            ? suggestionsData.filter(item => typeof item === 'string' && item.length > 0)
            : []

          showSuggestions.value = suggestions.value.length > 0
        }
        catch (error) {
          console.error('处理百度搜索建议时出错:', error)
          suggestions.value = []
          showSuggestions.value = false
        }
        finally {
          // 确保脚本元素存在再移除
          if (script.parentNode) {
            script.parentNode.removeChild(script)
          }
          // 清理全局回调函数
          delete (window as any)[callbackName]
        }
      }

      // 设置错误处理 - 在添加到DOM前定义
      script.onerror = () => {
        console.error('百度搜索建议API脚本加载失败')
        suggestions.value = []
        showSuggestions.value = false
        // 确保脚本元素存在再移除
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        // 清理全局回调函数
        delete (window as any)[callbackName]
      }

      // 设置脚本源
      script.src = `https://sp0.baidu.com/5a1Fazu8AA54nxGko9WTAnF6hhy/su?wd=${encodeURIComponent(query.value)}&cb=${callbackName}&t=${Date.now()}`

      // 最后将脚本添加到DOM
      document.head.appendChild(script)
    }
    else if (currentEngine.value.id === 'google') {
      // 使用Google搜索建议API
      const script = document.createElement('script')
      const callbackName: string = 'handleGoogleSuggestion'

      // 在添加到DOM前定义回调函数 - 确保执行顺序
      ;(window as any)[callbackName] = (data: any) => {
        try {
          // Google的建议数据结构包含在data[1]中
          if (data && data[1]) {
            suggestions.value = data[1]
          }
          else {
            suggestions.value = []
          }
          showSuggestions.value = suggestions.value.length > 0
          // 确保脚本元素存在再移除
          if (script.parentNode) {
            script.parentNode.removeChild(script)
          }
          // 清理全局回调函数
          delete (window as any)[callbackName]
        }
        catch (error) {
          console.error('处理Google搜索建议时出错:', error)
          suggestions.value = []
          showSuggestions.value = false
          // 确保脚本元素存在再移除
          if (script.parentNode) {
            script.parentNode.removeChild(script)
          }
          // 清理全局回调函数
          delete (window as any)[callbackName]
        }
      }

      // 设置错误处理
      script.onerror = () => {
        console.error('Google搜索建议API脚本加载失败')
        suggestions.value = []
        showSuggestions.value = false
        // 确保脚本元素存在再移除
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        // 清理全局回调函数
        delete (window as any)[callbackName]
      }

      // 设置脚本源并添加到DOM
      script.src = `https://www.google.com/complete/search?client=gws-wiz&xssi=t&hl=zh-CN&authuser=0&dpr=1&q=${encodeURIComponent(query.value)}&callback=${callbackName}`
      document.head.appendChild(script)
    }
    else if (currentEngine.value.id === 'bing') {
      // 使用Bing搜索建议API
      const script = document.createElement('script')
      const callbackName: string = 'handleBingSuggestion'

      // 在添加到DOM前定义回调函数 - 确保执行顺序
      ;(window as any)[callbackName] = (data: any) => {
        try {
          // Bing的建议数据结构包含在data[1]中
          if (data && data[1]) {
            suggestions.value = data[1]
          }
          else {
            suggestions.value = []
          }
          showSuggestions.value = suggestions.value.length > 0
          // 确保脚本元素存在再移除
          if (script.parentNode) {
            script.parentNode.removeChild(script)
          }
          // 清理全局回调函数
          delete (window as any)[callbackName]
        }
        catch (error) {
          console.error('处理Bing搜索建议时出错:', error)
          suggestions.value = []
          showSuggestions.value = false
          // 确保脚本元素存在再移除
          if (script.parentNode) {
            script.parentNode.removeChild(script)
          }
          // 清理全局回调函数
          delete (window as any)[callbackName]
        }
      }

      // 设置错误处理
      script.onerror = () => {
        console.error('Bing搜索建议API脚本加载失败')
        suggestions.value = []
        showSuggestions.value = false
        // 确保脚本元素存在再移除
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        // 清理全局回调函数
        delete (window as any)[callbackName]
      }

      // 设置脚本源并添加到DOM
      script.src = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query.value)}&JsonType=callback&JsonCallback=${callbackName}`
      document.head.appendChild(script)
    }
    else if (currentEngine.value.id === 'sogou') {
      // 使用搜狗搜索建议API
      const script = document.createElement('script')
      const callbackName: string = 'handleSogouSuggestion'

      // 先定义回调函数
      ;(window as any)[callbackName] = (data: any) => {
        try {
          // 搜狗的建议数据结构处理 - 更通用的处理方式
          let suggestionsData: string[] = []

          // 处理各种可能的数据格式
          if (Array.isArray(data)) {
            // 格式1: ["query", ["suggestion1", "suggestion2", ...], {...}]
            if (data.length > 1 && Array.isArray(data[1])) {
              suggestionsData = data[1]
            }
            // 格式2: ["suggestion1", "suggestion2", ...]
            else {
              suggestionsData = data.filter(item => typeof item === 'string')
            }
          }
          else if (data && typeof data === 'object') {
            // 格式3: {q: "query", s: ["suggestion1", "suggestion2", ...], ...}
            if (Array.isArray(data.s)) {
              suggestionsData = data.s
            }
            // 格式4: {query: "query", sug: ["suggestion1", "suggestion2", ...], ...}
            else if (Array.isArray(data.sug)) {
              suggestionsData = data.sug
            }
            // 格式5: {r: ["suggestion1", "suggestion2", ...]}
            else if (Array.isArray(data.r)) {
              suggestionsData = data.r
            }
          }
          // 确保结果是字符串数组并过滤空值
          suggestions.value = Array.isArray(suggestionsData)
            ? suggestionsData.filter(item => typeof item === 'string' && item.length > 0)
            : []

          showSuggestions.value = suggestions.value.length > 0
        }
        catch (error) {
          console.error('处理搜狗搜索建议时出错:', error)
          suggestions.value = []
          showSuggestions.value = false
        }
        finally {
          // 确保脚本元素存在再移除
          if (script.parentNode) {
            script.parentNode.removeChild(script)
          }
          // 清理全局回调函数
          delete (window as any)[callbackName]
        }
      }

      // 设置错误处理
      script.onerror = () => {
        console.error('搜狗搜索建议API脚本加载失败')
        suggestions.value = []
        showSuggestions.value = false
        // 确保脚本元素存在再移除
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        // 清理全局回调函数
        delete (window as any)[callbackName]
      }

      // 设置脚本源并添加到DOM
      script.src = `https://suggest.sogou.com/sug?query=${encodeURIComponent(query.value)}&cb=${callbackName}&t=${Date.now()}`
      document.head.appendChild(script)
    }
    else {
      // 其他搜索引擎使用模拟数据
      suggestions.value = [`在 ${currentEngine.value.name} 中搜索 "${query.value}"`]
      showSuggestions.value = true
    }
  }
  catch (error) {
    console.error('获取搜索建议失败:', error)
    suggestions.value = []
    showSuggestions.value = false
  }
  finally {
    suggestionLoading.value = false
  }
}

function handleSearch() {
  if (!query.value.trim())
    return
  const url = currentEngine.value.url.replace('{query}', encodeURIComponent(query.value))
  window.open(url, '_blank')
  showSuggestions.value = false
  activeSuggestionIndex.value = -1 // 重置激活索引
}

function selectEngine(index: number) {
  searchStore.setCurrentEngineIndex(index)
  // 切换搜索引擎时重新获取建议
  fetchSuggestions()
}

function selectSuggestion(suggestion: string) {
  // 如果是百度的搜索建议格式，去除引号
  if (suggestion.startsWith('搜索 "') && suggestion.endsWith('"')) {
    query.value = suggestion.substring(3, suggestion.length - 1)
  }
  else {
    query.value = suggestion
  }
  handleSearch()
}

// 监听搜索框输入变化
function handleInput() {
  fetchSuggestions()
  activeSuggestionIndex.value = -1 // 重置激活索引
}

// 处理键盘事件
function handleKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value || suggestions.value.length === 0) {
    if (event.key === 'Enter') {
      handleSearch()
      return
    }
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSuggestionIndex.value = Math.min(activeSuggestionIndex.value + 1, suggestions.value.length - 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, -1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    if (activeSuggestionIndex.value >= 0) {
      selectSuggestion(suggestions.value[activeSuggestionIndex.value])
    }
    else {
      handleSearch()
    }
  }
  else if (event.key === 'Escape') {
    showSuggestions.value = false
  }
}

// 处理搜索输入框失焦事件
function onSearchInputBlur() {
  // 添加延迟，确保点击建议时不会因为失焦而隐藏建议框
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}
</script>

<template>
  <div class="app-container">
    <!-- 背景图 -->
    <div class="bg-overlay" />

    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="header-left">
        <button class="sidebar-toggle" title="切换侧边栏" @click="toggleSidebar">
          <div i-carbon-menu />
        </button>
      </div>
      <div class="header-right">
        <a
          class="github-link"
          rel="noreferrer"
          href="https://github.com/BingoEco/simple-navsite"
          target="_blank"
          title="GitHub"
        >
          <div i-carbon-logo-github />
        </a>
      </div>
    </header>

    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ 'sidebar-closed': !sidebarOpen }">
      <div v-for="category in categories" :key="category.name" class="category-group">
        <h4>{{ category.name }}</h4>
        <div class="tags">
          <button v-for="site in category.sites" :key="site.url" class="tag">
            <a :href="site.url" target="_blank" class="tag-link">
              {{ site.name }}
            </a>
          </button>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <div class="search-bar">
        <div class="search-tabs">
          <button
            v-for="(engine, index) in searchEngines" :key="engine.url" class="tab"
            :class="{ active: index === currentEngineIndex }" @click="selectEngine(index)"
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
              @input="handleInput"
              @focus="showSuggestions = suggestions.length > 0"
              @blur="onSearchInputBlur"
              @keydown="handleKeydown"
            >
            <div v-if="suggestionLoading" class="loading-indicator">
              加载中...
            </div>
          </div>
        </form>

        <!-- 搜索建议下拉框 -->
        <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-dropdown">
          <div
            v-for="(suggestion, index) in suggestions"
            :key="index"
            class="suggestion-item"
            :class="{ active: index === activeSuggestionIndex }"
            @mousedown="selectSuggestion(suggestion)"
          >
            {{ suggestion }}
          </div>
        </div>
      </div>

      <div class="card-grid">
        <a v-for="site in pinnedSites" :key="site.url" :href="site.url" target="_blank" class="card">
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
  background-image: url('/img/bg.jpg');
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

.sidebar {
  width: 250px;
  height: calc(100vh - 70px);
  background-color: #1a2530;
  border-right: 2px solid #4a90e2;
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
  width: 6px;
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
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 600px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 5px;
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
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.card {
  padding: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  text-align: center;
  background-color: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  color: white;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  font-size: 0.9rem;
}

.card:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

@media (max-width: 768px) {
  .main-content {
    padding: 1.5rem;
    margin: 0 auto;
    margin-top: 70px;
    border-radius: 0;
  }

  .header {
    padding: 1rem;
  }

  .sidebar {
    width: 220px;
    padding: 0.8rem;
    height: calc(100vh - 65px);
    top: 65px;
    background-color: #1a2530;
    border-right: 2px solid #4a90e2;
    box-shadow: 3px 0 8px rgba(0, 0, 0, 0.2);
  }

  .category-group {
    margin-bottom: 1rem;
  }

  .category-group h4 {
    margin: 0 0 0.5rem;
  }

  .tags {
    gap: 0.4rem;
  }

  .tag {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  /* Webkit浏览器滚动条样式 - 移动端 */
  .sidebar::-webkit-scrollbar {
    width: 5px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2.5px;
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: #4a90e2;
    border-radius: 2.5px;
  }

  .sidebar::-webkit-scrollbar-thumb:hover {
    background: #5fa0f3;
  }

  .search-input {
    padding: 0.8rem 1.2rem;
    font-size: 1rem;
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.8rem;
    margin-top: 1.5rem;
  }

  .card {
    padding: 0.7rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .tab {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 1rem;
  }

  .header {
    padding: 0.75rem 1rem;
  }

  .search-tabs {
    gap: 0.3rem;
  }

  .tab {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.6rem;
    margin-top: 1.2rem;
  }

  .card {
    padding: 0.6rem;
    border-radius: 5px;
    font-size: 0.8rem;
  }

  .sidebar {
    width: 200px;
    padding: 0.6rem;
    height: calc(100vh - 60px);
    top: 60px;
    background-color: #1a2530;
    border-right: 2px solid #4a90e2;
    box-shadow: 3px 0 6px rgba(0, 0, 0, 0.2);
  }

  .category-group {
    margin-bottom: 0.8rem;
  }

  .category-group h4 {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
  }

  .tags {
    gap: 0.3rem;
  }

  .tag {
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
  }

  /* Webkit浏览器滚动条样式 - 小屏幕 */
  .sidebar::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: #4a90e2;
    border-radius: 2px;
  }

  .sidebar::-webkit-scrollbar-thumb:hover {
    background: #5fa0f3;
  }

  .category-group h4 {
    font-size: 0.8rem;
    margin-bottom: 0.4rem;
  }

  .suggestions-dropdown {
    max-width: calc(100% - 2rem);
  }
}
</style>
