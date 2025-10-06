import React from "react";

export interface PublicInfo {
  allow_cors: boolean;
  custom_body: string;
  custom_head: string;
  description: string;
  disable_password_login: boolean;
  oauth_provider: string;
  oauth_enable: boolean;
  ping_record_preserve_time: number;
  record_enabled: boolean;
  record_preserve_time: number;
  sitename: string;
  private_site: boolean;
  theme_settings: {
    enableVirtualScroll?: boolean;
    offlineNodePosition?: string;
    taiwanFlagDisplay?: string;
    defaultViewMode?: string;
    enablePagination?: boolean;
    paginationPageSize?: number | string;
    "customAppearance.enabled"?: boolean;
    "customBackground.imageUrl"?: string;
    "customBackground.fixed"?: boolean;
    "glassmorphism.blurStrength"?: number | string;
    "glassmorphism.lightOpacity"?: number | string;
    "glassmorphism.darkOpacity"?: number | string;
    "layout.containerWidth"?: string;
    "layout.opacity"?: number | string;
    "layout.borderRadius"?: number | string;
    "shadow.glowStrength"?: number | string;
    [key: string]: any;
  };
  [property: string]: any;
}

interface Response {
  data: PublicInfo;
  message: string;
  status: string;
  [property: string]: any;
}

interface PublicInfoContextType {
  publicInfo: PublicInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const PublicInfoContext = React.createContext<PublicInfoContextType | undefined>(
  undefined
);

export const PublicInfoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [publicInfo, setPublicInfo] = React.useState<PublicInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = () => {
    setError(null);
    setIsLoading(true);
    fetch("/api/public")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch public info");
        }
        return response.json();
      })
      .then((resp: Response) => {
        if (resp && resp.data) {
          setPublicInfo(resp.data);
        } else {
          setPublicInfo(null);
        }
      })
      .catch((err) => {
        setError(err.message || "An error occurred while fetching public info");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  React.useEffect(() => {
    refresh();
  }, []);

  return (
    <PublicInfoContext.Provider value={{ publicInfo, isLoading, error, refresh }}>
      {children}
    </PublicInfoContext.Provider>
  );
};

export const usePublicInfo = () => {
  const context = React.useContext(PublicInfoContext);
  if (!context) {
    throw new Error("usePublicInfo must be used within a PublicInfoProvider");
  }
  return context;
};
