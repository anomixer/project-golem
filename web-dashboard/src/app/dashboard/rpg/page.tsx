"use client";

import { ExternalLink, Gamepad2 } from "lucide-react";

export default function RpgPage() {
    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Gamepad2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold text-foreground">文字 RPG</h1>
                        <p className="truncate text-xs text-muted-foreground">由目前啟動的 Golem 擔任 AI GM</p>
                    </div>
                </div>
                <a
                    href="/rpg/index.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <ExternalLink className="h-4 w-4" />
                    新視窗
                </a>
            </div>
            <iframe
                title="Golem Text RPG"
                src="/rpg/index.html"
                className="min-h-0 flex-1 border-0 bg-black"
                allow="clipboard-read; clipboard-write"
            />
        </div>
    );
}
