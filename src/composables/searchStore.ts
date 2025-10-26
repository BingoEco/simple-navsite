import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface SearchEngine {
  id: string
  name: string
  url: string
}

export const useSearchStore = defineStore('search', () => {
  const searchEngines = ref<SearchEngine[]>([
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}' },
    { id: 'google', name: '谷歌', url: 'https://www.google.com/search?q={query}' },
    { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q={query}' },
    { id: 'sogou', name: '搜狗', url: 'https://www.sogou.com/web?query={query}' },
  ])

  const currentEngineIndex = ref(0)

  // 从localStorage中获取保存的搜索引擎索引
  const savedIndex = localStorage.getItem('selectedSearchEngineIndex')
  if (savedIndex !== null) {
    const index = Number.parseInt(savedIndex, 10)
    if (!Number.isNaN(index) && index >= 0 && index < searchEngines.value.length) {
      currentEngineIndex.value = index
    }
  }

  const currentEngine = computed(() => searchEngines.value[currentEngineIndex.value])

  function setCurrentEngineIndex(index: number) {
    currentEngineIndex.value = index
    // 保存到localStorage
    localStorage.setItem('selectedSearchEngineIndex', index.toString())
  }

  return {
    searchEngines,
    currentEngineIndex,
    currentEngine,
    setCurrentEngineIndex,
  }
})
