export type AppType = 'web' | 'app' | 'menubar'

export type LightState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'
  | 'blocked'
  | 'degraded'

export interface AppView {
  name: string
  title: string
  type: AppType
  state: LightState
  line?: string
  icon?: string
  url?: string
}

export interface ManifestError {
  repoDir: string
  message: string
}

export interface ListResult {
  apps: AppView[]
  errors: ManifestError[]
  configError?: string
  unregisteredCount?: number
}

export interface UpdateEvent {
  name: string
  state: LightState
  line?: string
}
