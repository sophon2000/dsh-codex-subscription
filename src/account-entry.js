/** Unknown/loading status is account management, never a false signed-out claim. */
export function accountEntryLabel(state) {
  return state.status === 'ready' && state.account?.authenticated === false
    ? 'accountEntrySignIn' : 'accountEntryManage'
}

/** Navigation does not start OAuth, sign out, or change the selected model. */
export function openAccountEntry({ onDismiss, openSection }) {
  onDismiss()
  openSection('codex-subscription')
}
