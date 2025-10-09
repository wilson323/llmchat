import React, { useState } from "react";
import { Menu, Keyboard } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { AgentSelector } from "./agents/AgentSelector";
import { ThemeToggle } from "./theme/ThemeToggle";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useChatStore } from "@/store/chatStore";
import { useI18n } from "@/i18n";
import { useResponsive } from "@/hooks/useResponsive";
import { KeyboardHelpPanel } from "./KeyboardHelpPanel";

export const Header: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useChatStore();
  const { t } = useI18n();
  const { isMobile } = useResponsive();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/90 border-b border-border/50
                   px-2 sm:px-4 py-2 sm:py-3
                   transition-all duration-200"
        role="banner"
      >
        <div className="flex items-center justify-between max-w-none">
          {/* 左侧：菜单、智能体选择器 */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-1 min-w-0">
            <IconButton
              onClick={() => setSidebarOpen(!sidebarOpen)}
              variant="glass"
              radius="lg"
              aria-label={t("切换侧边栏")}
              aria-expanded={sidebarOpen}
              aria-controls="sidebar"
              className={`flex-shrink-0 ${isMobile ? "h-8 w-8" : ""}`}
            >
              <Menu
                className={`${
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                } text-brand drop-shadow-sm`}
              />
            </IconButton>

            {/* 智能体选择器 - 移动端优化 */}
            <div className="flex-1 min-w-0 max-w-md">
              <AgentSelector />
            </div>
          </div>

          {/* 右侧：语言切换、主题切换 - 移动端紧凑布局 */}
          <div
            className={`flex items-center ${
              isMobile ? "gap-0.5" : "gap-1"
            } flex-shrink-0`}
          >
            <IconButton
              onClick={() => setIsHelpOpen(true)}
              variant="glass"
              radius="lg"
              aria-label={t("键盘快捷键帮助")}
              className={`flex-shrink-0 ${isMobile ? "h-8 w-8" : ""}`}
            >
              <Keyboard
                className={`${
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                } text-brand drop-shadow-sm`}
              />
            </IconButton>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <KeyboardHelpPanel
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </>
  );
};
