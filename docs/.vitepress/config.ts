import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'DraMark',
  titleTemplate: '戏码',
  description: 'DraMark - 专为戏剧、影视及音乐剧剧本创作设计的 Markdown 方言',
  
  lastUpdated: true,
  cleanUrls: true,
  
  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
      { text: '示例', link: '/examples/showcase' },
      { text: '参考', link: '/reference/config' },
      { text: 'FAQ', link: '/faq' },
    ],
    
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '快速入门', link: '/guide/getting-started' },
            { text: '基础概念', link: '/guide/concepts' },
          ]
        },
        {
          text: '语法详解',
          items: [
            { text: 'Frontmatter 配置', link: '/guide/frontmatter' },
            { text: '角色与台词', link: '/guide/character' },
            { text: '场景动作', link: '/guide/action' },
            { text: '唱段', link: '/guide/song' },
            { text: '念白段落', link: '/guide/spoken' },
            { text: '译配模式', link: '/guide/translation' },
            { text: '技术提示', link: '/guide/tech-cue' },
            { text: '注释', link: '/guide/comment' },
            { text: '转义字符', link: '/guide/escape' },
          ]
        },
        {
          text: '进阶',
          items: [
            { text: '代码保护区', link: '/guide/code-sanctuary' },
            { text: '给 LLM 的语法指南', link: '/guide/llm-syntax-guide' },
            { text: '编辑器优化', link: '/guide/editor' },
          ]
        }
      ],
      '/examples/': [
        {
          text: '示例',
          items: [
            { text: '完整剧本示例', link: '/examples/showcase' },
            { text: '音乐剧片段', link: '/examples/musical' },
            { text: '话剧片段', link: '/examples/play' },
          ]
        }
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '配置选项', link: '/reference/config' },
            { text: 'AST 节点类型', link: '/reference/ast' },
            { text: '诊断码', link: '/reference/diagnostics' },
          ]
        }
      ]
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dramark-md/dramark' }
    ],
    
    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2026 DraMark 贡献者'
    },
    
    search: {
      provider: 'local'
    },
    
    outline: {
      level: 'deep',
      label: '本页目录'
    },
    
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    
    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
  ],
  
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true,
  }
});
