export interface Site {
  name: string
  url: string
  icon?: string // 可选 Iconify 图标
}

export interface Category {
  name: string
  sites: Site[]
}

export interface SearchEngine {
  id: string // 用于 localStorage 存储
  name: string
  url: string
}
