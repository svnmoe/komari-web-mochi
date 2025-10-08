import { useEffect } from "react";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

/**
 * 动态CSS样式注入组件
 * 根据后台配置动态生成CSS变量和样式
 */
export const CustomStyleInjector = () => {
  const { publicInfo } = usePublicInfo();

  useEffect(() => {
    if (!publicInfo?.theme_settings) return;

    const settings = publicInfo.theme_settings;

    // 解析配置值的辅助函数
    const parseNumber = (value: any, defaultValue: number, min: number, max: number): number => {
      const num = Number(value);
      if (isNaN(num)) return defaultValue;
      return Math.min(max, Math.max(min, num));
    };

    const parseBool = (value: any): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return false;
    };

    // 提取配置值
    const customEnabled = parseBool(settings['customAppearance.enabled']);
    const bgUrl = settings['customBackground.imageUrl'] || '';
    const bgFixed = parseBool(settings['customBackground.fixed']);

    const blurStrength = parseNumber(settings['glassmorphism.blurStrength'], 5, 0, 20);
    const lightOpacity = parseNumber(settings['glassmorphism.lightOpacity'], 30, 0, 100);
    const darkOpacity = parseNumber(settings['glassmorphism.darkOpacity'], 30, 0, 100);

    const layoutOpacity = parseNumber(settings['layout.opacity'], 95, 80, 100) / 100;
    const borderRadius = parseNumber(settings['layout.borderRadius'], 8, 0, 16);

    const glowStrength = parseNumber(settings['shadow.glowStrength'], 10, 0, 20);

    // 生成CSS内容
    let cssContent = `
      :root {
        --custom-layout-opacity: ${layoutOpacity};
        --custom-border-radius: ${borderRadius}px;
        --custom-glow-strength: ${glowStrength}px;
        --custom-blur-strength: ${blurStrength}px;
        --custom-light-opacity: ${lightOpacity / 100};
        --custom-dark-opacity: ${darkOpacity / 100};
      }
    `;

    // 自定义外观效果
    if (customEnabled) {
      // 背景图片样式
      if (bgUrl) {
        cssContent += `
          body {
            background: url('${bgUrl}') no-repeat center center ${bgFixed ? 'fixed' : 'scroll'};
            background-size: cover;
          }

          body::-webkit-scrollbar {
            display: none;
          }
        `;
      }

      // 玻璃拟态效果
      cssContent += `
        /* 防止水平滚动 */
        body {
          overflow-x: hidden;
        }

        /* 主布局容器 - 透明 */
        .layout {
          background-color: transparent !important;
          opacity: var(--custom-layout-opacity);
        }

        /* 控制栏、状态栏、卡片容器 - 透明 */
        .control-bar,
        .status-bar-container,
        .rt-BaseCard.rt-Card {
          background: transparent !important;
        }

        /* 节点卡片组件 - 使用透明度变量 */
        .card-base,
        .main-content,
        .rt-ScrollAreaViewport,
        .status-card {
          border-radius: var(--custom-border-radius);
          background-color: rgba(255, 255, 255, var(--custom-light-opacity)) !important;
          backdrop-filter: blur(var(--custom-blur-strength));
          -webkit-backdrop-filter: blur(var(--custom-blur-strength));
          box-shadow: 0 0 var(--custom-glow-strength) rgba(0, 0, 0, 0.15);
        }

        .dark .card-base,
        .dark .main-content,
        .dark .rt-ScrollAreaViewport,
        .dark .status-card {
          background-color: rgba(30, 30, 30, var(--custom-dark-opacity)) !important;
          box-shadow: 0 0 var(--custom-glow-strength) rgba(0, 0, 0, 0.3);
        }

        /* 导航栏和页脚 - 使用透明度变量 */
        .footer {
          border-radius: 0 0 var(--custom-border-radius) var(--custom-border-radius);
          margin: calc(var(--spacing) * 1);
          margin-left: 0;
          margin-right: 0;
          background-color: rgba(255, 255, 255, var(--custom-light-opacity)) !important;
          backdrop-filter: blur(var(--custom-blur-strength));
          -webkit-backdrop-filter: blur(var(--custom-blur-strength));
          box-shadow: 0 0 var(--custom-glow-strength) rgba(255, 255, 255, 0.2);
        }

        .nav-bar {
          border-radius: var(--custom-border-radius) var(--custom-border-radius) 0 0;
          margin: calc(var(--spacing) * 1);
          margin-left: 0;
          margin-right: 0;
          background-color: rgba(255, 255, 255, var(--custom-light-opacity)) !important;
          backdrop-filter: blur(var(--custom-blur-strength));
          -webkit-backdrop-filter: blur(var(--custom-blur-strength));
          box-shadow: 0 0 var(--custom-glow-strength) rgba(255, 255, 255, 0.2);
          min-width: initial;
        }

        .dark .footer,
        .dark .nav-bar {
          background-color: rgba(30, 30, 30, var(--custom-dark-opacity)) !important;
          box-shadow: 0 0 var(--custom-glow-strength) rgba(0, 0, 0, 0.2);
        }

        /* Radix主题容器 - 透明 */
        .radix-themes {
          background: transparent !important;
          border: 1px solid rgba(255, 255, 255, 0.3);
          transition: background-color 0.2s ease, backdrop-filter 0.2s ease;
        }

        .dark .radix-themes {
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        /* 文字颜色增强 - 基础容器 */
        body,
        .card-base,
        .main-content,
        .footer,
        .rt-ScrollAreaViewport,
        .radix-themes {
          color: #1a1a1a !important;
        }

        .dark body,
        .dark .card-base,
        .dark .main-content,
        .dark .footer,
        .dark .rt-ScrollAreaViewport,
        .dark .radix-themes {
          color: #f0f0f0 !important;
        }

        /* StatusBar - 只设置基础文本颜色，不影响图标和内联样式 */
        .status-card > div > div > div > span:not([style*="color"]),
        .status-card > div > div > div > p:not([style*="color"]) {
          color: #1a1a1a !important;
        }

        .dark .status-card > div > div > div > span:not([style*="color"]),
        .dark .status-card > div > div > div > p:not([style*="color"]) {
          color: #f0f0f0 !important;
        }

        /* 导航栏标题文字 - 使用 Radix UI 主文本颜色 */
        .nav-bar > div > a > label {
          color: var(--gray-12) !important;
        }

        /* 导航栏描述文字 - 使用 Radix UI accent 颜色 */
        .nav-bar > div > div > label {
          color: var(--accent-11) !important;
        }

        /* 保留所有内联样式颜色 */
        [style*="color"] {
          color: revert !important;
        }

        /* 按钮、图标按钮 - 使用 Radix UI 颜色变量 */
        .rt-IconButton,
        .rt-Button,
        a.rt-Button {
          color: var(--accent-11) !important;
        }

        .rt-IconButton:hover,
        .rt-Button:hover {
          color: var(--accent-12) !important;
        }

        /* 开关按钮保持原有背景色，不受透明度影响 */
        button[role="switch"] {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* 开关按钮状态颜色 */
        button[role="switch"][aria-checked="true"] {
          background-color: var(--accent-9) !important;
        }

        button[role="switch"][aria-checked="false"] {
          background-color: var(--gray-5) !important;
        }

        /* Popover 弹出层保持不透明背景 */
        .rt-PopoverContent {
          background-color: var(--color-panel-solid) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* Popover 内的文字使用 Radix UI 颜色 */
        .rt-PopoverContent,
        .rt-PopoverContent * {
          color: var(--gray-12) !important;
        }

        /* Popover 内的次要文字 */
        .rt-PopoverContent .rt-Text[size="2"] {
          color: var(--gray-11) !important;
        }

        /* 移除文字阴影 */
        .radix-themes * {
          text-shadow: none !important;
        }
      `;
    }

    // 检查是否已存在样式标签
    let styleElement = document.getElementById('custom-style-injector') as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-style-injector';
      document.head.appendChild(styleElement);
    }

    // 如果没有启用自定义外观,清空样式
    if (!customEnabled) {
      styleElement.textContent = '';
      return;
    }

    styleElement.textContent = cssContent;

    // 清理函数
    return () => {
      // 组件卸载时不移除样式，避免闪烁
    };
  }, [publicInfo]);

  return null;
};
