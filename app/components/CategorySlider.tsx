"use client";

import { MouseEvent, useCallback } from "react";

type Category = {
    id: string;
    label: string;
};

type CategorySliderProps = {
    categories: Category[];
    activeId?: string | null;
    className?: string;
    onCategorySelect?: (categoryId: string) => void;
};

export default function CategorySlider({ categories, activeId, className = "", onCategorySelect }: CategorySliderProps) {
    const handleClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>, categoryId: string) => {
            event.preventDefault();
            const el = document.getElementById(categoryId);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            onCategorySelect?.(categoryId);
        },
        [onCategorySelect]
    );

    if (!categories.length) return null;

    return (
        <nav
            className={`rounded-3xl border border-[var(--color-border)] bg-[rgba(255,252,247,0.95)] px-4 py-2 shadow-[0_12px_30px_rgba(61,47,33,0.08)] ${className}`}
            aria-label="Catégories de la carte"
        >
            <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => {
                    const isActive = category.id === activeId;
                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={(event) => handleClick(event, category.id)}
                            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                                isActive
                                    ? "bg-[var(--color-accent-strong)] text-white shadow-[0_10px_20px_rgba(190,127,57,0.25)]"
                                    : "bg-[rgba(255,255,255,0.85)] text-[var(--color-heading)] border border-[var(--color-border)] hover:bg-[rgba(217,168,108,0.12)]"
                            }`}
                            aria-current={isActive ? "true" : undefined}
                        >
                            {category.label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

