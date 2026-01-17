export interface Site {
  name: string
  url: string
}

export interface Category {
  name: string
  sites: Site[]
}

export interface SearchEngine {
  id: string
  name: string
  url: string
}