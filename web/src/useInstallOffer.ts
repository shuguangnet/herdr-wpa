import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isRunningStandalone(): boolean {
  if (globalThis.matchMedia?.("(display-mode: standalone)").matches) {
    return true;
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosDevice(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

/**
 * iOS never fires `beforeinstallprompt`; install lives in the share sheet. The
 * hint is only useful while the app is not already running installed.
 */
export function isIosInstallable(
  userAgent: string,
  standalone: boolean,
  hasPrompt: boolean,
): boolean {
  return !standalone && !hasPrompt && isIosDevice(userAgent);
}

export type InstallOffer = {
  canInstall: boolean;
  installed: boolean;
  iosHint: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

export function useInstallOffer(): InstallOffer {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => {
    try {
      return isRunningStandalone();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) {
      return "unavailable" as const;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    return choice.outcome;
  }, [promptEvent]);

  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  return {
    canInstall: Boolean(promptEvent) && !installed,
    installed,
    iosHint: isIosInstallable(userAgent, installed, Boolean(promptEvent)),
    install,
  };
}
