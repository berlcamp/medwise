import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Org-wide toggles from medwise.org_settings, managed on the System Settings
// page and loaded once by AuthGuard.
export interface SettingsState {
  printReceiptsEnabled: boolean
  systemClosed: boolean
  systemClosedMessage: string
}

const initialState: SettingsState = {
  printReceiptsEnabled: true,
  systemClosed: false,
  systemClosedMessage: ''
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      Object.assign(state, action.payload)
    }
  }
})

export const { setSettings } = settingsSlice.actions
export default settingsSlice.reducer
