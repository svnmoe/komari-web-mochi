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

    const containerWidth = settings['layout.containerWidth'] || '100vw';
    const layoutOpacity = parseNumber(settings['layout.opacity'], 95, 80, 100) / 100;
    const borderRadius = parseNumber(settings['layout.borderRadius'], 8, 0, 16);

    const glowStrength = parseNumber(settings['shadow.glowStrength'], 10, 0, 20);

    // 生成CSS内容
    let cssContent = `
      :root {
        --custom-container-width: ${containerWidth};
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
          width: var(--custom-container-width);
          max-width: 100%;
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

        /* 文字颜色增强 */
        body,
        .card-base,
        .main-content,
        .footer,
        .rt-ScrollAreaViewport,
        .status-card,
        .radix-themes {
          color: #1a1a1a !important;
        }

        .dark body,
        .dark .card-base,
        .dark .main-content,
        .dark .footer,
        .dark .rt-ScrollAreaViewport,
        .dark .status-card,
        .dark .radix-themes {
          color: #f0f0f0 !important;
        }

        /* 导航栏基础文字颜色 */
        .nav-bar {
          color: #1a1a1a !important;
        }

        .dark .nav-bar {
          color: #f0f0f0 !important;
        }

        /* 导航栏中有内联样式的元素保留原色 - 使用unset让内联样式生效 */
        .nav-bar [style*="color"] {
          color: unset !important;
        }

        /* 文字元素继承颜色 */
        .radix-themes * {
          text-shadow: none !important;
        }

        .radix-themes p,
        .radix-themes span,
        .radix-themes div,
        .radix-themes label,
        .radix-themes button,
        .radix-themes a {
          color: inherit;
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
