interface UserAgentInfo {
  device: string;
  browser: string;
  version: string;
}

export class UserAgentHelper {
  static parse(userAgent: string = navigator.userAgent): UserAgentInfo {
    const ua = userAgent.toLowerCase();

    // Detect device/OS
    let device = "Unknown";
    if (ua.includes("windows nt")) {
      device = "Windows";
    } else if (ua.includes("mac os x")) {
      device = "macOS";
    } else if (ua.includes("android")) {
      device = "Android";
    } else if (ua.includes("iphone") || ua.includes("ipad")) {
      device = "iOS";
    } else if (ua.includes("linux")) {
      device = "Linux";
    }

    // Detect browser and version
    let browser = "Unknown";
    let version = "0.0.0";

    if (ua.includes("edg/")) {
      browser = "Edge";
      const match = ua.match(/edg\/(\d+\.\d+\.\d+)/);
      version = match ? match[1] : version;
    } else if (ua.includes("chrome/")) {
      browser = "Chrome";
      const match = ua.match(/chrome\/(\d+\.\d+\.\d+)/);
      version = match ? match[1] : version;
    } else if (ua.includes("firefox/")) {
      browser = "Firefox";
      const match = ua.match(/firefox\/(\d+\.\d+)/);
      version = match ? match[1] : version;
    } else if (ua.includes("safari/") && !ua.includes("chrome")) {
      browser = "Safari";
      const match = ua.match(/version\/(\d+\.\d+)/);
      version = match ? match[1] : version;
    }

    return { device, browser, version };
  }

  static format(userAgent?: string): string {
    const { device, browser, version } = this.parse(userAgent);
    return `${device} ${browser}/${version}`;
  }

  /**
   * 检测是否需要禁用backdrop-filter以提升性能
   * Windows Chrome/Edge 和 Android Chrome 在使用 backdrop-filter 时可能出现性能问题
   */
  static shouldDisableBackdropFilter(userAgent: string = navigator.userAgent): boolean {
    const { device, browser } = this.parse(userAgent);

    // Android Chrome (已知问题: backdrop-filter + 透明背景导致UI降级)
    if (device === "Android" && browser === "Chrome") {
      return true;
    }

    // Windows Chrome/Edge (已知问题: backdrop-filter性能问题)
    if (device === "Windows" && (browser === "Chrome" || browser === "Edge")) {
      return true;
    }

    return false;
  }

  /**
   * 检测是否为移动设备
   */
  static isMobile(userAgent: string = navigator.userAgent): boolean {
    const ua = userAgent.toLowerCase();
    const mobileKeywords = [
      'mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry',
      'windows phone', 'webos', 'opera mini', 'opera mobi'
    ];
    return mobileKeywords.some(keyword => ua.includes(keyword));
  }
}
