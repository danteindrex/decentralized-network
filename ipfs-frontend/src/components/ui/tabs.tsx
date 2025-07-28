import * as React from "react"

interface TabsProps {
  defaultValue: string
  children: React.ReactNode
}

interface TabsListProps {
  children: React.ReactNode
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
}

const TabsContext = React.createContext<{
  activeTab: string
  setActiveTab: (value: string) => void
}>({
  activeTab: "",
  setActiveTab: () => {},
})

export function Tabs({ defaultValue, children }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue)

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children }: TabsListProps) {
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: "#f5f5f5",
        padding: "4px",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)
  const isActive = activeTab === value

  return (
    <button
      onClick={() => setActiveTab(value)}
      style={{
        flex: 1,
        padding: "12px 16px",
        border: "none",
        borderRadius: "6px",
        backgroundColor: isActive ? "white" : "transparent",
        color: isActive ? "black" : "#666",
        fontWeight: isActive ? "500" : "normal",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext)

  if (activeTab !== value) return null

  return <div>{children}</div>
}
