export type BusHandler = (payload?: unknown) => void

class CommandBus {
  private handlers = new Map<string, Set<BusHandler>>()

  on(cmd: string, handler: BusHandler): () => void {
    let set = this.handlers.get(cmd)
    if (!set) {
      set = new Set()
      this.handlers.set(cmd, set)
    }
    set.add(handler)
    return () => set.delete(handler)
  }

  emit(cmd: string, payload?: unknown) {
    this.handlers.get(cmd)?.forEach((h) => h(payload))
  }

  exec(cmd: string, payload?: unknown): boolean {
    const set = this.handlers.get(cmd)
    if (!set || set.size === 0) {
      console.warn(`[bus] 未注册命令: ${cmd}`)
      return false
    }
    set.forEach((h) => h(payload))
    return true
  }
}

export const commandBus = new CommandBus()
