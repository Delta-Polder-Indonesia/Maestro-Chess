/**
 * Satu pintu tooltip — API pusat untuk seluruh situs.
 * Halaman/komponen harus pakai `TooltipLabel`; `Tooltip*` primitive hanya
 * untuk `src/components/ui/sidebar.jsx` (SIDEBAR_EXCEPTION terukur karena
 * butuh hidden+align pada collapsed state). Chart pakai Recharts Tooltip
 * (`src/components/ui/chart.jsx`, `src/components/tools/GrafikTools.jsx`)
 * sebagai CHART_EXCEPTION. Tidak ada title native di file ini.
 */
"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "aegov-tooltip z-[1200] inline-block origin-[var(--radix-tooltip-content-transform-origin)]",
          className,
        )}
        {...props}
      >
        {props.children}
        {/* Radix mengukur Arrow dengan ResizeObserver tanpa fallback. */}
        {typeof ResizeObserver === "function" ? <TooltipPrimitive.Arrow data-slot="tooltip-arrow" width={8} height={8} /> : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

function TooltipLabelStabil({ children, label, side, sideOffset }) {
  const [terbuka, setTerbuka] = useState(false)
  const fokus = useRef(false)

  // Saat label menghilang, jangan tinggalkan aria-describedby yang menunjuk
  // ke tooltip yang tidak ada. Jika label muncul pada kontrol yang masih
  // fokus, tampilkan tooltip-nya tanpa mengganti elemen kontrol tersebut.
  useEffect(() => { setTerbuka(Boolean(label) && fokus.current) }, [label])

  return (
    <TooltipProvider>
      <Tooltip open={Boolean(label) && terbuka} onOpenChange={(nilai) => { if (label) setTerbuka(nilai) }}>
        <TooltipTrigger asChild onFocus={() => { fokus.current = true }} onBlur={() => { fokus.current = false }}>{children}</TooltipTrigger>
        {label ? <TooltipContent side={side} sideOffset={sideOffset}>{label}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  )
}

function TooltipLabel({ children, label, side = "top", sideOffset = 4, stabil = false }) {
  // Hanya kontrol yang labelnya berubah memerlukan pemicu yang tetap terpasang.
  if (stabil) return <TooltipLabelStabil label={label} side={side} sideOffset={sideOffset}>{children}</TooltipLabelStabil>
  if (!label) return children

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipLabel }
