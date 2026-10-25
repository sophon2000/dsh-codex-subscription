import { MenuItemButton, IconUserOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import { accountEntryLabel, openAccountEntry } from './account-entry.js'

/** Sidebar navigation only; credentials and login actions remain in the existing account page. */
export function CodexAccountEntry({ enabledProviders, onDismiss, openSection, useAccountStatus, t }) {
  const state = useAccountStatus(value => value)
  if (!enabledProviders.includes('codex')) return null
  return <MenuItemButton icon={<IconUserOutlineMedium size={16} />} onSelect={() => {
    openAccountEntry({ onDismiss, openSection })
  }}>{t(accountEntryLabel(state))}</MenuItemButton>
}
