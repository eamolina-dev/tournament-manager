import type { ReactNode } from "react"

type TableLayoutProps = {
  controls?: ReactNode
  children: ReactNode
  className?: string
}

export const TableLayout = ({ controls, children, className = "" }: TableLayoutProps) => {
  return (
    <section className={`tm-card space-y-4 ${className}`.trim()}>
      {controls ? <div className="space-y-3">{controls}</div> : null}
      {children}
    </section>
  )
}
