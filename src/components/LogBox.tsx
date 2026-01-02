type LogBoxProps = {
  title: string
  entries: string[]
  accent?: 'default' | 'danger'
}

export default function LogBox({ title, entries, accent = 'default' }: LogBoxProps) {
  return (
    <div className={`panel log-box ${accent}`}>
      <div className="header-title">{title}</div>
      <div className="scroll-area">
        {entries.length === 0 ? (
          <div className="log-empty">No logs yet</div>
        ) : (
          entries.map((entry, index) => (
            <div key={`${entry}-${index}`} className="log-line">
              {entry}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
