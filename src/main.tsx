import './index.css'
import './i18n/i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { loadConfig } from './config/config'

const container = document.getElementById('root')
if (!container) {
  throw new Error('index.html has no #root element')
}
const root = createRoot(container)

try {
  const config = await loadConfig()
  root.render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  )
} catch (error) {
  // Without its configuration the app can do nothing: say so plainly, in English, as
  // no translation is certain to be loaded.
  console.error(error)
  root.render(
    <main role="alert" className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">VaultGate could not start</h1>
      <p className="mt-2">Its configuration could not be loaded. Try again in a moment.</p>
    </main>,
  )
}
